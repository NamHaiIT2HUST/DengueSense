// Package api chứa mã sinh từ hợp đồng nội bộ contracts/openapi/identity-internal.yaml. KHÔNG sửa tay api.gen.go.
package api

//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.0 -config oapi-codegen.yaml ../../../../contracts/openapi/identity-internal.yaml
