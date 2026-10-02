// Command devtool: công cụ CHỈ DÙNG KHI PHÁT TRIỂN (không đóng vào image).
//
//	go run ./cmd/devtool keygen
//	    In cặp khoá Ed25519 (base64). Đặt PUBLIC vào GATEWAY_JWT_PUBLIC_KEY (infra/.env);
//	    PRIVATE giữ trên máy dev, KHÔNG commit, KHÔNG dán vào chat/issue.
//
//	go run ./cmd/devtool token -key <PRIVATE> -sub <id> -roles viewer,analyst -org <org>
//	    Cấp access token 15 phút để thử gateway bằng curl khi chưa có `identity`.
//
//	go run ./cmd/devtool secret
//	    Sinh client_secret cho một service (SECRET=… đặt ở phía service gọi; SHA256=… đặt vào
//	    IDENTITY_SERVICE_SECRET_SHA256_<TÊN> của identity). Bí mật gốc KHÔNG được commit.
package main

import (
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/config"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "keygen":
		err = keygen()
	case "token":
		err = token(os.Args[2:])
	case "secret":
		err = secret()
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "lỗi:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "dùng: devtool keygen | devtool secret | devtool token -key <PRIVATE> -sub <id> -roles a,b [-org <org>]")
}

func keygen() error {
	pub, priv, err := authx.GenerateKeyPair()
	if err != nil {
		return err
	}
	fmt.Println("PUBLIC=" + authx.EncodeKey(pub))
	fmt.Println("PRIVATE=" + authx.EncodeKey(priv))
	return nil
}

func secret() error {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return err
	}
	plain := base64.RawURLEncoding.EncodeToString(raw)
	fmt.Println("SECRET=" + plain)
	fmt.Println("SHA256=" + config.HashSecret(plain))
	return nil
}

func token(args []string) error {
	fs := flag.NewFlagSet("token", flag.ContinueOnError)
	key := fs.String("key", "", "khoá riêng Ed25519 (base64)")
	sub := fs.String("sub", "dev-user", "id người dùng")
	roles := fs.String("roles", "viewer", "vai trò, ngăn cách bằng dấu phẩy")
	org := fs.String("org", "dev-org", "đơn vị trực thuộc")
	iss := fs.String("iss", "denguesense-identity", "issuer")
	aud := fs.String("aud", "denguesense-gateway", "audience")
	if err := fs.Parse(args); err != nil {
		return err
	}
	priv, err := authx.ParsePrivateKey(*key)
	if err != nil {
		return err
	}
	signer, err := authx.NewEd25519Signer(priv, *iss, *aud)
	if err != nil {
		return err
	}
	var rs []authx.Role
	for _, r := range strings.Split(*roles, ",") {
		if r = strings.TrimSpace(r); r != "" {
			rs = append(rs, authx.Role(r))
		}
	}
	tok, err := signer.Sign(authx.Actor{ID: *sub, Roles: rs, OrgID: *org})
	if err != nil {
		return err
	}
	fmt.Println(tok)
	return nil
}
