// Package contracttest: tiện ích cho test dựa trên hợp đồng OpenAPI (contracts/openapi) — đọc TRỰC TIẾP file hợp đồng
// (nguồn sự thật) để test không thể lệch khỏi nó. Dùng bởi test của gateway và mọi service Go.
package contracttest

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// Operation là một operation trong hợp đồng.
type Operation struct {
	Method string // GET, POST…
	Path   string // đúng như trong hợp đồng, vd /internal/v1/users/{user_id}
	ID     string // operationId
	// Public = có `security: []` ở cấp operation (không cần xác thực).
	Public bool
}

var httpMethods = map[string]bool{"get": true, "post": true, "put": true, "patch": true, "delete": true}

// Load đọc hợp đồng `contracts/openapi/<file>` (tìm từ thư mục test đi lên tới gốc repo) và liệt kê operation.
func Load(t *testing.T, file string) []Operation {
	t.Helper()
	raw, err := os.ReadFile(locate(t, filepath.Join("contracts", "openapi", file)))
	require.NoError(t, err)

	var spec struct {
		Paths map[string]map[string]yaml.Node `yaml:"paths"`
	}
	require.NoError(t, yaml.Unmarshal(raw, &spec))

	var ops []Operation
	for path, methods := range spec.Paths {
		for method, node := range methods {
			if !httpMethods[strings.ToLower(method)] {
				continue
			}
			var op struct {
				OperationID string       `yaml:"operationId"`
				Security    *[]yaml.Node `yaml:"security"`
			}
			require.NoError(t, node.Decode(&op))
			ops = append(ops, Operation{
				Method: strings.ToUpper(method),
				Path:   path,
				ID:     op.OperationID,
				Public: op.Security != nil && len(*op.Security) == 0,
			})
		}
	}
	sort.Slice(ops, func(i, j int) bool { return ops[i].Method+ops[i].Path < ops[j].Method+ops[j].Path })
	require.NotEmpty(t, ops, "phải đọc được operation của %s", file)
	return ops
}

// locate tìm `rel` bằng cách đi ngược từ thư mục làm việc của test tới khi thấy file (gốc repo).
func locate(t *testing.T, rel string) string {
	t.Helper()
	dir, err := os.Getwd()
	require.NoError(t, err)
	for {
		candidate := filepath.Join(dir, rel)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		require.NotEqual(t, parent, dir, "không tìm thấy %s từ thư mục test", rel)
		dir = parent
	}
}

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// ConcretePath thay {tham_số} bằng UUID mẫu để gọi được route.
func ConcretePath(path string) string {
	return pathParam.ReplaceAllString(path, "0192f3a1-0000-7000-8000-000000000001")
}
