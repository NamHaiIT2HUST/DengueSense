# Staffing MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Có một chương trình offline nhận scenario phân bổ nhân sự, tạo phương án có kiểm chứng hard constraints, ưu tiên đáp ứng workload rồi giảm chi phí, và báo metrics để chọn thuật toán.

**Architecture:** Logic ở app/optimize; schema đầu vào dùng Pydantic đã có, evaluator độc lập dùng làm nguồn chấm chung. CP-SAT là bản đầu, MILP/SCIP và SA/Tabu là đối chứng sau; experiment runner dùng chung scenario và evaluator. Chưa đổi HTTP contract, gọi forecast, làm roster cá nhân, frontend hoặc GenAI trong milestone này.

**Tech Stack:** Python 3.13; OR-Tools >=9.11,<10.0, Pydantic >=2.9,<3.0, pytest và PyYAML trong requirements.txt; stdlib cho random, JSON, timing và enumeration. Không thêm dependency.

**Spec:** [Proposal §7.4–7.6](2026-10-09-layer2-optimize-research-proposal.md). Plan này hiện thực subset staffing aggregate; P2 hiệu lực phòng dịch và roster đầy đủ là các milestone riêng.

**Trạng thái:** draft để review, chưa phải lệnh thực thi. Các lựa chọn interface/benchmark dưới đây là đề xuất kỹ thuật cho MVP; giá trị fixture không phải định mức được cơ quan y tế duyệt.

## Global Constraints

- “Tỉnh phân bổ trước, cơ sở triển khai sau”; first slice có một scope, một budget owner, nhiều nơi nhận, một kỳ kế hoạch được ghi bằng period_id.
- Nhân sự theo nhóm không chồng nhau, đồng nhất kỹ năng/khả dụng; mỗi người chỉ được tính vào một assignment trong kỳ. Aggregate feasible chưa chứng minh roster cá nhân khả thi.
- Hard constraints: nguồn lực sau commitment/reserve; qualification, tuyến/scope được phép, budget, floor, capacity và assignment locked. Không dùng penalty để cho phép vi phạm.
- Objective gồm hai phase: weighted unmet workload trước, incremental cost sau. Fairness mục tiêu nâng cao/churn để milestone sau; giữ các floor/commitment bảo vệ đã khai báo.
- Không báo “ca tránh được” từ workload coverage. priority và hours_per_person chưa được xác minh phải có assumption_id và nhãn simulated.
- “Headcount không bằng nhân sự sẵn sàng”; committed_people và reserve_people là input bắt buộc, không ngầm mặc định 0.
- Giả lập phải có nguồn/assumption/version/seed; source bị chặn/chưa QA không được coi là đã hiệu chỉnh bằng dữ liệu thật.
- Layer 1, code/contract legacy, notebook đang sửa và dữ liệu đã công bố giữ nguyên. Không gửi email, chạy migration, deploy, commit/push trừ khi có yêu cầu rõ.
- Phân biệt INFEASIBLE, UNKNOWN, MODEL_INVALID và ERROR; plan=None nếu chưa có incumbent hợp lệ. Không fallback sang một plan giả.
- Giữ report theo phase: incumbent, best bound, absolute/relative gap, tolerance và proof. Chỉ gọi toàn bộ lexicographic optimum khi hai phase có bằng chứng tối ưu nguyên theo §2 và validator đạt; đạt gap tolerance khác 0 không tự tạo proof exact.
- Milestone này chỉ nghiên cứu/offline; không dùng scenario simulated để phát hành lệnh vận hành thật.

## Review Focus

1. Hai pool thực chất chứa cùng người có thể làm tăng supply giả: Task 1 nêu invariant dữ liệu; Task 2 sinh cohort rời nhau và kiểm tổng; intake dữ liệu thật cần chứng minh membership/partition.
2. Một nhóm nhiều skills bị dùng hai lần: Task 1/3/4/5 kiểm tổng assignment trên group, không trên từng skill riêng.
3. Nghiệm rẻ hơn nhưng thiếu workload ưu tiên hơn: Task 1/3/4/5 dùng fixture priority-trap và cùng objective tuple.
4. Phase 2 timeout/lỗi làm mất incumbent tốt của phase 1: Task 3/4 kiểm giữ nghiệm đã được validator xác nhận, không gắn proof giả.
5. Case input hợp lệ nhưng floor/locked/budget xung đột: Task 1/3/4/6 phân biệt infeasible policy với invalid JSON và chưa tìm được nghiệm.

---

## 1. Mốc bàn giao và phần còn phải phân tích

**M1 — chạy được CP-SAT offline:** Tasks 1–3 và runner tối thiểu của Task 6. Bàn giao gồm fixture/scenario, input validation, phương án CP-SAT, validator, brute-force oracle nhỏ và JSON report. Đây là mốc MVP đầu tiên, không phải rollout pilot.

**M2 — đánh giá thuật toán:** Tasks 4–6 hoàn thiện SCIP/SA/Tabu, đối chiếu SCIP với oracle M1 và benchmark có seed/time budget. Chọn solver và SLA sau khi có số đo, không chọn trước chỉ vì tên thuật toán.

**M3 — API/web và pilot preparation:** plan riêng sau M1/M2; cần PR contract, auth/version/idempotency, async job nếu thời gian đo yêu cầu, lưu plan và màn hình preview/constraints/compare. Các lỗi integration legacy là phụ thuộc cần xử lý bởi owner backend/infra.

Trước triển khai cần review ba lựa chọn kỹ thuật: (a) group aggregate và một kỳ là scope đầu; (b) unmet-hours là proxy sức khỏe; (c) CP-SAT có validator/report trước rồi mới mở rộng thuật toán. Không cần chờ tên tỉnh để unit test, nhưng không tự điền đối tác, giá, availability hay policy vận hành.

