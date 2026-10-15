# Staffing M2 — matrix và quyết định offline

## Phạm vi và kiểm tra trước chạy

Review working tree trên nhánh `feature/staffing-mvp-m2`, nền M1 `b2fa400`. Không phát hiện lỗi code chặn matrix sau fix giữ seed khi search ném lỗi. 220 tests pass trước khi chạy. Không commit/push M2.

Phạm vi M2 dự kiến gồm 18 files: README; optimize `{cp_sat,staffing,milp,heuristics,settings,benchmark,reporting}.py`; 4 files tests và 2 fixtures trong `app/optimize/tests/`; runner, hai config YAML và báo cáo này trong experiment 017. Notebook, `.gitignore`, plan do người dùng sửa và hai AGENTS.md stage xóa được giữ riêng. Không stage thêm file trong lượt đo.

## Matrix cố định và provenance

Đo ngày 2026-10-15 trên macOS/arm64, một process tuần tự, mỗi solver một thread. Đây là máy phát triển, chưa đo tải HTTP/concurrency hoặc kiểm soát tải nền.

- 3 sizes × 4 methods × 10 solver seeds × 3 budgets = **360/360 runs**.
- Sizes/replicas=[1,5,20]; solver seeds=42–51; budgets=[1,10,30] giây.
- data_seed=20261014; order_seed=20261015; count_per_size=1; demand/budget/available choices=[100].
- Tổng budget cấu hình 4920 giây (82 phút); tổng runtime các method thực đo 2462.359093 giây (41.04 phút), progress cuối 2462.80 giây gồm overhead runner.
- Python 3.13.16; OR-Tools 9.15.6755; Pydantic 2.14.1; SCIP 10.0.0 [LP solver: SoPlex 8.0.0].
- Dataset hash: `61ba9f0178a8cca3502042d3feaa07104e325ca20158cd746bd98a51a5b41f8b`.
- Manifest giữ commit nền, hash từng source file optimize/runner, versions và toàn bộ settings; không dùng commit SHA đơn lẻ để nhận diện dirty source.

Trước lượt này chỉ có manifest smoke một size. Bộ full được tạo đúng một lần theo config đã duyệt; size 1 giữ cùng scenario hash với smoke. Sau đó chỉ đọc dataset đã đóng băng, không sinh lại khi resume.

| Size | Groups / needs / arcs | Scenario SHA-256 |
|---:|---|---|
| 1 | 2 / 2 / 2 | `e09294e7b4a5623239bd238082fac13e5d3ba5e03287b2d30f221eda921fc6b9` |
| 5 | 10 / 10 / 10 | `70634c0a97475b1379cb00334e630e7e27ffbf54e1f560b66970c70a983eba3d` |
| 20 | 40 / 40 / 40 | `3ab965af68d360c47931d957d491992312ee6b373ee242b9144094ae90e0f393` |

SCIP tolerances integrality/feasibility/objective=1e-6, gap absolute/relative=0, threads=1; backend xác nhận parameter string. Heuristic health_fraction=.7, initial_temperature_fraction=.1, min_temperature=1, cooling=.995, batch=64, tabu tenure=7, diversify_after=50. Seed feasibility CP-SAT cap=20% tổng budget; phần chưa dùng được trả cho search.

## Feasibility, status và proof

Đủ 360 unique keys, đúng mọi tổ hợp; pending=0, errors=0. Đã kiểm checksum/schema/identity từng checkpoint và gọi evaluator độc lập lại cho **360/360 allocations**. Mọi score khớp record, mọi hard constraint đều đạt. Resume exit 0, không chạy thêm; 362 file dataset/manifest/checkpoint giữ nguyên byte hash, lock được gỡ.

| Method | Feasible | Status | Top-level proof | Khớp tuple tối ưu CP-SAT |
|---|---:|---|---:|---:|
| CP-SAT | 90/90 | OPTIMAL 90 | 90/90 | 90/90 |
| SCIP | 90/90 | FEASIBLE 90; raw OPTIMAL ở cả hai phase | 0/90 | 90/90 |
| SA | 90/90 | FEASIBLE 90 | 0/90 | 80/90 |
| Tabu | 90/90 | FEASIBLE 90 | 0/90 | 78/90 |

CP-SAT: raw OPTIMAL với zero gap ở cả hai phase; proof_basis=zero_gap_solver. Tuple (weighted unmet, cost VND) theo size 1/5/20 lần lượt (8,40), (40,200), (160,800).

