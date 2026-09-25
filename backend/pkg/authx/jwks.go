package authx

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
)

// JWK là một khoá công khai Ed25519 dạng JSON Web Key (RFC 8037) — khớp schema `Jwk` trong
// contracts/openapi/identity-internal.yaml. CHỈ chứa khoá công khai.
type JWK struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
}

// JWKS là tập khoá công khai do `identity` công bố.
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// NewJWKS dựng JWKS từ các khoá công khai theo kid (sắp theo kid để đầu ra ổn định).
func NewJWKS(keys map[string]ed25519.PublicKey) JWKS {
	kids := make([]string, 0, len(keys))
	for kid := range keys {
		kids = append(kids, kid)
	}
	sort.Strings(kids)
	out := JWKS{Keys: make([]JWK, 0, len(kids))}
	for _, kid := range kids {
		out.Keys = append(out.Keys, JWK{
			Kty: "OKP",
			Crv: "Ed25519",
			X:   base64.RawURLEncoding.EncodeToString(keys[kid]),
			Kid: kid,
			Use: "sig",
			Alg: "EdDSA",
		})
	}
	return out
}

// KeySet chuyển JWKS thành StaticKeySet, KIỂM từng khoá (kiểu, đường cong, thuật toán, độ dài, kid duy nhất).
// Một khoá sai làm hỏng cả tập: thà từ chối còn hơn bỏ sót khoá lạ.
func (j JWKS) KeySet() (StaticKeySet, error) {
	if len(j.Keys) == 0 {
		return nil, errors.New("JWKS rỗng")
	}
	out := make(StaticKeySet, len(j.Keys))
	for _, k := range j.Keys {
		if k.Kty != "OKP" || k.Crv != "Ed25519" || k.Alg != "EdDSA" || k.Use != "sig" {
			return nil, fmt.Errorf("khoá %q không phải Ed25519/EdDSA/sig", k.Kid)
		}
		if k.Kid == "" {
			return nil, errors.New("khoá thiếu kid")
		}
		raw, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil || len(raw) != ed25519.PublicKeySize {
			return nil, fmt.Errorf("khoá %q có x không hợp lệ", k.Kid)
		}
		if _, dup := out[k.Kid]; dup {
			return nil, fmt.Errorf("kid %q bị trùng", k.Kid)
		}
		out[k.Kid] = ed25519.PublicKey(raw)
	}
	return out, nil
}
