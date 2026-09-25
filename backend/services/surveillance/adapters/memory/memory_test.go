package memory_test

import (
	"context"
	"testing"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/memory"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/repotest"
)

func TestMemoryRepositorySatisfiesTheContract(t *testing.T) {
	repotest.Run(t, func(t *testing.T) repotest.Env {
		r := memory.New()
		return repotest.Env{Repo: r, OutboxCount: func(context.Context) (int, error) { return len(r.Outbox), nil }}
	})
}