Raw bound phase health/cost của CP-SAT và SCIP đều bằng (8,40), (40,200), (160,800) theo size trong mọi run. SCIP giữ proven_optimal=false, proof_basis=none, integer_lower_bound và integer gaps=None theo đặc tả số học M2. Score/bound trùng nhau không nâng thành proof.

CP-SAT giữ phép đổi bound bảo thủ của M1: integer_lower_bound=raw bound−1 với các bound nguyên trong lượt đo này; absolute_gap=1 tương ứng. Proof OPTIMAL lấy từ zero-gap solver, không lấy từ phép đổi bound đó. Không tạo global gap cho tuple. SA/Tabu không có proof hoặc lower bound.

## Chất lượng và thời gian theo từng ô

Mỗi ô có 10 runs. H là weighted unmet; ưu tiên H thấp trước. C@H* chỉ gồm chi phí khi H bằng nghiệm CP-SAT có proof. Dấu — là không có run đạt H*. p50/p95 dùng nearest rank; với n=10, p95 chính là max quan sát, chưa là SLA.

| Method | Size | Budget s | H min / median / max | C@H* | Khớp tuple /10 | Runtime p50 / p95 s | First feasible p50 / p95 s | First observed / missing |
|---|---:|---:|---|---|---:|---|---|---|
| cp_sat | 1 | 1 | 8 / 8 / 8 | 40 | 10 | 0.001268 / 0.003257 | 0.000857 / 0.002674 | 10 / 0 |
| cp_sat | 1 | 10 | 8 / 8 / 8 | 40 | 10 | 0.001296 / 0.002597 | 0.000831 / 0.001991 | 10 / 0 |
| cp_sat | 1 | 30 | 8 / 8 / 8 | 40 | 10 | 0.001411 / 0.007166 | 0.000901 / 0.004159 | 10 / 0 |
| cp_sat | 5 | 1 | 40 / 40 / 40 | 200 | 10 | 0.003655 / 0.006305 | 0.002009 / 0.003190 | 10 / 0 |
| cp_sat | 5 | 10 | 40 / 40 / 40 | 200 | 10 | 0.003778 / 0.005496 | 0.002071 / 0.003394 | 10 / 0 |
| cp_sat | 5 | 30 | 40 / 40 / 40 | 200 | 10 | 0.004038 / 0.010981 | 0.002174 / 0.004536 | 10 / 0 |
| cp_sat | 20 | 1 | 160 / 160 / 160 | 800 | 10 | 0.009175 / 0.028941 | 0.004861 / 0.013627 | 10 / 0 |
| cp_sat | 20 | 10 | 160 / 160 / 160 | 800 | 10 | 0.009795 / 0.010969 | 0.005378 / 0.006024 | 10 / 0 |
| cp_sat | 20 | 30 | 160 / 160 / 160 | 800 | 10 | 0.010285 / 0.011470 | 0.005272 / 0.005994 | 10 / 0 |
| sa | 1 | 1 | 8 / 8 / 8 | 40 | 10 | 1.000087 / 1.000100 | 0.000637 / 0.000902 | 10 / 0 |
| sa | 1 | 10 | 8 / 8 / 8 | 40 | 10 | 10.000095 / 10.000262 | 0.000620 / 0.001246 | 10 / 0 |
| sa | 1 | 30 | 8 / 8 / 8 | 40 | 10 | 30.000154 / 30.000297 | 0.000653 / 0.002215 | 10 / 0 |
| sa | 5 | 1 | 40 / 40 / 40 | 200 | 10 | 1.000210 / 1.000454 | 0.000962 / 0.002036 | 10 / 0 |
| sa | 5 | 10 | 40 / 40 / 40 | 200 | 10 | 10.000240 / 10.000308 | 0.000997 / 0.008578 | 10 / 0 |
| sa | 5 | 30 | 40 / 40 / 40 | 200 | 10 | 30.000245 / 30.000361 | 0.000933 / 0.004452 | 10 / 0 |
| sa | 20 | 1 | 240 / 340 / 584 | — | 0 | 1.001051 / 1.005846 | 0.002303 / 0.003405 | 10 / 0 |
| sa | 20 | 10 | 160 / 160 / 160 | 800 | 10 | 10.000759 / 10.001029 | 0.002239 / 0.002850 | 10 / 0 |
| sa | 20 | 30 | 160 / 160 / 160 | 800 | 10 | 30.000771 / 30.001022 | 0.002091 / 0.003002 | 10 / 0 |
| scip | 1 | 1 | 8 / 8 / 8 | 40 | 10 | 0.003510 / 0.004796 | — / — | 0 / 10 |
| scip | 1 | 10 | 8 / 8 / 8 | 40 | 10 | 0.003230 / 0.007437 | — / — | 0 / 10 |
| scip | 1 | 30 | 8 / 8 / 8 | 40 | 10 | 0.003464 / 0.004543 | — / — | 0 / 10 |
| scip | 5 | 1 | 40 / 40 / 40 | 200 | 10 | 0.007291 / 0.008157 | — / — | 0 / 10 |
| scip | 5 | 10 | 40 / 40 / 40 | 200 | 10 | 0.007590 / 0.008442 | — / — | 0 / 10 |
| scip | 5 | 30 | 40 / 40 / 40 | 200 | 10 | 0.007598 / 0.043351 | — / — | 0 / 10 |
| scip | 20 | 1 | 160 / 160 / 160 | 800 | 10 | 0.043390 / 0.054757 | — / — | 0 / 10 |
| scip | 20 | 10 | 160 / 160 / 160 | 800 | 10 | 0.043942 / 0.077996 | — / — | 0 / 10 |
| scip | 20 | 30 | 160 / 160 / 160 | 800 | 10 | 0.042702 / 0.076836 | — / — | 0 / 10 |
| tabu | 1 | 1 | 8 / 8 / 8 | 40 | 10 | 1.000088 / 1.000102 | 0.000644 / 0.001559 | 10 / 0 |
| tabu | 1 | 10 | 8 / 8 / 8 | 40 | 10 | 10.000099 / 10.000408 | 0.000639 / 0.000822 | 10 / 0 |
| tabu | 1 | 30 | 8 / 8 / 8 | 40 | 10 | 30.000097 / 30.000289 | 0.000620 / 0.000781 | 10 / 0 |
| tabu | 5 | 1 | 40 / 40 / 40 | 200 | 10 | 1.000219 / 1.000294 | 0.000989 / 0.001061 | 10 / 0 |
| tabu | 5 | 10 | 40 / 40 / 40 | 200 | 10 | 10.000252 / 10.003559 | 0.000914 / 0.002401 | 10 / 0 |
| tabu | 5 | 30 | 40 / 40 / 40 | 200 | 10 | 30.000240 / 30.000692 | 0.000969 / 0.001619 | 10 / 0 |
| tabu | 20 | 1 | 232 / 280 / 336 | — | 0 | 1.000900 / 1.001251 | 0.002353 / 0.004090 | 10 / 0 |
| tabu | 20 | 10 | 160 / 160 / 168 | 800 | 8 | 10.000810 / 10.001626 | 0.002234 / 0.003883 | 10 / 0 |
| tabu | 20 | 30 | 160 / 160 / 160 | 800 | 10 | 30.000814 / 30.001162 | 0.002260 / 0.048092 | 10 / 0 |

