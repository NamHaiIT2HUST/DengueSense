// Package handler chứa phần hiện thực StrictServerInterface (hợp đồng công khai) của gateway.
package handler

import (
	"context"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/api"
)

// NotImplemented là hiện thực tạm của Đợt 0: mọi operation trả 501 problem+json (`common.not_implemented`).
//
// Vai trò: bảo đảm gateway BIÊN DỊCH được với hợp đồng hiện hành và hạ tầng (xác thực, lỗi, log,
// health) chạy thật trước khi có service phía sau. Mỗi operation sẽ được thay bằng hiện thực thật ở
// Đợt 1; thêm/đổi operation trong hợp đồng mà chưa cập nhật ở đây thì KHÔNG biên dịch được (đó là chủ đích).
type NotImplemented struct{}

var _ api.StrictServerInterface = NotImplemented{}

func (NotImplemented) Login(context.Context, api.LoginRequestObject) (api.LoginResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) Logout(context.Context, api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) RefreshToken(context.Context, api.RefreshTokenRequestObject) (api.RefreshTokenResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListDataVersions(context.Context, api.ListDataVersionsRequestObject) (api.ListDataVersionsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListForecastRuns(context.Context, api.ListForecastRunsRequestObject) (api.ListForecastRunsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) CreateForecastRun(context.Context, api.CreateForecastRunRequestObject) (api.CreateForecastRunResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetForecastRun(context.Context, api.GetForecastRunRequestObject) (api.GetForecastRunResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetProvinceGeometry(context.Context, api.GetProvinceGeometryRequestObject) (api.GetProvinceGeometryResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetJob(context.Context, api.GetJobRequestObject) (api.GetJobResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetMe(context.Context, api.GetMeRequestObject) (api.GetMeResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetModelCard(context.Context, api.GetModelCardRequestObject) (api.GetModelCardResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListLimitations(context.Context, api.ListLimitationsRequestObject) (api.ListLimitationsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListModelVersions(context.Context, api.ListModelVersionsRequestObject) (api.ListModelVersionsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListObservations(context.Context, api.ListObservationsRequestObject) (api.ListObservationsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) ListProvinces(context.Context, api.ListProvincesRequestObject) (api.ListProvincesResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetProvince(context.Context, api.GetProvinceRequestObject) (api.GetProvinceResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetProvinceExplanation(context.Context, api.GetProvinceExplanationRequestObject) (api.GetProvinceExplanationResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetProvinceForecasts(context.Context, api.GetProvinceForecastsRequestObject) (api.GetProvinceForecastsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (NotImplemented) GetRiskMap(context.Context, api.GetRiskMapRequestObject) (api.GetRiskMapResponseObject, error) {
	return nil, httpx.NotImplemented()
}