## 2. File map và interface chung

Các đường dẫn dưới đây tính từ repo root.

| File | Trách nhiệm |
|---|---|
| ai-service/app/optimize/__init__.py | Package marker, không dựng registry/factory. |
| ai-service/app/optimize/staffing.py | Pydantic DTO, input validation và các record kết quả. |
| ai-service/app/optimize/evaluate.py | Feasibility/objective độc lập với solver. |
| ai-service/app/optimize/scenarios.py | Tạo scenario simulated từ config/assumptions đã ghi; không tự fetch mạng. |
| ai-service/app/optimize/cp_sat.py | HStaff model và solve hai phase trên CP-SAT. |
| ai-service/app/optimize/milp.py | Cùng model/objective trên MPSolver/SCIP. |
| ai-service/app/optimize/heuristics.py | SA/Tabu với move trên số lượng assignment, dùng evaluator chung. |
| ai-service/tests/test_optimize/ | Test boundary, evaluator, generation, solver, oracle, heuristic và runner. |
| ai-service/experiments/exp_017_staffing_mvp/{config.yaml,run.py,RESULTS.md} | Runner/benchmark và kết quả thực khi đã chạy. ID 017 chưa tồn tại tại lúc lập plan; kiểm lại trước tạo. |
| docs/data-sources/staffing.md | Note nguồn/QA/licence, tách dữ liệu thật khỏi giả định. |
| ai-service/README.md | Lệnh chạy offline, trạng thái và giới hạn mới khi milestone chạy được. |
| ai-service/.importlinter | Bổ sung app.optimize không import app.serving. |

### DTO được đề xuất cho Task 1

Tất cả số đếm/giờ/VND/priority là integer strict; bool, NaN/Infinity và float giả integer không được nhận vào các trường đó. IDs là chuỗi không rỗng. Không thêm tùy chọn multiperiod/multi-budget lúc này.

- StaffGroup: group_id, source_site_id, skills, total_people, committed_people, reserve_people, hours_per_person. available_people được tính bằng total−committed−reserve.
- StaffNeed: need_id, site_id, role_id, demand_hours, priority, min_people, max_people.
- StaffArc: group_id, need_id, cost_vnd. Arc tồn tại biểu thị tuyến/phạm vi được khai báo cho phép; qualification vẫn phải kiểm riêng.
- Allocation: group_id, need_id, people.
- StaffingScenario: schema_version="1", scenario_id, scope_id, period_id, budget_vnd, groups, needs, arcs, locked_allocations, data_source, policy_verified, assumption_ids, source_refs.
- Score: weighted_unmet_hours, total_unmet_hours, total_cost_vnd; tất cả chấm bằng số nguyên gốc.
- Evaluation: feasible, violations và score; score=None khi phương án vi phạm hard rules.
- PhaseSummary: objective_name, status, objective_value (integer từ evaluator), best_bound (float raw hoặc None), integer_lower_bound (integer hoặc None), absolute_gap, relative_gap, tolerance (absolute/relative), proven_optimal, proof_basis (zero_gap_solver/integer_bound/none), raw_status, runtime_s, time_to_first_feasible_s, first_feasible_observation (callback/validated_initial/final_only/none).
- SeedSearchSummary: source, status, runtime_s, time_to_first_feasible_s, first_feasible_observation; None khi phương pháp không có bước tìm seed.
- SolveResult: solver_name, status, proven_optimal, allocations (list hoặc None), evaluation, phases, runtime_s, time_limit_s, deadline_exceeded, time_to_first_feasible_s, first_feasible_observation, seed_search (SeedSearchSummary hoặc None), seed, error_code (chuỗi hoặc None).
- Status chuẩn hóa: OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, MODEL_INVALID, ERROR; PhaseSummary thêm NOT_RUN. raw_status giữ nguyên trạng thái backend. Result ERROR có thể giữ allocation đã validate để chẩn đoán nhưng không được coi là run thành công.

### Lock và nguồn lực bảo vệ

Mỗi row locked_allocations là đẳng thức `assignment[group_id, need_id] == people` theo HStaff2, kể cả people=0; không phải mức tối thiểu. Cell không xuất hiện trong allocations được hiểu là 0; cell không xuất hiện trong locked_allocations được tự do tối ưu. Reject duplicate lock keys kể cả cùng giá trị; references phải tồn tại và tuyến phải được khai báo. Lock dương trên tuyến không đủ skill là xung đột policy, solver có thể chứng minh INFEASIBLE; lock 0 trên tuyến đó vẫn thỏa.

Commitment/reserve là người đã loại khỏi pool huy động, hai phần rời nhau. Locked assignment thuộc chính pool còn lại và vẫn tính đúng một lần vào supply, workload và cost. Không trừ locked_people lần nữa khi tính available. Intake phải xác nhận phần commitment không chứa lại người đang lock; dữ liệu aggregate không tự phát hiện được trùng danh tính.

### Giới hạn biểu thức và bằng chứng nguyên

M1 dùng giới hạn bảo thủ `L = 2**53 - 1` cho các số nguyên không âm và envelope biểu thức; đây là giới hạn hỗ trợ MVP nhỏ hơn int64, để báo cáo double không mất đơn vị nguyên. Tính preflight bằng Python integer trước khi tạo model. Với mỗi cell hợp lệ đặt `U_gn = min(available_g, max_people_n)`, cell thiếu skill có U=0; không dùng budget/floor/lock để che overflow bằng cách thu hẹp envelope.

