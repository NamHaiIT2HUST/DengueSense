package handler

import (
	"net/http"
)

// Raw là phản hồi đã dựng sẵn (trạng thái + header + thân) — dùng cho mọi operation của gateway: phản hồi của
// service phía sau được chuyển tiếp NGUYÊN VĂN (hợp đồng nội bộ và công khai dùng chung schema, có test đối chiếu),
// còn BFF/xác thực tự dựng thân. Một kiểu duy nhất thoả mọi `...ResponseObject` của mã sinh.
type Raw struct {
	Status int
	Header http.Header
	Body   []byte
}

func (r Raw) write(w http.ResponseWriter) error {
	for k, vs := range r.Header {
		w.Header()[k] = append([]string(nil), vs...) // GHI ĐÈ header mặc định của middleware (vd Cache-Control), không nhân đôi
	}
	w.WriteHeader(r.Status)
	if len(r.Body) == 0 {
		return nil
	}
	_, err := w.Write(r.Body)
	return err
}

func (r Raw) VisitCreateForecastRunResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetForecastRunResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetJobResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetMeResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetModelCardResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetProvinceExplanationResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetProvinceForecastsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetProvinceGeometryResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetProvinceResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitGetRiskMapResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListDataVersionsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListForecastRunsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListLimitationsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListModelVersionsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListObservationsResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitListProvincesResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitLoginResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitLogoutResponse(w http.ResponseWriter) error { return r.write(w) }

func (r Raw) VisitRefreshTokenResponse(w http.ResponseWriter) error { return r.write(w) }
