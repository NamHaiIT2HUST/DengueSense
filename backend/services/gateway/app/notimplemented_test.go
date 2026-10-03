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

func (notImplemented) ListAlerts(context.Context, api.ListAlertsRequestObject) (api.ListAlertsResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ConfirmAlert(context.Context, api.ConfirmAlertRequestObject) (api.ConfirmAlertResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) ListCases(context.Context, api.ListCasesRequestObject) (api.ListCasesResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) CreateCase(context.Context, api.CreateCaseRequestObject) (api.CreateCaseResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetCase(context.Context, api.GetCaseRequestObject) (api.GetCaseResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) CreateAllocationPlan(context.Context, api.CreateAllocationPlanRequestObject) (api.CreateAllocationPlanResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) CreateDraft(context.Context, api.CreateDraftRequestObject) (api.CreateDraftResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GetDraft(context.Context, api.GetDraftRequestObject) (api.GetDraftResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) UpdateDraft(context.Context, api.UpdateDraftRequestObject) (api.UpdateDraftResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) SubmitReview(context.Context, api.SubmitReviewRequestObject) (api.SubmitReviewResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) DispatchApprovedOrder(context.Context, api.DispatchApprovedOrderRequestObject) (api.DispatchApprovedOrderResponseObject, error) {
	return nil, httpx.NotImplemented()
}

func (notImplemented) GenerateDraftForCase(context.Context, api.GenerateDraftForCaseRequestObject) (api.GenerateDraftForCaseResponseObject, error) {
	return nil, httpx.NotImplemented()
}