- Kiểm từng tích `hours_g * U_gn`, `cost_gn * U_gn`, `priority_n * demand_n`; tổng coverage `C_n = sum_g hours_g * U_gn`; tổng cost `sum_gn cost_gn * U_gn`; tổng weighted shortage `sum_n priority_n * demand_n` đều ≤ L.
- Kiểm cả tổng domain của row supply/cap `sum U_gn`, `committed+reserve`, và envelope `abs(offset) + sum(abs(coefficient) * max(abs(lb), abs(ub)))` của mọi biểu thức được phát ra, kể cả biểu thức max/shortfall và hàng khóa objective phase 2. Không chỉ kiểm từng field. Reject vượt miền hỗ trợ bằng ValueError có tên biểu thức; không clamp, scale âm thầm hoặc gắn INFEASIBLE.
- Sau build, gọi validation của CP-SAT trước solve; lỗi trả MODEL_INVALID kèm chẩn đoán. Preflight bảo thủ không thay thế model validation. Kiểm trường hợp đúng L, L+1, từng field hợp lệ nhưng tích/tổng vượt L, và tổng có thể vượt int64.
- Hai objective không âm, nguyên, không scale/offset. CP-SAT M1 đặt cả absolute_gap_limit và relative_gap_limit bằng 0. Raw OPTIMAL chỉ tạo `proof_basis=zero_gap_solver` khi có incumbent hợp lệ, objective khớp evaluator và cấu hình integer/zero-gap đúng; feasibility-only seed không được nhận proof tối ưu lexicographic.
- Với lower bound double B hữu hạn của minimization, chỉ chuyển khi backend bảo đảm bound hợp lệ và B nằm trong [-L,L]. Dùng hướng bảo thủ `integer_lower_bound = max(0, floor(nextafter(B, -inf)))`; không round/ceil trực tiếp hay epsilon tùy ý. Quy tắc cố ý có thể mất một đơn vị ở B nguyên. Bound thiếu, ngoài miền hoặc không có bảo đảm → None. Test chuyển bound: B=8.0 → 7, B=7.9 → 7, B=0.0 → 0; B=NaN/Infinity/ngoài miền → None; lower bound=9 với I=8 → ERROR, không clip về 8. Nếu integer_lower_bound > incumbent nguyên I, báo ERROR/BOUND_INCONSISTENT; nếu bằng I thì có proof integer_bound. Không cần suy proof từ bound float nếu đã có zero_gap_solver proof.
- M2/SCIP giữ raw bound và tolerance để báo cáo nhưng không bật proof integer_bound chỉ dựa vào bound float khi chưa kiểm được bảo đảm sai số của backend. Raw OPTIMAL với tolerance chưa đủ bằng chứng exact. Không dùng một epsilon chung để nâng bound thành proof.
- Gap báo riêng theo phase: nếu integer_lower_bound có giá trị, absolute_gap = I − integer_lower_bound, relative_gap = absolute_gap / max(1, abs(I)); còn lại None. Đây là gap bảo thủ, có thể khác raw backend và có thể còn 1 dù zero_gap_solver đã chứng minh tối ưu; proof_basis giải thích khác biệt. Bound của phase cost chỉ có ý nghĩa tại health level đã khóa.

Nguồn kiểm semantics: [OR-Tools model proto](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.proto) và [gap parameters](https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto). Khi triển khai ghi phiên bản package thực dùng; URL stable có thể thay đổi.

### Tổng hợp status hai phase

Phase 2 khóa **bằng** weighted shortage nguyên của incumbent phase 1. Chỉ thay incumbent bằng candidate qua evaluator, giữ cùng health và cost không tăng; bằng điểm có thể giữ incumbent cũ. `proven_optimal` toàn run là AND của proof hai phase, trừ run lỗi luôn false. Bảng dùng status đã chuẩn hóa; raw OPTIMAL thiếu proof được chuẩn hóa FEASIBLE.

| Phase 1 | Phase 2 | Status toàn run / proof | Incumbent và hành động |
|---|---|---|---|
| OPTIMAL có proof | OPTIMAL có proof | OPTIMAL / true | Best đã validate tại health khóa. |
| FEASIBLE chưa proof | OPTIMAL hoặc FEASIBLE | FEASIBLE / false | Giữ best; tối ưu cost có điều kiện không chứng minh health tối ưu. |
| OPTIMAL có proof | FEASIBLE | FEASIBLE / false | Giữ best; thiếu proof cost. |
| Có incumbent | UNKNOWN hoặc NOT_RUN | FEASIBLE / false | Giữ incumbent tốt nhất trước đó; NOT_RUN khi hết budget. |
| UNKNOWN, không incumbent | NOT_RUN | UNKNOWN / false | allocations=None; không chạy phase 2. |
| INFEASIBLE, không incumbent | NOT_RUN | INFEASIBLE / false | Chỉ trường hợp này chứng minh scenario vô nghiệm. |
| Có incumbent hợp lệ | INFEASIBLE | ERROR / false | Giữ incumbent để chẩn đoán; error_code=PHASE2_INFEASIBLE_AFTER_VALID_INCUMBENT. Đây là lỗi model/numerics/adapter vì incumbent là witness của phase 2. |
| MODEL_INVALID hoặc ERROR | NOT_RUN | Cùng lỗi / false | Không tạo phương án thay thế. |
| Có incumbent | MODEL_INVALID hoặc ERROR | Cùng lỗi / false | Giữ incumbent để chẩn đoán; ghi error_code. |

Candidate không qua evaluator, health lệch khóa hoặc status mâu thuẫn incumbent → ERROR, giữ last valid incumbent, không che bằng FEASIBLE. Nếu callback đã ghi incumbent hợp lệ nhưng backend cuối báo UNKNOWN, giữ incumbent và chuẩn hóa FEASIBLE; nếu báo INFEASIBLE thì ERROR vì mâu thuẫn witness. Hai trường hợp này cũng áp dụng phase 1.

