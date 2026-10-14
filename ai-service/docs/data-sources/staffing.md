# Staffing M1 — nguồn và giả định

Rà truy cập ngày 2026-10-14. Chỉ QA metadata/cấu trúc trang; chưa trích bảng,
chưa tải dataset hoặc kiểm licence từng instance. Không có numerical anchor
được QA để hiệu chỉnh fixture. Mọi scenario M1 là simulated, policy_verified=false.

| ID | Nguồn đã thử mở | Kết quả và giới hạn |
|---|---|---|
| D01 | [NSO 2024](https://www.nso.gov.vn/en/default/2026/01/statistical-yearbook-of-viet-nam-2024-2/) | Đọc được metadata niên giám; chưa QA bảng nhân lực/năm/địa giới. |
| D02 | [Quảng Trị 2024](https://thongkequangtri.nso.gov.vn/nien-giam-thong-ke/3) | Đọc được trang xuất bản; chưa QA PDF/bảng hoặc địa giới. Không chọn tỉnh pilot. |
| D03 | [WHO workforce](https://www.who.int/data/gho/data/themes/topics/health-workforce/GHO/) | Trang đọc được; chưa trích chỉ tiêu VNM hoặc xác nhận coverage nghề nghiệp. |
| D04 | [SOWN Western Pacific 2025](https://data.wpro.who.int/state-of-the-worlds-nursing-2025/) | Trang đọc được; chưa tải/QA profile Viet Nam. |
| D05 | [NRP instances](https://bitbucket.org/satt/nrp-instances/) | Công cụ trả trang rỗng; chưa tải/QA/license. |
| D06 | [NRP 1–24](https://www.schedulingbenchmarks.org/nrp/instances1_24.html) | Đọc được format guide; chưa tải instance/QA/license. Benchmark roster không thay staffing aggregate. |
| D07 | [INRC-II specification](https://arxiv.org/html/1501.04177v1) | Specification đọc được; chưa tải/QA validator/instance. |
| D08 | [WHO WISN](https://www.who.int/publications/i/item/9789240070066) | Trang manual đọc được; chỉ là nguồn phương pháp tham khảo, không cung cấp định mức fixture. |

Không sử dụng số thực nên checksum, checked_fields, bảng/trang và điều kiện tái
sử dụng dataset chưa có. Khi dùng numerical anchors phải bổ sung các mục này,
năm/địa giới, đơn vị và coverage trước khi gắn nhãn dữ liệu đã QA.

## Assumptions và đơn vị

- `unit-test-fixture`: số người/giờ/priority/chi phí thủ công để kiểm arithmetic,
  không phải định mức WHO hoặc giá nhân sự thật. VND là integer mỗi người/kỳ.
- `fixture-perturbation-v1`: nhân bản các cohort rời nhau; không tạo tuyến giữa
  replica. Thiếu hụt, floor và lock xung đột được giữ để kiểm infeasibility.
- `stress-v1`: tỷ lệ demand/budget/availability trong config là giả định research.
  Demand làm tròn lên; budget/available làm tròn xuống; commitment/reserve giữ nguyên.
- Người trong mỗi pool thay thế nhau, chỉ nhận một assignment mỗi kỳ. Không có
  danh tính, FTE/lịch ca, thời gian đi lại hoặc bằng chứng cohort thật không trùng.
- D08 trong source_refs là nguồn tham khảo khái niệm workload, không hiệu chỉnh số.

Provenance replay nằm trong report: scenario đầy đủ, hash input/config, seed,
schema/generator/package version và assumption IDs. Aggregate headcount chưa
chứng minh availability hoặc roster khả thi; không dùng report để điều phối thật.
