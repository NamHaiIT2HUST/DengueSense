# Layer 3 Guardrails Specification (G1 - G6)

This document details the exact evaluation criteria, inputs, error codes, and blocking behavior of the 6 automated guardrails in DengueSense Layer 3.

---

## G1: Data Consistency (Tính Nhất Quán Dữ Liệu)
- **Code**: `G1`
- **Blocking**: Yes
- **Input Requirements**: `slots.confirmed_plan_id`, `slots.cases_pred`, `slots.logistics_items`.
- **Criteria**:
  1. If an allocation plan is provided, the draft text must only quote numbers that exist in the confirmed plan snapshot.
  2. Estimated cases prevented, bed counts, and chemical liters must match the confirmed snapshot exactly.
  3. No unverified mathematical multipliers (e.g. `cases_pred * 4.2`) are permitted.
  4. Competition demo labeling: Must include the notice that numbers originate from the confirmed plan input parameters and alert triggers in simulation mode.

---

## G2: Administrative Boundary (Địa Danh Hành Chính)
- **Code**: `G2`
- **Blocking**: Yes
- **Input Requirements**: `slots.province_ids`.
- **Criteria**:
  1. Every province ID in `province_ids` must exist in `ai-service/app/serving/genai_api/province_metadata.csv` (34 provinces of Vietnam).
  2. Unknown or fake province IDs (e.g. `fake`, `vn-999`) trigger an immediate 422 Unprocessable Entity error.
  3. Province names in generated text must match official administrative spelling (e.g. `Hà Nội`, `Hồ Chí Minh`, `Đà Nẵng`).

---

## G3: Legal Citations (Căn Cứ Pháp Lý)
- **Code**: `G3`
- **Blocking**: Yes (Mandatory for B2G dispatches)
- **Input Requirements**: `citations` array.
- **Criteria**:
  1. For `b2g` dispatches, `len(citations) > 0` is required. Empty citations array returns 502 Bad Gateway.
  2. For `b2b` internal reports, citations are optional.
  3. Every citation must have exact `document_id` matching `knownLegalCitations` in backend and `VERIFIED_LEGAL_CITATIONS` in AI service.
  4. Quotes must be verbatim extracts from the official government gazette (Công báo Chính phủ) or issuing ministry portal.
  5. URLs must be HTTP/HTTPS with hostnames matching approved whitelist (`congbao.chinhphu.vn`, `file.medinet.gov.vn`, `medinet.gov.vn`, `trungtamytengoquyen.vn`, `moh.gov.vn`, `vanban.chinhphu.vn`, `vbpl.moj.gov.vn`).

---

## G4: Administrative Format (Thể Thức Văn Bản)
- **Code**: `G4`
- **Blocking**: Yes
- **Criteria**:
  1. Conforms to structure specified in Nghị định 30/2020/NĐ-CP on administrative document management.
  2. For B2G dispatches, must contain standard sections:
     - Quốc hiệu & Tiêu ngữ: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc`.
     - Tiêu đề văn bản: Chỉ đạo phòng, chống dịch sốt xuất huyết Dengue.
     - Căn cứ pháp lý.
     - Nội dung chỉ đạo & phân công nhiệm vụ.
     - Nơi nhận (`UBND các tỉnh/thành phố`, `Sở Y tế`, `Trung tâm Kiểm soát bệnh tật CDC`).
  3. Unapproved watermark: Must explicitly contain `MÔ PHỎNG CUỘC THI` and `CHƯA KÝ` until approved by an authorized leadership officer.

---

## G5: Medical Safety (Nội Dung An Toàn Y Tế)
- **Code**: `G5`
- **Blocking**: Yes
- **Criteria**:
  1. Strict prohibition of clinical prescribing: No drug dosages, antibiotic regimens, or clinical treatment advice.
  2. Focus purely on public health surveillance, vector control (larvicide, ULV spraying), environmental sanitation, and inter-provincial resource mobilization.

---

## G6: Length & Formality (Độ Dài & Văn Phong)
- **Code**: `G6`
- **Blocking**: No (Warning flag for human officer review)
- **Criteria**:
  1. Length must be between 80 and 5,000 characters.
  2. Tone must be formal, authoritative, and objective Vietnamese administrative prose.