### Thời gian và metrics

Dùng monotonic clock. `time_limit_s > 0` hữu hạn; t0 ở đầu lời gọi solve, trước validation/build. Deadline=t0+time_limit_s dùng chung validation, build, hai phase, callbacks và final evaluation; mỗi solve chỉ nhận remaining budget. Không mở phase mới khi hết giờ. Final validation/report vẫn phải hoàn tất nếu solver trả sát deadline: ghi runtime_s thực và deadline_exceeded, không tuyên bố hard realtime. I/O đọc input, sinh scenario và ghi JSON ngoài budget thuật toán.

Phase runtime_s đo từ lúc bắt đầu chuẩn bị phase (build/thêm ràng buộc) tới khi xử lý xong kết quả; NOT_RUN runtime=0. Tổng runtime còn chứa preflight/overhead nên không suy bằng tổng phase. First-feasible đo thời điểm hoàn thành validation của candidate đầu tiên, qua callback; lưu khoảng thời gian từ t0 của run, và từ đầu phase cho PhaseSummary. Phase 2 đã có validated incumbent làm witness tại lúc bắt đầu nên phase first-feasible=0, observation=validated_initial. Nếu chỉ thấy nghiệm khi final return, time_to_first_feasible_s=None, observation=final_only; không lấy tổng runtime thay thế. Không có nghiệm: None/none. Callback overhead thuộc runtime.

Ở M2, runner bắt đầu một t0 chung trước seed search; seed_search ghi source=cp_sat_feasibility cùng status/runtime/first-feasible thực đo, heuristic nhận remaining budget. Top-level runtime và first-feasible tính từ t0 chung; first-feasible lấy sự kiện validated seed nếu đo được, không cộng seed runtime vào một metric chưa đo. Heuristic gọi riêng đo first-feasible từ đầu lời gọi đến khi xác nhận initial xong, observation=validated_initial; không gán 0 nếu validation đã tốn thời gian. Seed không tìm được nghiệm thì không chạy heuristic, giữ status seed, allocations=None; lỗi phải lưu rõ. Deadline_exceeded tính trên cả seed+search+validation.

Test timing dùng fake clock/callback: kiểm thời gian phase, seed, remaining budget, NOT_RUN và null/final_only. Báo p50/p95 time-to-first-feasible chỉ trên các lần thực đo, kèm số run thiếu/censored; không biến null thành 0.

Không viết hand-made type cho API công khai: các DTO này chỉ dùng offline/domain. Khi nối API sẽ thiết kế contract riêng và sinh type phía gọi.

### Signatures được các task dùng

~~~python
# staffing.py
def validate_scenario(scenario: StaffingScenario) -> None: ...
# evaluate.py
def evaluate_allocation(
    scenario: StaffingScenario, allocations: list[Allocation]
) -> Evaluation: ...
# scenarios.py
def generate_scenarios(
    profile: dict, seed: int, count: int
) -> list[StaffingScenario]: ...
# cp_sat.py / milp.py, cùng signature
def solve_staffing(
    scenario: StaffingScenario, time_limit_s: float, seed: int
) -> SolveResult: ...
# cp_sat.py: seed feasibility, không tối ưu health/cost
def find_feasible_seed(
    scenario: StaffingScenario, time_limit_s: float, seed: int
) -> SolveResult: ...
# heuristics.py
def improve_sa(
    scenario: StaffingScenario, initial: list[Allocation],
    time_limit_s: float | None, seed: int, *, max_steps: int | None = None
) -> SolveResult: ...
def improve_tabu(
    scenario: StaffingScenario, initial: list[Allocation],
    time_limit_s: float | None, seed: int, *, max_steps: int | None = None
) -> SolveResult: ...
~~~

Input malformed/type/reference lỗi → Pydantic validation error hoặc ValueError có trường/ID, không gọi solver. Policy có giá trị hợp lệ nhưng không đồng thời thỏa → INFEASIBLE khi solver chứng minh; chưa chứng minh thì UNKNOWN. Không dùng ValueError để che một bài toán thực sự infeasible.

## 3. Fixture và objective phải khóa trước khi code

Tạo JSON fixture thủ công nhẹ trong tests/test_optimize/fixtures, tất cả mang data_source="simulated", policy_verified=false, assumption_ids=["unit-test-fixture"]; không claim đã hiệu chỉnh theo WHO.

**priority_trap.json:**

- G1: total=4, committed=1, reserve=1, hours_per_person=8, skills=["vector_control"] → chỉ 2 người được huy động.
- G2: total=2, committed=0, reserve=0, hours_per_person=8, skills=["clinical"]; không được thay G1 cho vector_control.
- N1: site S1, vector_control, demand=16 giờ, priority=2, min=0, max=2; cost G1→N1=20 VND/người.
- N2: site S2, vector_control, demand=8 giờ, priority=1, min=0, max=2; cost G1→N2=10 VND/người.
- Budget=40; locked_allocations=[]; chỉ các tuyến khai báo và người đủ kỹ năng mới dùng được.
- Optimum: G1→N1=2; weighted unmet=8, total unmet=8, cost=40. Phương án chia 1+1 rẻ hơn (30) nhưng weighted unmet=16, nên không được chọn làm tốt hơn.

**cost_tie.json:** một need 8 giờ, max=1; hai group qualified mỗi group available=1, h=8, cost 20 và 10. Optimum coverage=0 thiếu, cost=10.

**zero_cost.json:** budget=0, qualified available=1, h=8, need=8, min=0/max=1, arc cost=0. Cho phép cover; không quy định budget=0 luôn phải không phân bổ.

