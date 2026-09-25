// Command surveillance: danh mục tỉnh, phiên bản dữ liệu bất biến (panel), quan sát theo tháng (docs/09 §4.3).
//
//	surveillance                 chạy server (mặc định)
//	surveillance migrate         áp migration lên schema `surveillance` rồi thoát
//	surveillance seed            nạp danh mục tỉnh (CSV) và ranh giới (GeoJSON) — dữ liệu tham chiếu, idempotent
//	surveillance import-panel    nhập một panel Parquet làm phiên bản dữ liệu (kiểm đầy đủ như API, không đường tắt)
//	surveillance -healthcheck    dùng cho HEALTHCHECK của Docker
package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/config"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
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
	case "seed":
		return seed(args[1:])
	case "import-panel":
		return importPanel(args[1:])
	case "-healthcheck":
		return httpx.HealthcheckMain(config.HealthURL(os.LookupEnv))
	default:
		fmt.Fprintln(os.Stderr, "dùng: surveillance [serve] | migrate | seed -provinces f.csv [-geometry f.geojson -geometry-version V] | import-panel -panel f.parquet -version vX.Y.Z [-manifest f.json] | -healthcheck")
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
	fmt.Println("migration đã áp dụng (schema surveillance)")
	return 0
}

// cliService mở kết nối và dựng Service cho các lệnh một lần.
func cliService(ctx context.Context) (*app.Service, func(), error) {
	dsn, err := config.LoadDatabaseURL(os.LookupEnv)
	if err != nil {
		return nil, nil, fmt.Errorf("cấu hình không hợp lệ:\n%w", err)
	}
	pool, err := dbx.Connect(ctx, dsn, dbx.Options{MaxConns: 2})
	if err != nil {
		return nil, nil, err
	}
	return app.New(postgres.New(pool), nil, slog.Default()), pool.Close, nil
}

func seed(args []string) int {
	fs := flag.NewFlagSet("seed", flag.ContinueOnError)
	csvPath := fs.String("provinces", "", "CSV danh mục tỉnh (cột new_province_code,new_province_name,region)")
	geoPath := fs.String("geometry", "", "GeoJSON ranh giới 34 tỉnh (tuỳ chọn)")
	geoVersion := fs.String("geometry-version", "", "tên phiên bản ranh giới (vd 2025-07), bắt buộc khi có -geometry")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *csvPath == "" || (*geoPath != "") != (*geoVersion != "") {
		fmt.Fprintln(os.Stderr, "cần -provinces; -geometry và -geometry-version đi cùng nhau")
		return 2
	}
	ps, err := readProvinces(*csvPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	ctx := context.Background()
	svc, closeFn, err := cliService(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer closeFn()
	if err := svc.SeedProvinces(ctx, ps); err != nil {
		fmt.Fprintln(os.Stderr, "không nạp được danh mục tỉnh:", err)
		return 1
	}
	fmt.Printf("đã nạp %d tỉnh\n", len(ps))
	if *geoPath != "" {
		b, err := os.ReadFile(*geoPath)
		if err != nil {
			fmt.Fprintln(os.Stderr, "không đọc được GeoJSON:", err)
			return 1
		}
		if err := svc.SeedGeometry(ctx, *geoVersion, b); err != nil {
			fmt.Fprintln(os.Stderr, "không nạp được ranh giới:", err)
			return 1
		}
		fmt.Printf("đã nạp ranh giới phiên bản %s\n", *geoVersion)
	}
	return 0
}

func readProvinces(path string) ([]domain.Province, error) {
	f, err := os.Open(path) //nolint:gosec // G304: đường dẫn do người vận hành CLI truyền, không phải đầu vào từ mạng
	if err != nil {
		return nil, fmt.Errorf("không đọc được CSV tỉnh: %w", err)
	}
	defer f.Close()
	r := csv.NewReader(f)
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("CSV tỉnh rỗng: %w", err)
	}
	idx := map[string]int{}
	for i, h := range header {
		idx[h] = i
	}
	for _, need := range []string{"new_province_code", "new_province_name", "region"} {
		if _, ok := idx[need]; !ok {
			return nil, fmt.Errorf("CSV tỉnh thiếu cột %s", need)
		}
	}
	var out []domain.Province
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("CSV tỉnh: %w", err)
		}
		out = append(out, domain.Province{
			ID: rec[idx["new_province_code"]], Name: rec[idx["new_province_name"]], Region: domain.Region(rec[idx["region"]]),
		})
	}
	return out, nil
}