CP-SAT runtime max=0.028941 giây; first feasible max=0.013627 giây. SCIP runtime max=0.077996 giây; first feasible=None ở cả 90 runs, observation=final_only. Không suy first-feasible SCIP từ runtime cuối.

SA/Tabu first-feasible ở top-level là sự kiện seed CP-SAT được validate, tính từ t0 chung trước seed search; không phải thời điểm đạt score cuối. Search runtime báo riêng dưới đây.

## Seed và phần cải thiện heuristic

Cả 180 seed searches đều FEASIBLE. Initial tuple ở size 1/5/20 lần lượt (40,0), (200,0), (800,0); hash initial đều là allocation rỗng. Mỗi method tự tìm seed và trả thời gian seed riêng. Mọi final đều cải thiện H; cost_improvement=None ở cả 180 runs vì H thay đổi. Chi phí thấp hơn ở run H cao hơn không được tính là thắng.

| Method | Size | Budget s | Initial (H,C) | ΔH min–max | Seed runtime p50 / p95 s | Search runtime p50 / p95 s | Steps min–max |
|---|---:|---:|---|---|---|---|---|
| sa | 1 | 1 | (40, 0) | 32–32 | 0.000737 / 0.001009 | 0.999271 / 0.999524 | 36735–39982 |
| sa | 1 | 10 | (40, 0) | 32–32 | 0.000710 / 0.001355 | 9.999252 / 9.999524 | 329844–396795 |
| sa | 1 | 30 | (40, 0) | 32–32 | 0.000759 / 0.002422 | 29.999193 / 29.999476 | 907952–1184839 |
| sa | 5 | 1 | (200, 0) | 160–160 | 0.001158 / 0.002249 | 0.998904 / 0.999197 | 4689–11827 |
| sa | 5 | 10 | (200, 0) | 160–160 | 0.001189 / 0.012863 | 9.998829 / 9.999154 | 99203–120267 |
| sa | 5 | 30 | (200, 0) | 160–160 | 0.001150 / 0.004882 | 29.998807 / 29.999263 | 273430–357118 |
| sa | 20 | 1 | (800, 0) | 216–560 | 0.002894 / 0.004006 | 0.997694 / 1.001392 | 418–1854 |
| sa | 20 | 10 | (800, 0) | 640–640 | 0.002778 / 0.003442 | 9.997555 / 9.997826 | 18205–29001 |
| sa | 20 | 30 | (800, 0) | 640–640 | 0.002688 / 0.003586 | 29.997566 / 29.998059 | 76010–89109 |
| tabu | 1 | 1 | (40, 0) | 32–32 | 0.000749 / 0.001684 | 0.999262 / 0.999443 | 38581–41441 |
| tabu | 1 | 10 | (40, 0) | 32–32 | 0.000734 / 0.000930 | 9.999282 / 9.999574 | 375031–410693 |
| tabu | 1 | 30 | (40, 0) | 32–32 | 0.000708 / 0.000884 | 29.999272 / 29.999697 | 1130325–1231089 |
| tabu | 5 | 1 | (200, 0) | 160–160 | 0.001175 / 0.001269 | 0.998906 / 0.999202 | 10306–12725 |
| tabu | 5 | 10 | (200, 0) | 160–160 | 0.001103 / 0.002630 | 9.998961 / 10.002311 | 103678–125913 |
| tabu | 5 | 30 | (200, 0) | 160–160 | 0.001159 / 0.001832 | 29.998916 / 29.998978 | 312687–375363 |
| tabu | 20 | 1 | (800, 0) | 464–568 | 0.002898 / 0.004722 | 0.997642 / 0.998174 | 3192–3586 |
| tabu | 20 | 10 | (800, 0) | 632–640 | 0.002782 / 0.004559 | 9.997439 / 9.997735 | 15039–32706 |
| tabu | 20 | 30 | (800, 0) | 640–640 | 0.002839 / 0.051157 | 29.997491 / 29.997851 | 81577–96786 |

