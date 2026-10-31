package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

// IdentityTokenSource requests a workflow service token scoped to GenAI.
func IdentityTokenSource(identityURL, secret string, client *http.Client) func(context.Context) (string, error) {
	return func(ctx context.Context) (string, error) {
		if identityURL == "" || secret == "" {
			return "", errors.New("workflow identity credentials missing")
		}
		body, err := json.Marshal(map[string]string{"service": "workflow", "audience": "genai", "client_secret": secret})
		if err != nil {
			return "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(identityURL, "/")+"/internal/v1/service-tokens", bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", errors.New("identity rejected service credentials")
		}
		var result struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(io.LimitReader(resp.Body, 65536)).Decode(&result); err != nil || result.AccessToken == "" {
			return "", errors.New("invalid identity response")
		}
		return result.AccessToken, nil
	}
}
