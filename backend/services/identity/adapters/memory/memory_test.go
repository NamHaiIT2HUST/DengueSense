package memory_test

import (
	"testing"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/memory"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/repotest"
)

// Hiện thực trong bộ nhớ phải qua CÙNG bộ kiểm hợp đồng với Postgres.
func TestMemoryRepositoriesSatisfyTheContract(t *testing.T) {
	repotest.Run(t, func(*testing.T) repotest.Repos {
		s := memory.NewStore()
		return repotest.Repos{Users: s, Tokens: memory.Tokens{S: s}}
	})
}