func importPanel(args []string) int {
	fs := flag.NewFlagSet("import-panel", flag.ContinueOnError)
	panelPath := fs.String("panel", "", "file panel_monthly.parquet")
	ver := fs.String("version", "", "tên phiên bản dữ liệu (vX.Y.Z)")
	srcManifest := fs.String("manifest", "", "manifest.json của ai-service (lấy known_issues; tuỳ chọn)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *panelPath == "" || *ver == "" {
		fmt.Fprintln(os.Stderr, "cần -panel và -version")
		return 2
	}
	panel, err := os.ReadFile(*panelPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "không đọc được panel:", err)
		return 1
	}
	var issues []string
	if *srcManifest != "" {
		b, err := os.ReadFile(*srcManifest)
		if err != nil {
			fmt.Fprintln(os.Stderr, "không đọc được manifest:", err)
			return 1
		}
		var src struct {
			KnownIssues []string `json:"known_issues"`
		}
		if err := json.Unmarshal(b, &src); err != nil {
			fmt.Fprintln(os.Stderr, "manifest không phải JSON:", err)
			return 1
		}
		issues = src.KnownIssues
	}
	ctx := context.Background()
	svc, closeFn, err := cliService(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer closeFn()
	res, err := svc.ImportPanel(ctx, *ver, panel, issues)
	var bad *domain.InvalidPanelError
	switch {
	case errors.As(err, &bad):
		fmt.Fprintln(os.Stderr, "panel không hợp lệ:")
		for _, p := range bad.Problems {
			fmt.Fprintln(os.Stderr, "  -", p)
		}
		return 1
	case errors.Is(err, domain.ErrDataVersionConflict):
		fmt.Fprintf(os.Stderr, "phiên bản %s đã tồn tại với nội dung KHÁC (phiên bản bất biến) — dùng tên phiên bản mới\n", *ver)
		return 1
	case err != nil:
		fmt.Fprintln(os.Stderr, "nhập thất bại:", err)
		return 1
	}
	if !res.Created {
		fmt.Printf("phiên bản %s đã có với đúng nội dung này — không thay đổi\n", res.DataVersion.Version)
		return 0
	}
	fmt.Printf("đã công bố %s: %d dòng, %d tỉnh, %s..%s, %.1f%% dữ liệu đo thật\n", res.DataVersion.Version, res.DataVersion.NRows,
		res.DataVersion.NProvinces, res.DataVersion.FirstMonth, res.DataVersion.LastMonth, res.DataVersion.RealShare*100)
	return 0
}

func serve() int {
	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cấu hình không hợp lệ:\n"+err.Error())
		return 2
	}
	log := obsx.NewLogger(os.Stdout, "surveillance", version, cfg.LogLevel)
	verifier, err := authx.NewServiceVerifier(authx.StaticKeySet{cfg.KeyID: cfg.JWTPublicKey}, cfg.Issuer, httpapi.ServiceAudience)
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

	router := httpapi.NewRouter(httpapi.Deps{
		Log:      log,
		Service:  app.New(postgres.New(pool), nil, log),
		Verifier: verifier,
		MaxBody:  cfg.MaxBodyBytes,
		Ready: func(ctx context.Context) error {
			if err := dbx.Ready(pool)(ctx); err != nil {
				return err
			}
			var migrated bool
			if err := pool.QueryRow(ctx, `SELECT to_regclass('data_versions') IS NOT NULL`).Scan(&migrated); err != nil {
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