## Giới hạn budget và kiểm tra lại phần nhạy

- Size 20, budget 1s: SA H=240–584, median=340; Tabu H=232–336, median=280. Cả hai chỉ đạt 0/10 tuple tham chiếu, dù 20/20 allocations vẫn feasible.
- Size 20, budget 10s: SA đạt tuple tham chiếu 10/10; Tabu đạt 8/10. Tabu seeds 45 và 51 còn (168,790), so với tham chiếu (160,800). Mức cost=790 không thắng vì H cao hơn.
- Checkpoint hai run Tabu này ghi health phase khoảng 6.998s kết thúc ở H=168; cost phase khoảng 2.999s khóa H đó. Seed search chỉ khoảng .003s. Cơ chế chia thời gian/khóa H đúng plan; giới hạn là search chưa đạt H tốt nhất trong phần budget health.
- Size 20, budget 30s: cả SA và Tabu đạt (160,800) ở 10/10 seeds trong matrix gốc. Biện pháp xử lý cho so sánh offline: loại cấu hình 1s của cả hai và 10s của Tabu khỏi cấu hình kỳ vọng khớp baseline ở size này; giữ preset thuật toán đã duyệt.

Kiểm tra lặp đã hoàn tất **20/20 runs**, exit 0: mỗi method 10 seeds, tất cả FEASIBLE với final (160,800), initial (800,0), ΔH=640 và proof=false. Thư mục matrix-recheck sao chép nguyên dataset/manifest và 340 checkpoint không thuộc nhóm kiểm tra, chỉ chạy lại 20 keys; có recheck-provenance.json. 340 records sao chép giữ nguyên byte hash. Đã kiểm lại checksum và evaluator cho 20 run mới. Đây là 20 lần đo bổ sung, không phải một matrix 360 lần độc lập.