**infeasible_floor.json:** priority_trap nhưng N1 min=3/max=3. Chỉ có 2 người qualified khả dụng → infeasible.

**locked_expensive.json:** cost_tie nhưng khóa 1 người từ group đắt vào need. Nghiệm phải giữ lock và cost=20; budget=10 thì infeasible.

**locked_exact.json:** priority_trap, budget=100, N1 demand=32/max=4, khóa G1→N1=1; G1 vẫn available=2. Nghiệm phải giữ N1 đúng 1 và còn 1 người cho N2, cost=30; không được tăng N1 hay trừ lock khỏi supply lần hai. Biến thể khóa G1→N1=0 phải giữ 0 dù còn demand; lock không tồn tại cho phép cell được tối ưu. Evaluator kiểm riêng tăng, giảm, thiếu row lock dương, lock zero, và duplicate lock.

Giá nhỏ chỉ phục vụ arithmetic unit test, không phải giá huy động nhân sự thực. Helper pytest fixture case(name: str) trả StaffingScenario từ file; định nghĩa tại tests/test_optimize/conftest.py trong Task 1.

### Objective/evaluator

- available_g = total_g − committed_g − reserve_g.
- assigned_g = tổng people của group trên tất cả needs, không tách theo skill.
- coverage_need = tổng hours_per_person_g × people_g,need.
- shortfall_need = max(0, demand_hours_need − coverage_need).
- Objective tuple = (Σ priority_need × shortfall_need, total_cost_vnd), so lexicographic.
- Không thưởng vượt demand; thừa người vẫn có cost, cap và supply constraint.
- Tính bằng integer gốc; báo cả weighted và unweighted shortage. Không đưa estimated_cases_prevented vào result.

## 4. Task-by-task

### Task 1: Data contract và evaluator độc lập

**Files:** tạo staffing.py, evaluate.py, __init__.py, tests/test_optimize/conftest.py, fixtures JSON và test_staffing.py; sửa .importlinter.

**Interfaces:** tạo DTO/signatures §2, case fixture và evaluate_allocation. Các solver không tự định nghĩa một score khác.

- [ ] **Step 1 — viết test fail:** fixture loading qua DTO; test_eval_priority_trap assert feasible, score=(8,8,40); phương án 1+1 có weighted unmet=16/cost=30.
- [ ] **Step 2 — chạy test:** từ ai-service/, python -m pytest tests/test_optimize/test_staffing.py -q; trước implementation phải fail do module/hành vi chưa có.
- [ ] **Step 3 — viết DTO/validate/evaluate:** strict numeric/extra="forbid"; unique IDs và unique group/need arc; references tồn tại; skills/tuyến hợp lệ cho assignment; tổng supply sau protection; min/max; lock; budget; reject duplicate assignment rows. Không suy ra qualification từ job title.
- [ ] **Step 4 — thêm ca boundary:** âm/bool/float/NaN/Infinity, total nhỏ hơn commitment+reserve, reference lạ, duplicate IDs/rows, sai skill, thiếu arc, dùng >2 G1 trên nhiều needs, bỏ lock, floor thiếu, zero_cost. Params test assert đúng violation ID/ValueError, không chỉ “có exception”.
- [ ] **Step 5 — kiểm lại:** toàn bộ test_staffing xanh và import-linter không cho app.optimize import app.serving. Áp dụng envelope L và proof conversion tại §2; test từng tích/tổng vượt miền dù field hợp lệ, đúng biên/L+1, bound NaN/Infinity, ngoài miền, sát integer ở cả hai phía và B mâu thuẫn I. Lock exact/zero/không trừ supply hai lần phải có test evaluator.
- [ ] **Step 6 — chuẩn bị review/commit:** diff chỉ trong files task; commit message đề xuất feat(ai-service): add staffing scenario and independent evaluator. Người dùng commit, trừ khi giao rõ.

### Task 2: Nguồn dữ liệu và scenario simulated có provenance

**Files:** tạo docs/data-sources/staffing.md, scenarios.py, test_scenarios.py; tạo config.yaml của exp_017 trong task runner hoặc phần profile của task này.

**Interfaces:** generate_scenarios(profile, seed, count) trả DTO hợp lệ; profile chứa size/ranges/assumptions/source registry explicit. Không có downloader tự chạy khi import/test.

- [ ] **Step 1 — làm QA nguồn:** cập nhật trạng thái D01–D08 của proposal bằng nguồn mở được; nếu lấy số thực phải lưu checksum, năm/địa giới, bảng/trang, đơn vị, coverage và điều kiện tái sử dụng. Nếu vẫn bị chặn, ghi rõ và giữ numerical anchors là chưa có, không giả số.
- [ ] **Step 2 — viết test fail:** test_generate_repeatable assert cùng profile/seed cho cùng model_dump(); test_generated_data_never_claims_real assert simulated + policy_verified=false + assumption_ids không rỗng.
- [ ] **Step 3 — chạy test:** python -m pytest tests/test_optimize/test_scenarios.py -q; xác nhận fail trước generator.
- [ ] **Step 4 — viết generator nhỏ:** stdlib random.Random(seed), profile gồm base_fixture (một JSON §3), replicas (integer ≥1), demand_percent_choices, budget_percent_choices, available_percent_choices (các list integer ≥0), source_refs và assumption_ids. Nhân bản fixture với ID group/source/need có suffix riêng; giữ skills/priority/floor/cap/lock, map lại references. Lấy tỷ lệ bằng RNG; demand ceil theo phần trăm, budget/available floor; total mới=available mới+committed+reserve. Budget gốc nhân replicas trước khi scale; không thêm tuyến chéo replica trong bản đầu. Đây là stress perturbation của fixture, không phải mẫu ngẫu nhiên đại diện bệnh viện VN.
- [ ] **Step 5 — kiểm fixtures stress:** có case thiếu skill, floor/lock/budget conflict, qualified supply thấp, zero demand/cost; không cố “sửa” mọi case thành feasible. Config benchmark đầu: replicas=1/5/20, demand choices=50/100/150/200%, budget choices=0/50/100/150%, available choices=50/100/150%; tất cả là giả định research, không giá trị pilot. Các field chưa có nguồn được ghi assumption, không dùng aggregate stats như actual availability; chưa chọn production solver chỉ từ các replica đơn giản.
- [ ] **Step 6 — chạy tests và chuẩn bị review:** test_scenarios xanh; docs QA không tuyên bố truy cập thành công nếu chưa có. Commit đề xuất feat(ai-service): add reproducible staffing scenarios.

