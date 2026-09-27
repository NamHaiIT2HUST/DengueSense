package app_test

import (
	"context"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/api"
)

// notImplemented là StrictServerInterface trả 501 cho mọi operation — dùng để kiểm KHUNG của gateway (xác thực
// fail-closed, lỗi chuẩn, health) độc lập với hiện thực thật ở package handler.
type notImplemented struct{}

var _ api.StrictServerInterface = notImplemented{}

func (notImplemented) Login(context.Context, api.LoginRequestObject) (api.LoginResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) Logout(context.Context, api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) RefreshToken(context.Context, api.RefreshTokenRequestObject) (api.RefreshTokenResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListDataVersions(context.Context, api.ListDataVersionsRequestObject) (api.ListDataVersionsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListForecastRuns(context.Context, api.ListForecastRunsRequestObject) (api.ListForecastRunsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) CreateForecastRun(context.Context, api.CreateForecastRunRequestObject) (api.CreateForecastRunResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetForecastRun(context.Context, api.GetForecastRunRequestObject) (api.GetForecastRunResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetProvinceGeometry(context.Context, api.GetProvinceGeometryRequestObject) (api.GetProvinceGeometryResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetJob(context.Context, api.GetJobRequestObject) (api.GetJobResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetMe(context.Context, api.GetMeRequestObject) (api.GetMeResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetModelCard(context.Context, api.GetModelCardRequestObject) (api.GetModelCardResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListLimitations(context.Context, api.ListLimitationsRequestObject) (api.ListLimitationsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListModelVersions(context.Context, api.ListModelVersionsRequestObject) (api.ListModelVersionsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListObservations(context.Context, api.ListObservationsRequestObject) (api.ListObservationsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListProvinces(context.Context, api.ListProvincesRequestObject) (api.ListProvincesResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetProvince(context.Context, api.GetProvinceRequestObject) (api.GetProvinceResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetProvinceExplanation(context.Context, api.GetProvinceExplanationRequestObject) (api.GetProvinceExplanationResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetProvinceForecasts(context.Context, api.GetProvinceForecastsRequestObject) (api.GetProvinceForecastsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetRiskMap(context.Context, api.GetRiskMapRequestObject) (api.GetRiskMapResponseObject, error) {
	return nil, httpx.NotImplemented()
}