| Method, size20, budget30s | Tuple đúng / fresh runs | Runtime p50 / p95 s | First feasible p50 / p95 s | Seed runtime p50 / p95 s | Steps min–max |
|---|---:|---|---|---|---|
| sa | 10/10 | 30.000767 / 30.001306 | 0.002550 / 0.031416 | 0.003132 / 0.032630 | 85294–90706 |
| tabu | 10/10 | 30.000688 / 30.000936 | 0.002352 / 0.003487 | 0.002890 / 0.004050 | 91325–96750 |

Tổng runtime method gốc + đo lại = 3062.375342 giây (51.04 phút), dưới 82 phút solver time được cho phép. Ở budget30s, mỗi heuristic có 20/20 quan sát khớp tuple qua hai lượt trên cùng dataset. Đây là kiểm tính lặp của cấu hình đủ thời gian trên bộ cố định; chưa chứng minh hội tụ chung hoặc SLA. Preset/code giữ nguyên; chính sách so sánh offline dùng30s cho heuristic size20 và lưu cả các run ngắn không đạt ở matrix gốc.

Budget là giới hạn mềm: validation/setup cuối vẫn được tính vào runtime. Cả 180 heuristic runs gốc có deadline_exceeded=true; overrun lớn nhất 0.005846 giây. CP-SAT/SCIP không có overrun. Giữ nguyên flags; không suy deadline cứng từ các con số này.

## Quyết định sau review

Đủ 360 runs để so sánh trong phạm vi ba fixture mô phỏng đã đóng băng. CP-SAT có bằng chứng tối ưu, score ổn định trên mọi seed/budget và runtime thấp nhất trong lượt này; chốt làm baseline mặc định cho **offline M2** trên phạm vi ba sizes đã đo. Giữ budget thuật toán 1s cho baseline offline này: 30/30 runs của budget1s đạt proof, runtime max0.028941s. Đây là cap thuật toán của thí nghiệm. SCIP giữ vai trò đối chiếu; SA/Tabu chưa cho lợi thế chất lượng/thời gian ở bộ này.

Chưa chọn solver production hoặc thời gian chờ UI/SLA. Ba sizes là replica từ một priority_trap, gồm các cohort rời nhau với budget tổng; không đại diện tập topology cạnh tranh nguồn lực hoặc dữ liệu thực. 10 seeds không thay thế nhiều bài toán độc lập. Cần tập đánh giá ngoài tuning và tải deployment trước quyết định đó.

## Kiểm tra cuối và Git

- Chạy lại sau matrix: `python -m pytest app/optimize/tests tests/test_optimize -q`: 220 pass, 3 SWIG DeprecationWarnings.
- `ruff check .`: pass; `black --check .`: 139 Python files đạt, bỏ qua notebook do thiếu Jupyter dependency; `lint-imports`: 2 contracts kept, 0 broken.
- `mypy`: vẫn fail 39 lỗi trong 13 file serving vì thiếu dependency và lỗi decorator liên quan. Không tuyên bố toàn bộ CI đạt.
- Hash notebook, plan, `.gitignore` và hai AGENTS.md giữ nguyên so với trước lượt này. Index vẫn chỉ có hai AGENTS.md stage xóa; chưa stage thêm, commit hoặc push M2.
- Trong lượt review/matrix này chỉ cập nhật README, báo cáo này và comment mô tả config-m2.yaml; code/preset thuật toán không đổi so với bản được kiểm thử trước matrix.

## Artifact và replay

- Matrix gốc: `data/processed/staffing-m2/matrix/{dataset.json,manifest.json,runs/,report.json,analysis.json}`.
- Kiểm tra lặp: `data/processed/staffing-m2/matrix-recheck/`; giữ riêng kết quả gốc và provenance các run đo lại.
- Resume dùng config-m2.yaml, `--benchmark --resume --out data/processed/staffing-m2/matrix`. Đổi code/config/backend/commit cần output directory mới.
- Data/runtime/checkpoint nằm trong gitignore. Commit dự kiến chỉ chứa code/tests/config/runner/README/báo cáo cần thiết.

## Smoke trước matrix

Đo ngày 2026-10-15 trên dữ liệu mô phỏng. Chỉ chạy smoke được chọn: 1 scenario, replicas=1, solver_seed=42, budget=1 giây/method. Tại lượt smoke này matrix 360 runs chưa thực thi; xem kết quả matrix ở trên.

