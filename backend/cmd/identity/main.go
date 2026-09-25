// Command identity: người dùng, đăng nhập, token người dùng/dịch vụ, JWKS (docs/09 §4.2).
//
//	identity                 chạy server (mặc định)
//	identity migrate         áp migration lên schema `identity` rồi thoát (chạy trước khi khởi động server)
//	identity create-user     tạo tài khoản (mật khẩu đọc từ IDENTITY_NEW_PASSWORD, KHÔNG nhận qua tham số dòng lệnh)
//	identity -healthcheck    dùng cho HEALTHCHECK của Docker
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/config"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

// version được gán lúc build: -ldflags "-X main.version=<git sha>".
var version = "dev"

func main() { os.Exit(run(os.Args[1:])) }

func run(args []string) int {
	cmd := "serve"
	if len(args) > 0 {
		cmd = args[0]
	}
	switch cmd {
	case "serve":
		return serve()
	case "migrate":
		return migrate()
	case "create-user":
		return createUser(args[1:])
	case "-healthcheck":
		return httpx.HealthcheckMain(config.HealthURL(os.LookupEnv))
	default:
		fmt.Fprintln(os.Stderr, "dùng: identity [serve] | migrate | create-user -username … -display-name … -org … -roles a,b | -healthcheck")
		return 2
	}
}

func migrate() int {
	dsn, err := config.LoadDatabaseURL(os.LookupEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cấu hình không hợp lệ:\n"+err.Error())
		return 2
	}
	if err := postgres.MigrateUp(dsn); err != nil {
		fmt.Fprintln(os.Stderr, "migration thất bại:", err)
		return 1
	}
	fmt.Println("migration đã áp dụng (schema identity)")
	return 0
}

func createUser(args []string) int {
	fs := flag.NewFlagSet("create-user", flag.ContinueOnError)
	username := fs.String("username", "", "tên đăng nhập (3–64 ký tự [a-z0-9._-])")
	display := fs.String("display-name", "", "tên hiển thị")
	org := fs.String("org", "", "đơn vị trực thuộc (vd cdc-hcm)")
	roles := fs.String("roles", "viewer", "vai trò, ngăn cách bằng dấu phẩy")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	password := os.Getenv("IDENTITY_NEW_PASSWORD")
	if password == "" {
		fmt.Fprintln(os.Stderr, "thiếu IDENTITY_NEW_PASSWORD (mật khẩu không nhận qua tham số để không lọt vào lịch sử shell/danh sách tiến trình)")
		return 2
	}
	dsn, err := config.LoadDatabaseURL(os.LookupEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cấu hình không hợp lệ:\n"+err.Error())
		return 2
	}
	var rs []authx.Role
	for _, r := range strings.Split(*roles, ",") {
		if r = strings.TrimSpace(r); r != "" {
			rs = append(rs, authx.Role(r))
		}
	}

	ctx := context.Background()
	pool, err := dbx.Connect(ctx, dsn, dbx.Options{MaxConns: 2})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer pool.Close()

	svc := app.New(postgres.NewUsers(pool), postgres.NewTokens(pool), nil, nil, app.Config{}, nil, slog.Default())
	u, err := svc.CreateUser(ctx, domain.User{Username: *username, DisplayName: *display, OrgID: *org, Roles: rs},
		password, domain.NewHasher(domain.DefaultPasswordParams))
	switch {
	case errors.Is(err, domain.ErrUsernameTaken):
		fmt.Fprintln(os.Stderr, "tên đăng nhập đã tồn tại")
		return 1
	case err != nil:
		fmt.Fprintln(os.Stderr, "không tạo được tài khoản:", err)
		return 1
	}
	fmt.Printf("đã tạo tài khoản %s (id %s, vai trò %v)\n", u.Username, u.ID, u.Roles)
	return 0
}

func serve() int {
	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cấu hình không hợp lệ:\n"+err.Error())
		return 2
	}
	log := obsx.NewLogger(os.Stdout, "identity", version, cfg.LogLevel)

	signer, err := authx.NewEd25519Signer(cfg.PrivateKey, cfg.Issuer, cfg.UserAudience)
	if err != nil {
		log.Error("khởi tạo signer thất bại", "error", err.Error())
		return 2
	}
	signer = signer.WithKeyID(cfg.KeyID)
	keys := authx.StaticKeySet{cfg.KeyID: signer.PublicKey()}
	verifier, err := authx.NewServiceVerifier(keys, cfg.Issuer, config.ServiceAudience)
	if err != nil {
		log.Error("khởi tạo verifier thất bại", "error", err.Error())
		return 2
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := dbx.Connect(ctx, cfg.DatabaseURL, dbx.Options{})
	if err != nil {
		log.Error("không kết nối được Postgres", "error", err.Error())
		return 1
	}
	defer pool.Close()

	svc := app.New(postgres.NewUsers(pool), postgres.NewTokens(pool), domain.NewHasher(domain.DefaultPasswordParams), signer,
		app.Config{
			MaxFailedAttempts:   cfg.MaxFailedAttempts,
			LockDuration:        cfg.LockDuration,
			RefreshTTL:          cfg.RefreshTTL,
			ServiceSecretHashes: cfg.ServiceSecretHashes,
			AudiencePolicy:      app.DefaultAudiencePolicy(),
		}, nil, log)

	router := httpapi.NewRouter(httpapi.Deps{
		Log:      log,
		Service:  svc,
		JWKS:     authx.NewJWKS(keys),
		Verifier: verifier,
		MaxBody:  cfg.MaxBodyBytes,
		Ready: func(ctx context.Context) error {
			if err := dbx.Ready(pool)(ctx); err != nil {
				return err
			}
			var migrated bool
			if err := pool.QueryRow(ctx, `SELECT to_regclass('users') IS NOT NULL`).Scan(&migrated); err != nil {
				return err
			}
			if !migrated {
				return errors.New("chưa chạy migration")
			}
			return nil
		},
	})

	if err := httpx.Run(ctx, cfg.ListenAddr, router, cfg.ShutdownTimeout, log); err != nil {
		log.Error("server dừng bất thường", "error", err.Error())
		return 1
	}
	return 0
}