### Task 3: CP-SAT hai phase và report đúng proof

**Files:** tạo cp_sat.py, test_cp_sat.py, test_oracle.py; tái dùng evaluate.py. Oracle chỉ ở tests, không tạo solver production.

**Interfaces:** solve_staffing và find_feasible_seed đúng §2. Kết quả allocations phải qua evaluate_allocation trước khi được trả như plan.

- [ ] **Step 1 — viết test fail:** test_cp_sat_prioritizes_health assert priority_trap có weighted unmet=8/cost=40; test_cp_sat_minimizes_cost_after_coverage assert cost_tie cost=10/weighted unmet=0.
- [ ] **Step 2 — chạy:** python -m pytest tests/test_optimize/test_cp_sat.py -q; xác nhận fail trước solver.
- [ ] **Step 3 — build HStaff1–4:** biến assignment nguyên, upper bound theo group/need cap; thiếu eligibility/skill đặt 0; group total capacity, need floor/cap, lock và budget. Shortfall gắn đúng max(0, demand−coverage), không để phụ thuộc một objective đang không minimize nó.
- [ ] **Step 4 — solve phase 1:** minimize weighted shortfall; integer objective, oracle/test gap limits=0, seed khai báo. Giữ incumbent đã validate.
- [ ] **Step 5 — solve phase 2 trong thời gian còn lại:** khóa weighted shortfall ở mức incumbent phase 1, minimize cost; một time budget cho cả run. Không tạo objective bằng một big weight đoán trước.
- [ ] **Step 6 — test status/proof/timing bằng fake solver/clock:** parameterize toàn bộ bảng §2, gồm FEASIBLE→OPTIMAL vẫn FEASIBLE; UNKNOWN giữ incumbent; phase 2 INFEASIBLE thành ERROR và CLI nonzero, không scenario INFEASIBLE. Kiểm callbacks, null/final_only, NOT_RUN, remaining budget và deadline_exceeded; raw OPTIMAL với gap khác 0 không tự nhận proof. Không dùng test wall-time gây flake.
- [ ] **Step 7 — test infeasible/invalid/zero/locks:** floor=3, lock cost vượt budget, zero-cost budget=0, locked_exact và khóa 0 (không tăng/giảm cell), input chưa hợp lệ có semantics đúng. Không trả alloc=[] để che infeasible.
- [ ] **Step 8 — thêm find_feasible_seed:** cùng hard model, không objective health/cost; validate seed. Ghi seed search time/status, không có nghiệm thì không bịa initial.
- [ ] **Step 9 — brute-force oracle M1:** test_oracle.py enumerate mọi vector cell trên miền 0..U bằng itertools.product, giới hạn tối đa 100000 candidates/test và fail rõ nếu fixture vượt; chấm feasibility bằng evaluator, lấy min tuple (weighted_unmet_hours,total_cost_vnd). So CP-SAT với oracle trên priority_trap, cost_tie, zero_cost, locked_exact (lock 1 và 0), infeasible_floor và các biến thể supply/budget nhỏ xác định. Không assert cùng allocation khi nhiều optimum. Assert hand-calculated tuple của fixture trước để tránh evaluator và model cùng sai; assert proven_optimal trên ca hữu nghiệm nhỏ, INFEASIBLE khi oracle không có candidate hợp lệ. Chạy python -m pytest tests/test_optimize/test_cp_sat.py tests/test_optimize/test_oracle.py -q.
- [ ] **Step 10 — kiểm và chuẩn bị review:** tests Task 1–3 và oracle xanh; code không gọi LLM/forecast/backend. Commit đề xuất feat(ai-service): solve staffing with CP-SAT.

Sau Task 3, làm phần runner tối thiểu của Task 6 để có mốc M1 chạy được. Chưa cần chờ toàn bộ heuristic.

### Task 4: MILP/SCIP đối chiếu oracle M1

**Files:** tạo milp.py, test_milp.py; mở rộng test_oracle.py đã có từ M1.

**Interfaces:** solve_staffing cùng input/output/evaluator. Tái dùng oracle M1 để so SCIP, không viết lại enumeration hoặc thêm solver abstraction vào production.

- [ ] **Step 1 — viết test fail:** SCIP phải đạt objective tuple như fixture CP-SAT; test_oracle_matches_both_solvers chấm mọi candidate nhỏ bằng evaluator rồi so optimum tuple.
- [ ] **Step 2 — chạy:** python -m pytest tests/test_optimize/test_milp.py tests/test_optimize/test_oracle.py -q.
- [ ] **Step 3 — viết cùng model trên MPSolver/SCIP:** hai phase, giữ health trước cost, deadline và incumbent như CP-SAT. Thiếu SCIP backend → lỗi rõ, không silently đổi backend.
- [ ] **Step 4 — nguyên hóa và validator:** kiểm solution_value với integrality tolerance trước round; check lại integer allocations. Không lấy objective của model float làm score chung khi validator/score gốc khác.
- [ ] **Step 5 — test:** zero demand, zero cost, min/max/floor conflict, multi-skill pool, locks; bounded enumeration trên số cell/people thực, không 2^số-cơ-sở. Khi nhiều optimum, so score và feasibility, không bắt cùng plan.
- [ ] **Step 6 — chạy lại/prepare review:** CP-SAT/SCIP và oracle đồng ý trên tập nhỏ. Commit đề xuất feat(ai-service): add SCIP staffing comparison.