### Dữ liệu và môi trường

- Dataset hash: `313cf212db93c0ba8a3ceaa4a599c4e9de7a3c7a3586a625c5fcadc400b3f437`.
- Scenario hash: `e09294e7b4a5623239bd238082fac13e5d3ba5e03287b2d30f221eda921fc6b9`.
- data_seed=20261014; order_seed=20261015; profile priority_trap, demand/budget/available=100%.
- Python 3.13.16; OR-Tools 9.15.6755; Pydantic 2.14.1; SCIP 10.0.0 [LP solver: SoPlex 8.0.0].
- Source: nhánh feature/staffing-mvp-m2 trên M1 b2fa400, chưa commit; manifest giữ hash từng file optimize/runner đang dùng.
- SCIP: threads=1; integrality/feasibility/objective tolerance=1e-6; absolute/relative gap=0. Preset SA/Tabu đầy đủ trong config-m2-smoke.yaml và manifest.

### Kết quả thực

Hoàn tất 4/4; pending=0; errors=0. Evaluator xác nhận cả bốn phương án khả thi.

| Method | Status | Weighted unmet | Cost VND | Runtime s | First feasible s | Deadline exceeded | Search steps |
|---|---|---:|---:|---:|---:|---|---:|
| cp_sat | OPTIMAL | 8 | 40 | 0.003419 | 0.002864 | False | None |
| sa | FEASIBLE | 8 | 40 | 1.000091 | 0.000408 | True | 38973 |
| scip | FEASIBLE | 8 | 40 | 0.012797 | None | False | None |
| tabu | FEASIBLE | 8 | 40 | 1.000113 | 0.022833 | True | 40198 |

SA và Tabu có initial (weighted unmet, cost)=(40,0), final=(8,40): health_improvement=32; cost_improvement=None vì health thay đổi. Mỗi run tự trả chi phí tìm seed feasibility CP-SAT, không dùng seed đã optimize.

Mỗi method chỉ có một quan sát: p50=p95=runtime trong bảng, observed=1/missing=0. First-feasible: CP-SAT/SA/Tabu observed=1/missing=0; SCIP observed=0/missing=1 (final_only, không suy từ runtime). SA/Tabu vượt deadline rất nhỏ do validation/overhead; report giữ cờ thực đo. Không dùng smoke để chọn solver hoặc tuyên bố SLA.

CP-SAT báo OPTIMAL theo semantics M1. SCIP raw OPTIMAL được chuẩn hóa FEASIBLE, proven_optimal=false, integer lower bound/gap=None. Tests oracle chỉ kiểm bài nhỏ đã enumerate, không cấp proof cho bài khác.

### Kiểm tra và replay

- 220 tests pass: `python -m pytest app/optimize/tests tests/test_optimize -q`; có 3 SWIG DeprecationWarnings.
- `ruff check .`, `black --check .`, `lint-imports`: pass. Black bỏ qua notebook vì thiếu dependency Jupyter.
- `mypy`: fail 39 lỗi trong 13 file serving do thiếu fastapi/starlette/httpx/psycopg/cryptography và lỗi decorator kéo theo; không thay serving hoặc cài thêm dependency ngoài M2.
- CLI M1 replay exit 0 vào data/processed/staffing-m2/m1-replay; giữ config.yaml và RESULTS.md M1.
- Smoke resume exit 0, không gọi run mới khi cả 4 checkpoint đã hoàn tất. Tests kiểm interruption 2/4, resume phần thiếu, ERROR không retry, checksum/manifest/lock và file tmp.

Artifact local (gitignored): `data/processed/staffing-m2/smoke-final/{dataset.json,manifest.json,report.json,runs/}`. Lệnh replay/resume trong README; code/config/backend thay đổi cần output directory mới.

Lượt smoke chưa chạy matrix dài, HTTP/Layer 3 hoặc dữ liệu thật. Aggregate staffing không chứng minh roster từng người hoặc hiệu lực phòng dịch.

Review cuối phát hiện lỗi mất seed khi heuristic ném lỗi; đã sửa để giữ incumbent làm chẩn đoán với status ERROR. Hai tests SA/Tabu fail trước sửa rồi pass; thêm 15 cases raw u/z/row/objective và lỗi phase 2 giữ incumbent. Smoke cuối chạy lại trên source sau sửa, resume không chạy thêm run.
