package app_test

import (
	"context"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/api"
)

// Bí danh ngắn để các server giả trong test không lặp lại tên kiểu dài.
type (
	contextT      = context.Context
	getMeReq      = api.GetMeRequestObject
	getMeResp     = api.GetMeResponseObject
	handlerServer = api.StrictServerInterface
)