### Task 5: SA và Tabu Search cải thiện seed khả thi

**Files:** tạo heuristics.py, test_heuristics.py.

**Interfaces:** improve_sa/improve_tabu nhận initial đã validate; trả SolveResult heuristic với proven_optimal=false, bound=None trừ bound reference được runner ghi riêng. Chỉ cho phép một trong time_limit_s hoặc max_steps có giá trị dương; chế độ step dùng time_limit_s=None, đếm mỗi candidate move attempt kể cả rejected/no-op, chia floor(0.7×max_steps) cho health, phần còn lại cost. Kết thúc sớm khi không còn move được phép; không dùng clock để quyết định bước trong chế độ này. Benchmark dùng deadline thực, max_steps=None; cùng seed không bảo đảm cùng số move/kết quả theo wall clock. SolveResult.time_limit_s=None trong chế độ step; runtime vẫn đo, deadline_exceeded=false.

- [ ] **Step 1 — viết test fail:** cả hai không xuất hard violations; cùng seed + max_steps cho cùng allocations/score trong single-process, instrument vòng lặp để assert cùng số move attempts (không so runtime); best score không tệ hơn initial. Invalid initial phải reject.
- [ ] **Step 2 — chạy:** python -m pytest tests/test_optimize/test_heuristics.py -q.
- [ ] **Step 3 — move chung:** thêm/bớt một người hoặc swap/chuyển giữa cell; chỉ giữ candidate evaluator xác nhận feasible, bảo vệ pool/skill/lock/budget. Không thêm general neighborhood framework.
- [ ] **Step 4 — SA:** search active health objective có thể chấp nhận bước tạm kém theo temperature; best dùng tuple (health,cost). Phase cost giữ health threshold tốt nhất đã tìm. Preset research đầu: 70% time cho health, 30% cho cost; T0=max(1, 0.1×objective ban đầu của phase), alpha=0.995 mỗi move; acceptance exp(-delta/T) theo objective phase. Tất cả là preset thử nghiệm có nhãn, chưa được coi tối ưu; tune trên development set, không test cuối.
- [ ] **Step 5 — Tabu:** lưu move ngược, preset tenure=7 accepted moves; aspiration khi cải thiện best feasible. Dùng cùng tỷ lệ thời gian health/cost và threshold với SA; sau 50 moves không cải thiện, thử một move khả thi lấy bằng seeded RNG, vẫn giữ best và mọi hard rules. Preset là đối chứng thử nghiệm, không policy; tabu memory không được thành rule nghiệp vụ.
- [ ] **Step 6 — test regressions:** priority_trap không chọn plan rẻ hơn nhưng health tệ làm best; không dùng G2 clinical cho vector_control; locked_expensive không bị sửa; deadline và no feasible moves vẫn trả initial đúng nhãn.
- [ ] **Step 7 — review:** incremental score chỉ thêm nếu đo thấy cần; trước export luôn recompute bằng evaluator. Commit đề xuất feat(ai-service): benchmark SA and Tabu staffing search.

### Task 6: CLI, benchmark và báo cáo quyết định

**Files:** tạo exp_017_staffing_mvp/run.py và config.yaml; tạo RESULTS.md chỉ sau khi có run thật; tạo test_runner.py; sửa ai-service/README.md khi có lệnh chạy được.

**Interfaces:** run.py dùng DTO/evaluator/generator/solver của Tasks 1–5. M1 hỗ trợ cp_sat trước; M2 thêm scip/sa/tabu. CLI chỉ là entry point nghiên cứu, không handler HTTP.

- [ ] **Step 1 — viết test fail cho runner:** chạy trên fixture cp_sat và thư mục tmp; JSON report có simulated flag, assumptions, đầy đủ timing/seed_search/observation/proof/error_code theo §2 và phase summaries, không có estimated_cases_prevented. Case infeasible không có plan giả.
- [ ] **Step 2 — chạy:** python -m pytest tests/test_optimize/test_runner.py -q.
- [ ] **Step 3 — runner tối thiểu cho M1:** nhận --config và --out, validate config; dùng python -m experiments.exp_017_staffing_mvp.run từ ai-service/. Không ghi vào fixture/test data hoặc notebook.
- [ ] **Step 4 — output:** report.json có input/config hash, data/schema/solver version, seed, status, validated allocation, score và phase metrics. Không ghi raw/processed data vào git. CLI exit nonzero cho invalid input, MODEL_INVALID hoặc ERROR (kể cả còn incumbent chẩn đoán); valid INFEASIBLE/UNKNOWN được lưu và phân biệt.
- [ ] **Step 5 — mở benchmark M2:** cùng scenario/evaluator; time budgets đề xuất 1/10/30 giây, seeds 42–51; đây là ngân sách thử nghiệm, không SLA. Chạy foreground smoke ngắn trước, run dài chạy nền có progress/checkpoint.
- [ ] **Step 6 — seed công bằng:** runner dùng find_feasible_seed cho SA/TS; tính seed search vào cùng total budget của phương pháp, ghi rõ nguồn seed. Không lấy nghiệm đã optimize coverage/chi phí bằng CP-SAT làm initial rồi gọi SA/TS là standalone. Report phân biệt pure solve và heuristic có seed exact.
- [ ] **Step 7 — metrics/analysis:** weighted/unweighted shortfall, protected supply, cost ở cùng health level, feasibility rate, time-to-first-feasible, p50/p95, per-phase incumbent/bound/gap, seed variation; p50/p95 runtime và first-feasible báo riêng, kèm số quan sát/missing theo §2. Quality tuple và gap từng phase, không “global relative gap” của tuple.
- [ ] **Step 8 — đối chiếu/chọn solver:** tiny oracle là mốc proof; bài lớn dùng bounds không phải exact oracle. Chỉ kết luận SA/TS/hybrid có ích khi so cùng budget và scope. Chưa có dữ liệu real thì kết luận chỉ áp scenario simulated.
- [ ] **Step 9 — ghi RESULTS.md:** cấu hình, commit/data source/version, số thực đo, lỗi, hạn chế và đề xuất thời gian chờ/gap. Không chép số performance từ proposal hoặc paper.
- [ ] **Step 10 — cập nhật README/prepare review:** hướng dẫn chạy M1/M2 và cảnh báo aggregate không phải roster; commit đề xuất feat(ai-service): add staffing benchmark runner.

