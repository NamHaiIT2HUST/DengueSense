// Package migrations nhúng các file migration SQL của schema `identity` vào binary.
package migrations

import "embed"

// FS chứa mọi *.sql (định dạng golang-migrate: NNNN_ten.up.sql / .down.sql).
//
//go:embed *.sql
var FS embed.FS