## 5. Môi trường và lệnh kiểm khi được giao thực thi

Tại lúc lập plan, máy chưa có venv của ai-service và chưa tìm thấy python3.13 trong PATH. Không cài gì trong lượt lập plan. Khi được giao triển khai, dựng môi trường Python 3.13 ở ai-service/.venv theo quyền của máy; chỉ cần các dependency hiện có cho staffing/dev, không phải toàn bộ stack ML/R/Jupyter để viết fixture và solve.

Các lệnh dự kiến, chạy từ ai-service/ trong môi trường đúng:

~~~text
python -m pytest tests/test_optimize -q
ruff check app/optimize tests/test_optimize experiments/exp_017_staffing_mvp
black --check app/optimize tests/test_optimize experiments/exp_017_staffing_mvp
lint-imports
python -m experiments.exp_017_staffing_mvp.run --config experiments/exp_017_staffing_mvp/config.yaml --out data/processed/staffing-mvp
~~~

Unit tests chạy first; full suite/CI chỉ sau khi có thay đổi và môi trường đủ. Lint/schema generation của HTTP chưa thuộc milestone này vì không sửa hợp đồng.

## 6. Các plan sau M1/M2

1. **Staffing API contract:** endpoint mới cho staffing, giữ /allocate legacy cho phía gọi đang dùng. Request/response có scope/provenance/units, policy/assumptions, solver quality, error semantics, auth và job lifecycle theo thời gian đo. PR contract riêng; đồng bộ lỗi/types/routing/test. requirements-serving.txt hiện chưa có OR-Tools, cần xử lý khi dựng image optimize.
2. **Backend/web preview:** workflow/gateway gọi đúng endpoint bằng service token, không fallback âm thầm; lưu plan immutable/version, idempotency, compare/constraint report và duyệt. Đây là phối hợp owner backend/dashboard, không âm thầm gộp vào code solver.
3. **Layer 3:** nhận snapshot staffing có unit/quantity/role/deadline/assumptions, kiểm slot/guardrail; không kể chuyện “đã giảm X ca” từ coverage. Template có validation trước, RAG/LLM sau với bộ vàng và nguồn pháp quy được rà.
4. **Shadow pilot:** partner/authority xác nhận data và policy thật; so kế hoạch với phương án con người, kiểm thực hiện/vi phạm, rồi mới chốt SLA/gap và triển khai ảnh hưởng vận hành.

Chưa cần mở roster cá nhân, routing chi tiết, inventory đầy đủ, stochastic recourse hoặc worker/distributed queue chỉ để chuẩn bị cho các plan chưa được giao.

## 7. Self-review và handoff

- Coverage: HStaff1–5 → Tasks 1/3/4; provenance/generation → Task 2; SA/TS → Task 5; metrics/SLA evidence → Task 6. API/Layer 3/pilot có kế hoạch riêng §6, không bị gọi là đã hoàn thành.
- Interface: mọi solver dùng cùng DTO/evaluator; heuristic chỉ nhận seed khả thi; mọi row assignment dùng group_id/need_id/people.
- Review Focus: mỗi failure có test ở task sở hữu. Group overlap thực tế không thể chứng minh chỉ bằng tổng headcount: intake/QA phải xác nhận trước pilot.
- Review 2026-10-14: khóa exact kể cả 0; oracle chuyển vào M1; bảng status/proof và bảo toàn incumbent; envelope biểu thức; timing/seed schema; reproducibility heuristic theo bước cố định đã gắn vào Tasks 1/3/5/6.
- Deadline/proof: budget cho cả phase; health không tệ đi khi tối ưu cost; phase timeout không làm mất incumbent; false OPTIMAL/INFEASIBLE không được che trong report.
- Proportion: không thêm solver registry, database, HTTP/job layer hay code nghiệm thu lâm sàng vào core prototype.

**Đề xuất trình tự thực thi:** trực tiếp/native, Task 1 → Task 2 → Task 3 → phần M1 của Task 6; review mốc này trước Tasks 4–5 và benchmark M2. Task phụ thuộc chặt vào schema/evaluator nên cách này ít chi phí đồng bộ. Không mở agent phụ trong lượt lập plan.

**Cần review trước code:** scope aggregate một kỳ; fields/units trong §2; fixture/priority và objective ở §3; M1/M2; cách thực thi trực tiếp hoặc qua subagent. Không coi bản plan này hoặc câu “đã review proposal” là lệnh tự chạy toàn bộ task.
