# Đề xuất Layer 2 Optimize: từ Nurse Rostering đến phân bổ nguồn lực DengueSense

**Ngày tổng hợp:** 09/10/2026. **Trạng thái:** bản nghiên cứu/brainstorming để review, chưa phải ADR đã chấp nhận hoặc kế hoạch triển khai đã duyệt.

**Hướng đã được người dùng chọn:** tỉnh phân bổ trước, cơ sở triển khai sau. Đầu ra của lượt này chỉ là tài liệu; chưa triển khai solver, sửa contract/code hay chạy thí nghiệm trong project.

**Cập nhật sau review §7.4:** người dùng chọn chuẩn bị pilot thực tế, MVP sớm, **tối ưu nhân sự trước**, chưa có đối tác/dữ liệu thật và cho phép dùng giả định. Ưu tiên sức khỏe/hiệu quả phòng dịch, sau đó chi phí; deadline/gap sẽ chốt qua metrics. Các quyết định và nguồn dữ liệu được cập nhật ở §7.1, §7.4–7.6. Mô hình P2 và các snippet trước đó giữ làm tham chiếu nghiên cứu phòng dịch, không còn được coi là toàn bộ đặc tả MVP nhân sự.

## 1. Research: NRP và các phương pháp tiếp cận gần đây

### 1.1. Phạm vi và cách đọc bằng chứng

Tìm kiếm có chủ đích các công trình 2023–2026 về nurse rostering, multi-objective optimization, bất định nhu cầu và integrated healthcare scheduling; đối chiếu với bài survey gốc và tài liệu chính thức OR-Tools. Đây là tổng hợp phục vụ thiết kế, không phải systematic review đầy đủ theo PRISMA.

Ưu tiên bài nghiên cứu, bản tác giả và tài liệu nhà phát triển. Phân biệt kết quả đã bình duyệt, preprint và giả thuyết của bản đề xuất. Không chuyển phần trăm cải thiện trên benchmark NRP thành cam kết cải thiện cho DengueSense.

Bài người dùng nhắc đến là **Cheang, Li, Lim và Rodrigues (2003), “Nurse rostering problems—a bibliographic survey”, EJOR 151(3), 447–460**, DOI 10.1016/S0377-2217(03)00021-3. Đây là bài khác với survey Burke và cộng sự năm 2004. Đã kiểm tra metadata/abstract qua [kho tác giả SMU](https://ink.library.smu.edu.sg/lkcsb_research/2280/); chưa truy cập được toàn văn của bài gốc.

### 1.2. Những nguồn gần đây đáng dùng

| Nguồn và thời điểm | Bằng chứng đã đọc | Điều rút ra cho DengueSense | Giới hạn chuyển giao |
|---|---|---|---|
| **Ceschia và cộng sự, 2023 — NRP thực tế với SA** | Abstract publisher/kho tác giả: mô hình MIP và SA với hai neighborhood, thử trên 34 instance thực tế tại Bắc Italy. [R02](https://air.uniud.it/handle/11390/1240544) | So sánh exact solver với local search trên dữ liệu vận hành; thiết kế neighborhood theo cấu trúc bài toán. | Chưa đọc toàn văn; không sao chép quy tắc lao động hoặc suy ra tốc độ cho VN. |
| **Zhang và cộng sự, 2024 — MDQN-MA cho NRP** | Abstract và mô tả publisher: DQN chọn neighborhood trong Tabu Search, phối hợp nhiều search agent. [R03](https://doi.org/10.1016/j.swevo.2024.101547) | Tabu là đối chứng phù hợp; có thể học cách chọn move khi đã có benchmark lớn. | Không cần DQN/multi-agent cho MVP; thêm chi phí huấn luyện và kiểm chứng. |
| **Böðvarsdóttir & Stidsen — online 21/05/2025, volume 2026** | Toàn văn review 52 bài về đa mục tiêu. Phân biệt weighted sum, goal programming, lexicographic và tương tác với người quyết định. [R04](https://link.springer.com/article/10.1007/s10951-025-00845-0) | Nên thể hiện trade-off hiệu quả/công bằng/ổn định; thứ tự ưu tiên cần do người dùng nghiệp vụ chọn. | Review personnel rostering rộng hơn NRP; không đưa ra bộ trọng số chung cho mọi bệnh viện. |
| **Combrink và cộng sự, 2025 — SMT so với MILP** | Bản tác giả v2 ngày 02/06/2025: generic constraints; so Z3/Gurobi trên các dạng roster. [R05](https://arxiv.org/html/2505.10328v2) | Solver và cách biểu diễn phải được chọn theo instance; không mặc định “CP luôn thắng MILP”. | Kết quả SMT không đồng nghĩa kết quả CP-SAT; đây là hai công nghệ khác nhau. |
| **Zhang, Tang & Lau, 2025 — bounded flexibility và demand uncertainty** | Bản tác giả v2 ngày 30/05/2025: quyết định staffing/scheduling đa giai đoạn, có recourse và điều kiện cấu trúc cho phép reformulation. [R06](https://arxiv.org/html/2505.22124v2) | Lập kế hoạch trước, điều chỉnh khi có dữ liệu mới; giữ độ ổn định của roster. | Preprint; không suy ra mọi mô hình đa giai đoạn đều rút được thành hai giai đoạn. |
| **Guericke và cộng sự — preprint 2025, sửa 01/05/2026** | Toàn văn bản tác giả: cách giải IHTC kết hợp MIP, CP và SA qua decomposition. [R07](https://arxiv.org/html/2511.04685v2) | Đây là tiền lệ sát với hướng exact + heuristic và phân rã theo nguồn lực. | IHTC có phẫu thuật, nhập viện, phòng và nurse assignment; không phải mô hình dengue. CP trong bài không mặc nhiên là OR-Tools CP-SAT. |
| **Koukaras và cộng sự, 25/07/2026 — review NRP** | Toàn văn: taxonomy exact, heuristic, hybrid; corpus được tìm ban đầu tháng 11/2024. [R08](https://link.springer.com/article/10.1007/s12351-026-01090-9) | Hybrid/matheuristic là hướng đáng thử khi constraints thực tế tăng. | Năm xuất bản 2026 không có nghĩa corpus đã phủ hết nghiên cứu 2025–2026; nhận định tổng quan không chứng minh một solver luôn tốt nhất. |
| **Araujo và cộng sự, PNAS 2026 — Dengue Forecasting Sprint** | Metadata và abstract nghiên cứu: dự báo ensemble/probabilistic phục vụ preparedness tại Brazil. [R09](https://pubmed.ncbi.nlm.nih.gov/41678308/) | Cần truyền chất lượng và bất định dự báo vào quyết định phân bổ. | Đây không phải thử nghiệm chứng minh mô hình phân bổ của DengueSense giảm ca thực tế. |

Nguồn nền về tối ưu riêng cho dengue: **Knerer, Currie & Brailsford (2021)** mô hình hóa can thiệp và ngân sách tại Thái Lan. Bài này giúp phân biệt *phân bổ theo hiệu quả can thiệp* với *xếp hạng số ca*, nhưng tham số/can thiệp trong nghiên cứu không được mang nguyên sang Việt Nam. [R10](https://link.springer.com/article/10.1186/s12889-021-10747-3)

Benchmark tích hợp nên tham khảo là **IHTC-2024**, có instance và validator của ban tổ chức. Nó kiểm tra tương tác nguồn lực, không thay thế dataset dengue/định mức địa phương. Một số constraints trong IHTC là quy tắc benchmark, không phải tiêu chuẩn lâm sàng để sao chép. [R11](https://ihtc2024.github.io/)

### 1.3. Phân loại phương pháp và nhận xét

| Hướng | Điểm mạnh | Điểm cần kiểm | Vai trò đề xuất |
|---|---|---|---|
| MILP / integer programming | Budget, flow, supply và objective tuyến tính dễ biểu diễn; có incumbent/bound. | Formulation yếu hoặc quá lớn có thể chậm; cần tuyến tính hóa lợi ích. | Đối chứng chính cho P2, ưu tiên khi inventory/flow hoặc biến liên tục chiếm phần lớn. |
| CP / CP-SAT | Biến rời rạc, logic, ca trực, lịch nghỉ, optional interval và sequence. | Scaling, kích thước miền biến, global constraints và thời gian giải. | Ứng viên mặc định cho P2 rời rạc; ứng viên chính cho roster cơ sở sau này. |
| SA | Thoát local optimum bằng chấp nhận move kém hơn có kiểm soát. | Không có chứng nhận tối ưu; phụ thuộc seed, move và cooling. | Đối chứng cùng ngân sách thời gian; có thể cải thiện incumbent. |
| Tabu Search | Nhớ các move để tránh lặp, có aspiration và diversification. | Tabu tenure/neighborhood ảnh hưởng kết quả; không có bound riêng. | Đối chứng và phương án cải thiện/replanning. |
| LNS / fix-and-optimize / matheuristic | Giữ phần lớn kế hoạch, dùng exact solver giải lại một khối nhỏ. | Phân rã không tự bảo đảm tối ưu toàn cục. | Hướng hybrid ưu tiên khi P3/roster lớn. |
| Stochastic / robust optimization | Thể hiện biến động nhu cầu và chi phí của thiếu chuẩn bị. | Phụ thuộc chất lượng scenario, recourse và giả định thông tin. | Thêm sau khi kiểm được scenario, không đặt nhãn “robust” chỉ vì có safety buffer. |
| RL/hyper-heuristic/LLM-guided search | Có nghiên cứu về chọn neighborhood và điều hướng search. | Cần dữ liệu, ablation và bảo vệ feasibility độc lập. | Chưa đưa vào MVP; Layer 3 không được quyết định hard constraints. |

**Nhận xét:** sự tương đồng với NRP có giá trị ở cách phân loại constraints, phân bổ nhân sự, công bằng và sửa lịch. Toàn bộ Layer 2 còn gồm budget, inventory, phòng dịch và năng lực điều trị, nên rộng hơn NRP thuần.

## 2. Mô hình hóa DengueSense theo hướng tương tự NRP

### 2.1. Ba nhóm quyết định cần tách

| Nhóm | Quyết định | Đại lượng đánh giá | Tránh diễn giải sai |
|---|---|---|---|
| **Phòng dịch** | Phân bổ gói can thiệp, ngày công đội kiểm soát véc-tơ, nguồn lực truyền thông đã được duyệt. | Số ca có thể tránh được theo mô hình hiệu lực; độ nhạy và giả định. | Không coi mọi đồng chi đều giảm số ca theo cùng một tỷ lệ. |
| **Chuẩn bị điều trị** | Vật tư, giường thực vận hành được, reserve, khả năng hỗ trợ/chuyển tuyến. | Thiếu hụt dự kiến, năng lực phục vụ, chi phí và thời gian đáp ứng. | Mua giường hoặc bố trí điều dưỡng không tự đồng nghĩa ngăn nhiễm dengue. |
| **Triển khai tại cơ sở** | Gán nhân sự đủ kỹ năng vào ca/khoa, sử dụng nguồn lực đã cấp. | Coverage an toàn, workload, nghỉ, sở thích và tính ổn định. | Không dùng tổng ca/tháng cấp tỉnh như census theo ca của bệnh viện. |

Điều trị có thể ảnh hưởng outcome, nhưng muốn tối ưu số ca nặng/tử vong tránh được phải có mô hình tác động riêng đã kiểm chứng. Không dùng hàm lợi ích phòng dịch để gán hiệu quả điều trị.

### 2.2. Ánh xạ NRP → DengueSense

| NRP | DengueSense cấp tỉnh trước | Cơ sở triển khai sau |
|---|---|---|
| Nurse / qualification | Năng lực đội, nhóm kỹ năng, khả năng tiếp nhận nguồn lực. | Nhân sự cụ thể và quyền hành nghề/kỹ năng phù hợp nhiệm vụ. |
| Shift / planning horizon | Kỳ phân bổ, thời hạn đến nơi, cửa sổ can thiệp. | Ngày/ca có start/end thực tế. |
| Required coverage | Mức sàn bắt buộc và target preparedness. | Coverage theo workload/acuity và quy tắc cơ sở. |
| Availability | Tồn kho, reserve, ngày công có thể huy động. | Nghỉ phép, lịch đã khóa, hạn chế di chuyển. |
| Preferences / fairness | Target công bằng, mức thay đổi so với kế hoạch trước. | Sở thích ca, phân bố trực đêm/cuối tuần theo FTE. |
| Rerostering | Phân bổ lại khi dự báo, kho hoặc năng lực thay đổi. | Đổi ca có kiểm soát khi nghỉ đột xuất/demand tăng. |

### 2.3. Kiến trúc quyết định hai cấp

~~~mermaid
flowchart TD
    A["Layer 1: forecast versioned + giới hạn"] --> M["Kế hoạch phân bổ cấp tỉnh"]
    B["Budget, kho, reserve, capacity, policy được duyệt"] --> M
    M --> P["Phương án nguồn lực + constraint report"]
    P --> C["Cơ sở kiểm khả năng thực hiện / lập roster"]
    D["Demand cơ sở, nhân sự, kỹ năng, lịch và census"] --> C
    C --> V["Kiểm độc lập và người duyệt"]
    C --> F["Phản hồi thiếu capacity / không khả thi"]
    F --> M
    V --> G["Layer 3: slots và dự thảo"]
    G --> H["Workflow: duyệt đúng version/hash"]
    H --> N["Notification / theo dõi thực hiện"]
~~~

Đây là phân cấp nghiệp vụ, chưa phải thuật toán Benders đã triển khai. Kế hoạch master được chứng minh tối ưu không chứng minh roster downstream khả thi. Khi cơ sở không thực hiện được, trả capacity/conflict có bằng chứng để lập lại; heuristic không tìm thấy roster chưa chứng minh roster không tồn tại.

**Phạm vi thẩm quyền:** “cấp tỉnh” không mặc nhiên cho một CDC sử dụng ngân sách/kho của tỉnh khác. Mỗi nguồn có owner và phạm vi được phép. Demo 34 tỉnh trong repo có thể thử một pool chung giả định; vận hành liên tỉnh cần đúng cơ quan có quyền điều phối. Pilot một tỉnh chỉ dùng pool/đối tượng thuộc quyền của tỉnh đó.

### 2.4. Ba phương án để review

| Phương án | Nội dung | Ưu / hạn chế | Đề xuất |
|---|---|---|---|
| **A — P2 cấp tỉnh, một kỳ, gói nguồn lực** | Lợi ích giảm dần, budget, supply, reserve, cap, hard floor và soft target. Nguồn lực điều trị tối thiểu được bảo vệ trước khi cấp budget phòng dịch. | Gần docs/04 và đầu ra Layer 1; chưa phải roster cơ sở hoặc tối ưu clinical capacity đầy đủ. | **Bắt đầu từ đây.** |
| **B — Master tỉnh + capacity/stock cơ sở** | Thêm inventory theo kỳ, lead time, cơ sở nhận và phản hồi khả thi; roster ở bài toán riêng. | Có giá trị pilot khi có dữ liệu cơ sở; cần contract và bộ dữ liệu mới. | Bước tiếp sau A và dữ liệu đủ. |
| **C — Một mô hình tích hợp toàn bộ** | Đồng thời budget, prevention, bed/staff, inventory, transfer và ca trực đa kỳ. | Có thể tránh quyết định cục bộ, nhưng dữ liệu và kiểm chứng phức tạp nhất. | Hướng nghiên cứu, chưa chọn cho MVP. |

Sau câu trả lời của người dùng, phạm vi đề xuất chuyển thành **master phân bổ nhân sự theo kỹ năng/nhiệm vụ + danh mục nơi nhận tối thiểu**, trước khi mở rộng sang roster cá nhân. Nhân sự phải có nguồn và nơi nhận, nên không chỉ giải một biến số gói cho một tỉnh; không dùng forecast cấp tỉnh để tự tạo forecast chính thức cho từng cơ sở.

## 3. Constraint Programming: hard và soft constraints

### 3.1. Quy tắc phân loại

**Hard constraint:** phải đúng ở mọi phương án được xuất để thực hiện. Không được “đổi” an toàn, tồn kho hay quyền điều phối lấy điểm objective cao hơn.

**Soft constraint:** mục tiêu mong muốn, có thể không đạt nhưng mức thiếu phải được đo và giải thích. “Soft” không có nghĩa bị bỏ qua.

Phân loại do chủ chính sách xác nhận; cần constraint_id, owner, phạm vi, nguồn, phiên bản, thời gian hiệu lực và cách kiểm. Một rule “mức sàn” có thể là bắt buộc hoặc target, nhưng chỉ được đổi loại qua policy được duyệt, không do solver/LLM tự quyết định.

Không tự đặt số giờ nghỉ, số người/giường hoặc mức trực đêm như quy định pháp lý Việt Nam. Các giới hạn phải được cơ sở/pháp chế/chuyên môn xác minh và nhập thành tham số có nguồn.

### 3.2. Hard constraints

| ID | Điều kiện | Cấp áp dụng | Khi không thỏa |
|---|---|---|---|
| H01 | Input hợp lệ: hữu hạn, đúng đơn vị, mã đơn vị/nguồn, không trùng, snapshot còn dùng được. | Gate trước solver | Reject input; không sửa số âm hoặc đổi đơn vị âm thầm. |
| H02 | Không vượt budget của từng owner/nguồn kinh phí; reserve đã khóa được giữ lại. | Tỉnh | INFEASIBLE nếu nghĩa vụ tối thiểu vượt budget. |
| H03 | Không dùng quá supply/tồn kho thực; một đơn vị tài nguyên không bị cấp hai lần. | Tỉnh/cơ sở | Reject phương án; xử lý theo balance và commitment. |
| H04 | Không vượt capacity hấp thụ/triển khai hoặc giới hạn gói hợp lệ. | Tỉnh/cơ sở | Giới hạn miền biến và coupling constraints. |
| H05 | Đạt hard floor đã được cơ quan có quyền duyệt. | Tỉnh/cơ sở | Báo xung đột; không tự biến thành soft. |
| H06 | Nguồn lực chỉ chuyển theo tuyến, thẩm quyền và thời hạn hợp lệ; đến nơi trước khi dùng. | Mở rộng đa kỳ | Không tính hàng đang vận chuyển thành hàng sẵn có. |
| H07 | Hàng hết hạn/không phù hợp bảo quản không được sử dụng. | Inventory mở rộng | Loại lô không hợp lệ; theo dõi batch/expiry nếu có. |
| H08 | Giường được sử dụng không vượt giường thực vận hành được, có staff/vật tư cần thiết. | Cơ sở | Không chỉ đếm bed mua được hoặc bed đăng ký. |
| H09 | Nhân sự khả dụng và đủ kỹ năng cho vị trí; không đếm một người vào nhiều vai trò cùng lúc. | Roster | Assignment bị cấm. |
| H10 | Không trùng ca; đủ thời gian nghỉ/di chuyển; tuân thủ giới hạn giờ/ngày liên tiếp đã xác nhận. | Roster | Conflict constraints và rolling windows, gồm lịch ngoài biên. |
| H11 | Coverage an toàn cho hoạt động/bệnh nhân đã chấp nhận phải đạt. | Cơ sở | Báo không khả thi, điều phối/chuyển tuyến theo quy trình người quyết định. |
| H12 | Phần đã thực hiện/khóa, phiên bản đã duyệt và quyền sửa phải được giữ. | Cả hai cấp | Không thay lịch quá khứ hoặc dùng plan cũ để gửi. |

H01/H12 còn là bất biến dữ liệu/workflow; không phải mọi rule đều được mã hóa chỉ bằng một bất đẳng thức solver.

### 3.3. Soft constraints

| ID | Điều kiện mong muốn | Biến đo / penalty | Ghi chú |
|---|---|---|---|
| S01 | Phân bổ đạt target công bằng ngoài hard floor. | Thiếu so với target của địa bàn. | Công bằng theo nhu cầu/khả năng tiếp cận; không chia đều vô điều kiện. |
| S02 | Đạt mức preparedness mong muốn vượt tối thiểu an toàn. | Thiếu resource/coverage theo scenario. | Thiếu trong kế hoạch phải hiện rõ; không cho phép chăm sóc thực tế dưới mức an toàn. |
| S03 | Giữ nguồn lực dự phòng vượt reserve bắt buộc. | Thiếu so với buffer mục tiêu. | Reserve tối thiểu vẫn là H02/H03. |
| S04 | Giảm thay đổi kế hoạch/roster đã thông báo nhưng chưa khóa. | L1 distance hoặc số assignment thay đổi. | Phần khóa là H12. |
| S05 | Đáp ứng sở thích ca/ngày nghỉ. | Số hoặc trọng số request không đáp ứng. | Nghỉ không khả dụng đã duyệt thuộc H09, không phải sở thích. |
| S06 | Công bằng workload, trực đêm/cuối tuần theo nhóm đủ điều kiện và FTE. | Độ lệch workload chuẩn hóa. | Không chia đồng đều giữa full-time/part-time hoặc người không đủ kỹ năng. |
| S07 | Giảm overtime hợp lệ và chi phí điều phối. | Giờ overtime/chi phí hợp lệ. | Trần giờ/điều kiện overtime bắt buộc thuộc H10. |
| S08 | Giữ đội/chăm sóc liên tục khi phù hợp. | Số lần đổi đội/khoa/người phụ trách. | Không lấn át nhu cầu chuyên môn hoặc rule bắt buộc. |
| S09 | Giảm chuyến giao, độ trễ trong cửa sổ cho phép và dùng lô gần hết hạn trước. | Chi phí/logistics/waste. | Hết hạn hoặc đến sau thời hạn hard vẫn bị cấm. |

**Trường hợp thiếu nguồn lực:** khi demand dự kiến vượt supply, thiếu so với target có thể là soft để giải thích preparedness gap. Nếu nghĩa vụ an toàn thực tế không thể đáp ứng, phương án không được gắn “hợp lệ để thực hiện”; cần escalation. Không coi giảm số bệnh nhân trong phương trình là quyền từ chối điều trị.

## 4. Biểu thức toán học

Các công thức dưới đây là **mô hình đề xuất của tài liệu**, chưa được fit/thử trên dữ liệu vận hành. Không sao chép định mức lâm sàng từ benchmark NRP.

### 4.1. Bộ ký hiệu và dữ liệu

| Ký hiệu | Ý nghĩa / đơn vị |
|---|---|
| \(\mathcal I\) | Địa bàn cấp tỉnh trong đúng phạm vi điều phối; hiện Layer 1 có 34 tỉnh. |
| \(\mathcal F_i\) | Cơ sở thuộc tỉnh \(i\), chỉ dùng khi có dữ liệu và mapping được xác minh. |
| \(\mathcal R\) | Loại tài nguyên: ngày công đội, đơn vị vật tư… Không cộng khác loại nếu chưa định nghĩa gói. |
| \(B_o,\mathcal I_o\) | Budget và tập địa bàn được phép dùng nguồn kinh phí của owner \(o\). |
| \(\hat C_i\) | Số ca dự báo trong **một kỳ đích xác định**, không phải incidence/100k hoặc exceed_prob. |
| \(e_i,k_i\) | Hiệu lực cực đại và hệ số saturation giả định/ước lượng, có nguồn và độ nhạy. |
| \(L_i,\underline n_i,\tau_i\) | Số gói tối đa, mức sàn hard và target soft. |
| \(c_{i\ell},a_{ir\ell}\) | Chi phí tiền và lượng tài nguyên \(r\) của gói thứ \(\ell\). |
| \(S_r,R_r^{hard}\) | Supply và reserve bắt buộc của tài nguyên \(r\). |
| \(\Omega,p_\omega\) | Scenario và xác suất, chỉ có ý nghĩa xác suất khi được hiệu chỉnh/xác minh. |
| \(t,d,s,n,k\) | Kỳ inventory, ngày, ca, nhân sự và vai trò/kỹ năng ở bài toán mở rộng. |

Budget phòng dịch ở MVP:

\[
B_o^{pre}=B_o^{total}-B_o^{clinical,locked}-B_o^{reserve,locked}\ge0.
\]

Hai khoản locked phải phản ánh nghĩa vụ đã xác nhận; không phải giá trị solver tự đặt để làm plan dễ khả thi. Nếu chưa có dữ liệu clinical, chỉ được gọi đây là **kế hoạch phòng dịch giả định**, chưa phải kế hoạch nguồn lực y tế hoàn chỉnh.

### 4.2. P2 cấp tỉnh: gói nguồn lực có lợi ích giảm dần

**Phạm vi sau review:** phần này là model nghiên cứu lợi ích phòng dịch. Với MVP nhân sự đã chọn, dùng staffing formulation đề xuất ở §7.6; không mặc định mỗi nhân sự được điều phối sẽ giảm một tỷ lệ số ca theo \(g_i\).

Giả định một loại gói can thiệp được chuẩn hóa cho mỗi tỉnh:

\[
g_i(n_i)=\hat C_i e_i(1-\exp(-k_i n_i)),
\quad 0\le e_i\le1,\quad k_i>0.
\]

Gói phải có định nghĩa vật lý, thời hạn tác dụng và địa bàn thực hiện. Hàm saturation là giả thuyết ban đầu, không phải hiệu quả can thiệp đã chứng minh. \(e_i=0\) cho phép biểu diễn không có lợi ích trong scenario; không loại scenario đó để làm số đẹp.

Nếu nhiều loại can thiệp tương tác, không cộng độc lập các \(g_{ir}\) vì có thể đếm hai lần một ca tránh được. Khi đó cần hàm hiệu lực chung hoặc các tổ hợp gói đã được đánh giá; không tự áp giả định separable/concave.

Tổng \(\sum_iG_i\) còn giả định không đếm trùng ca và không có spillover liên tỉnh cần mô hình riêng. Nếu can thiệp ở một tỉnh làm thay đổi truyền bệnh ở tỉnh khác, hoặc lợi ích xuất hiện qua nhiều kỳ, cần model tác động không gian/thời gian; không cộng lợi ích tĩnh như bằng chứng tổng ca tránh được.

Với gói nguyên, tiền tính trước:

\[
\delta_{i\ell}=g_i(\ell)-g_i(\ell-1),\quad
x_{i\ell}\in\{0,1\},\quad n_i=\sum_{\ell=1}^{L_i}x_{i\ell}.
\]

Ràng buộc prefix và lợi ích:

\[
x_{i,\ell+1}\le x_{i\ell},\qquad
G_i=\sum_{\ell=1}^{L_i}\delta_{i\ell}x_{i\ell}.
\tag{M1}
\]

M1 không cho chọn gói thứ ba mà bỏ gói thứ nhất. \(\delta_{i\ell}\) được đóng băng theo efficacy_version; solver không gọi LLM để tạo hệ số.

Budget, nguồn lực, capacity và hard floor:

\[
\sum_{i\in\mathcal I_o}\sum_\ell c_{i\ell}x_{i\ell}\le B_o^{pre}
\quad \forall o,
\tag{M2}
\]

\[
\sum_i\sum_\ell a_{ir\ell}x_{i\ell}\le S_r-R_r^{hard}
\quad \forall r,
\tag{M3}
\]

\[
\underline n_i\le n_i\le L_i,\qquad
\sum_\ell a_{ir\ell}x_{i\ell}\le A_{ir}^{local}
\quad \text{khi có giới hạn thực hiện địa phương}.
\tag{M4}
\]

M3 áp cho từng pool có owner, không gộp tài nguyên không thể chia sẻ. Nguồn lực clinical đã committed phải được trừ khỏi available supply hoặc tính trong balance; không đếm hai lần khoản chi trong gói và stock procurement.

M2 giả định mỗi gói có một nguồn kinh phí được xác định. Nếu một gói được tài trợ bởi nhiều owner hoặc các \(\mathcal I_o\) chồng nhau, phải thêm biến phần chi theo nguồn và bảo toàn tổng chi phí gói; không tính toàn bộ cùng một khoản chi vào nhiều budget.

Tuyến/địa bàn không hợp lệ có \(x_{i\ell}=0\), hoặc được loại khỏi miền biến. Assignment locked có \(x_{i\ell}=\bar x_{i\ell}\).

Target soft và độ thay đổi:

\[
u_i\ge \tau_i-n_i,\quad u_i\ge0;
\qquad d_i\ge n_i-\bar n_i,\quad d_i\ge \bar n_i-n_i.
\tag{M5}
\]

Khi penalty dương được minimize, các biến này đo thiếu target và \(|n_i-\bar n_i|\). \(\tau_i\) không thay thế \(\underline n_i\).

### 4.3. Hàm mục tiêu và thứ tự ưu tiên

**MVP A:** giữ mọi hard constraints, bảo vệ nguồn clinical bắt buộc trước, sau đó:

1. Tối đa hóa \(G=\sum_iG_i\).
2. Trong tập phương án gần cùng lợi ích đã cho phép, tối thiểu hóa penalty công bằng/stability/logistics.

\[
\max G(x), \quad x\in\mathcal X_{hard};
\qquad
\min P(x)\;\text{s.t.}\;G(x)\ge G_{ref}-\epsilon_G.
\tag{M6}
\]

\[
P(x)=\sum_i\alpha_i\frac{u_i}{K_i}
+\sum_i\beta_i\frac{d_i}{D_i}
+\gamma\frac{\operatorname{Cost}(x)}{C_{ref}},
\tag{M7}
\]

trong đó \(K_i,D_i,C_{ref}>0\) là thang chuẩn hóa công khai. \(\epsilon_G=0\) mặc định; mọi allowance giảm lợi ích cần người quyết định chọn và thấy rõ số ca giả định đánh đổi. Nếu phase 1 chỉ tìm incumbent, \(G_{ref}\) là incumbent, không gọi nó \(G^\star\).

Nếu phase 1 đã chứng minh optimum và \(\epsilon_G=0\), phase 2 là lexicographic. Nếu có tolerance hoặc phase 1 chưa đóng gap, phải báo đúng mức chứng minh. Không dùng một “big weight” tùy ý để biến hard constraints thành penalty.

Khi thêm clinical preparedness ở B, có thể đặt thiếu hụt critical cao hơn lợi ích phòng dịch, nhưng phải phê duyệt thứ tự đó riêng. Bản này không cộng một ca thiếu năng lực điều trị, một ca tránh nhiễm và một giờ overtime vào cùng tổng không có đơn vị.

Khuyến nghị kiểm tra lexicographic và một vài phương án epsilon-constraint để người dùng thấy trade-off; không gọi một tập phương án là Pareto frontier khi chưa kiểm dominance. [Cơ sở phương pháp đa mục tiêu](https://link.springer.com/article/10.1007/s10951-025-00845-0)

### 4.4. Mở rộng B: flow, inventory, thời hạn và cơ sở nhận

Đặt \(q_{uvrt}\in\mathbb Z_{\ge0}\) là lượng gửi từ nguồn \(u\) tới nơi \(v\), thời gian vận chuyển \(L_{uvr}\); \(I_{vrt}\) là tồn cuối kỳ, \(m_{vrt}\) là lượng dùng:

\[
I_{vrt}=I_{vr,t-1}
+\sum_u q_{uvr,t-L_{uvr}}
-\sum_wq_{vwrt}-m_{vrt}\ge0.
\tag{M8}
\]

Lượng đến trước kỳ đầu chỉ lấy từ pipeline đã có; không dùng chỉ số âm như một quyết định miễn phí. Phải tính tồn đầu kỳ, lô đang đi và commitment.

\[
\sum_r w_rq_{uvrt}\le V_{uvt},\qquad
q_{uvrt}=0\;\text{nếu tuyến không hợp lệ};
\qquad m_{vrt}\le \operatorname{usableStock}_{vrt}.
\tag{M9}
\]

Nếu gói phòng dịch thực hiện tại \(v\), lượng dùng của gói phải gắn vào \(m_{vrt}\) theo BOM. Khi cần expiry, chia \(q/I/m\) theo batch và chỉ cho dùng trước expiry, đúng điều kiện bảo quản; M8 đơn thuần chưa biểu diễn expiry.

Điều kiện kết nối master tỉnh và cơ sở:

\[
\sum_{f\in\mathcal F_i} q_{ifr}\le Q_{ir}^{allocated};
\quad
\operatorname{Deployment}_{f}\le \operatorname{Capacity}_{f}.
\tag{M10}
\]

Capacity aggregate chưa đủ chứng minh có lịch nhân sự khả thi. Khi cơ sở trả chứng chỉ infeasibility, master phải điều chỉnh; chỉ thêm cut khi có lập luận hợp lệ, không coi “heuristic thất bại” là một cut toán học.

### 4.5. Demand bridge: forecast ca → nhu cầu cơ sở

Đây là dữ liệu/model còn thiếu, không được suy ra tự động từ forecast cấp tỉnh.

\[
\lambda^{adm}_{fd}
=\sum_i \lambda^{cases}_{id}\,
p^{adm}_{id}\,\pi_{ifd},
\tag{M11}
\]

với \(p^{adm}\) là tỷ lệ nhập viện và \(\pi_{ifd}\) là routing/catchment đã được kiểm. Đầu vào ca theo ngày cần dữ liệu hoặc mô hình phân rã thời gian riêng. Từ ca/tháng chỉ có thể tạo scenario giả định, chưa đủ lập roster vận hành.

Nhu cầu occupancy có thể ước lượng:

\[
D^{bed}_{fd}
=D^{existing}_{fd}
+\sum_{\tau\le d}\lambda^{adm}_{f\tau}
\Pr(LOS_f>d-\tau).
\tag{M12}
\]

M12 cần length-of-stay và census hiện hữu; không coi số nhập viện trong tháng là số bed cần có. Chỉ là planning model, cần backtest tại cơ sở. Demand phải bao gồm workload ngoài dengue, không dùng toàn bộ nhân sự bệnh viện cho SXH.

Một bed “sẵn có” phải thỏa capacity nhân sự/vật tư cùng ca. Nguồn forecast h=1/2/3/6 cần được chọn theo target_month; không cộng các forecast như những dự báo độc lập hay phân phối bất định của cùng kỳ.

### 4.6. Mở rộng roster giống NRP tại cơ sở

Đặt \(y_{nfkds}\in\{0,1\}\) nếu nhân sự \(n\) làm vai trò \(k\), tại cơ sở \(f\), ngày \(d\), ca \(s\). \(A_{nds}\) là khả dụng, \(Q_{nk}\) là đủ kỹ năng, \(E_{nf}\) là quyền/khả năng làm tại cơ sở.

\[
y_{nfkds}\le A_{nds},\quad
y_{nfkds}\le Q_{nk},\quad
y_{nfkds}\le E_{nf};
\qquad
\sum_{f,k}y_{nfkds}\le1.
\tag{M13}
\]

Nhân sự nhiều kỹ năng được chọn một vai trò tại một thời điểm, không tự tính thành hai người coverage.

Với hai assignment \(a,b\) bị xung đột vì overlap hoặc thiếu nghỉ/di chuyển:

\[
Y_{n,a}+Y_{n,b}\le1,\quad (a,b)\in\mathcal P_n.
\tag{M14}
\]

\(\mathcal P_n\) tính từ start/end timestamp thực, rest_min và travel time giữa hai cơ sở; bao gồm ca đêm qua ngày và lịch ở hai phía biên horizon. Giới hạn “một ca/ngày” chỉ thêm nếu policy cơ sở xác nhận, không coi nó là rule phổ quát.

Giới hạn giờ trên cửa sổ \(W\):

\[
\sum_{f,k,d,s\in W}H_{ds}y_{nfkds}
+H^{outside}_{nW}\le H^{max}_{nW}.
\tag{M15}
\]

Giới hạn ngày liên tiếp dùng biến \(z_{nd}=1\) iff có assignment trong ngày:

\[
\sum_{d=j}^{j+C_n}z_{nd}\le C_n
\quad \forall j.
\tag{M16}
\]

Liên kết \(z\) với \(y\) theo hai chiều và đưa lịch trước horizon vào các cửa sổ cắt biên. \(C_n\) là policy có nguồn, không là số giờ/ngày do agent tự quy định.

Coverage và giường:

\[
\sum_n y_{nfkds}\ge M^{safe}_{fkds}(p_{fd});
\qquad 0\le p_{fd}\le B^{operable}_{fd}.
\tag{M17}
\]

\(p_{fd}\) là census/phần hoạt động dự kiến được hỗ trợ; \(M^{safe}\) do cơ sở xác nhận theo workload/acuity, có thể dùng bảng rời rạc. Người/hoạt động đã tiếp nhận có lower bound bắt buộc; không cho solver tự xóa commitment.

Thiếu so với demand dự kiến \(D^\omega_{fd}\):

\[
v^\omega_{fd}\ge D^\omega_{fd}-p_{fd},\quad v^\omega_{fd}\ge0.
\tag{M18}
\]

M18 chỉ đo preparedness gap, không cho phép nới M17 hoặc tự triage bệnh nhân. Nếu patient-level scheduling được yêu cầu, cần model và quản trị dữ liệu riêng; bản đề xuất hiện không tự mở rộng repo sang hồ sơ bệnh nhân.

Soft roster: phạt request bị bỏ; đo đêm/cuối tuần/giờ theo FTE và nhóm đủ điều kiện; phạt thay đổi assignment chưa khóa. Không dùng fairness để gán người không đủ kỹ năng.

Cụ thể, request muốn làm ca \(r^{want}_{nds}\in\{0,1\}\), và trọng số tránh assignment \(w^{avoid}_{nfkds}\ge0\):

\[
v^{pref}_{nds}\ge r^{want}_{nds}-\sum_{f,k}y_{nfkds},\quad v^{pref}_{nds}\ge0;
\qquad
P_{pref}=\sum_{n,d,s}w^{want}_{nds}v^{pref}_{nds}
+\sum_{n,f,k,d,s}w^{avoid}_{nfkds}y_{nfkds}.
\tag{M24}
\]

Đặt \(W_n=\sum_{f,k,d,s}H_{ds}y_{nfkds}\), \(FTE_n>0\), target giờ chuẩn hóa \(T_g\) cho nhóm đủ điều kiện \(g\):

\[
d^{fair}_n\ge W_n/FTE_n-T_{g(n)},\quad
d^{fair}_n\ge T_{g(n)}-W_n/FTE_n,\quad d^{fair}_n\ge0.
\tag{M25}
\]

Làm tương tự cho số ca đêm/cuối tuần với target riêng. Hệ số \(1/FTE_n\) phải scale nếu dùng CP-SAT; không đưa float vào constraint. Người không làm việc trong kỳ không dùng FTE=0 làm mẫu số. Target cần phản ánh hợp đồng/vai trò, không buộc mọi nhóm bằng nhau.

Overtime hợp lệ và thay đổi lịch:

\[
o_n\ge W_n-H^{contract}_n,\quad o_n\ge0;
\qquad
\chi_a\ge y_a-\bar y_a,\quad
\chi_a\ge\bar y_a-y_a,\quad \chi_a\ge0.
\tag{M26}
\]

Minimize \(\sum_nc^{OT}_no_n+\sum_aw^{change}_a\chi_a\) trong mức ưu tiên phù hợp. Trần H10 vẫn bắt buộc; overtime cần consent nếu policy yêu cầu. Assignment locked giữ \(y_a=\bar y_a\), không chỉ phạt \(\chi_a\). Các penalty M24–M26 cần chuẩn hóa hoặc phân cấp khi kết hợp.

### 4.7. Bất định: deterministic, stochastic và robust

MVP bắt đầu deterministic, kèm sensitivity/stress test có nhãn. Scenario cần giữ tương quan không gian, temporal pattern, shortage, lead time và nghỉ đột xuất nếu model đã gồm các yếu tố đó.

Với lợi ích \(G^\omega(x)\):

Expected objective chỉ dùng khi \(p_\omega\ge0\) và \(\sum_\omega p_\omega=1\), cùng nguồn/cách hiệu chỉnh xác suất được ghi rõ.

\[
\max_x\sum_{\omega}p_\omega G^\omega(x)
\quad \text{(expected benefit)};
\tag{M19}
\]

\[
\max_{x,z}z,\quad z\le G^\omega(x)\;\forall\omega
\quad \text{(worst-case benefit)};
\tag{M20}
\]

\[
\min_{x,R}R,\quad
R\ge G^{\omega,\star}-G^\omega(x)\;\forall\omega
\quad \text{(minimax regret)}.
\tag{M21}
\]

M21 yêu cầu optimum/cận của từng scenario với cùng hard rules và action set. Nếu các oracle chưa tối ưu, phải báo regret ước lượng hoặc interval, không “regret chính xác”.

Khi có recourse tại cơ sở:

\[
\min_x C_0(x)+\sum_\omega p_\omega
\min_{y^\omega\in\mathcal Y(x,\omega)}L(x,y^\omega,\omega).
\tag{M22}
\]

Decision đã commit là chung cho scenario. Nếu demand được biết dần, các quyết định cùng lịch sử thông tin phải giống nhau:

\[
y_t^\omega=y_t^{\omega'}
\quad\text{khi }\mathcal H_t(\omega)=\mathcal H_t(\omega').
\tag{M23}
\]

Không cho mô hình biết trước toàn bộ tương lai rồi gọi kết quả là vận hành thực tế. M20/M21 chỉ robust đối với tập scenario đã xét. Low/base/high tự đặt không đủ để tuyên bố bảo đảm xác suất; Layer 1 hiện chưa cung cấp phân phối số ca/khoảng đã kiểm coverage. [Tiền lệ nghiên cứu uncertainty và recourse](https://arxiv.org/html/2505.22124v2)

### 4.8. Ví dụ nhỏ có thể kiểm bằng tay

Ba địa bàn giả định A/B/C, một kỳ, budget phòng dịch 4 đơn vị, mỗi gói giá 1 và dùng 1 đơn vị supply; supply khả dụng là 4. C có hard floor 1 gói. Không có clinical outcome được suy ra từ ví dụ này.

| Địa bàn | Forecast ca giả định | Lợi ích cận biên từng gói, ca giả định tránh được | Cap | Hard floor |
|---|---:|---|---:|---:|
| A | 100 | 6, 2, 1 | 3 | 0 |
| B | 90 | 5, 4, 1 | 3 | 0 |
| C | 30 | 3, 2 | 2 | 1 |

Các marginal ở đây là input minh họa đã cho, không phải dữ liệu lâm sàng hoặc kết quả fit hàm exponential.

- Rank theo forecast rồi cấp tối đa cho A sau khi bảo vệ floor C: A=3, B=0, C=1 → lợi ích \(9+0+3=12\).
- Lời giải P2: A=1, B=2, C=1 → lợi ích \(6+9+3=18\), chi phí 4.
- Với C=1, ba gói còn lại chọn được lợi ích \(6,5,4\) và prefix hợp lệ. C=2 chỉ còn hai gói, tổng tốt nhất \(5+6+5=16\). Vì thế 18 là optimum của instance này.
- Budget <1 thì infeasible vì floor C; không trả “không chọn gì” như một phương án hợp lệ.

Ví dụ chứng minh sự khác nhau giữa hai formulation dưới bộ hệ số giả định; **không chứng minh can thiệp sẽ tránh được 18 ca ngoài thực tế**. Khi so solver, mọi phương án phải được chấm bằng cùng hàm lợi ích và cùng hard constraints.

## 5. Giải bài toán: OR-Tools MILP/CP-SAT + SA/Tabu Search

### 5.1. Phân biệt formulation và solver

MILP là lớp mô hình tuyến tính có biến nguyên/liên tục. CP-SAT là solver constraint/integer của OR-Tools, không nên đặt nhãn “MILP = CP-SAT” như hai tên đồng nghĩa. P2 prefix có thể được giải bằng cả CP-SAT và MILP qua MPSolver/SCIP; roster logic thường thuận tiện hơn trên CP-SAT.

OR-Tools chính thức có ví dụ [CP-SAT](https://developers.google.com/optimization/cp/cp_solver), [MIP/MPSolver](https://developers.google.com/optimization/mip/mip_example) và [employee scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling). Dùng tài liệu này để kiểm API; cần ghi chính xác phiên bản wheel và backend khi benchmark, không suy ra ví dụ employee scheduling đã bao gồm mọi rule bệnh viện.

| Biểu thức / rule | CP-SAT | MILP |
|---|---|---|
| M1–M4 budget, stock, prefix, floor | BoolVar/IntVar và linear constraints. | Binary/integer variables và linear constraints. |
| M5 absolute deviation/soft shortage | Linear inequalities; AddAbsEquality khi phù hợp. | Auxiliary variables và linear inequalities. |
| Logic có điều kiện | only_enforce_if; nếu cần iff phải mô hình cả hai chiều. | Indicator nếu backend hỗ trợ, hoặc big-M với bound được chứng minh. |
| Ca overlap | Conflict-pair inequalities hoặc optional intervals + NoOverlap. | Conflict inequalities; không mặc định dùng M vô hạn. |
| Pattern nghỉ/ca liên tiếp | Rolling sums/automaton tùy rule. | Rolling sums/state variables tương ứng. |
| Hàm lợi ích | Tiền tính marginal/tables với scale. | Prefix rời rạc; hoặc piecewise-linear có domain rõ. |
| Infeasibility diagnosis | Assumptions trên constraints được hỗ trợ; solve feasibility riêng. | Prechecks, diagnostic solve; khả năng IIS phụ thuộc backend/API. |

Half-reification chỉ mã hóa một chiều implication, không tự thành equivalence. Không gắn enforcement literal vào mọi global constraint mà chưa kiểm hỗ trợ. [Channeling constraints](https://developers.google.com/optimization/cp/channeling)

### 5.2. Rời rạc hóa và đơn vị

- CP-SAT dùng miền biến nguyên và các constraint nguyên. Tiền nên giữ đơn vị VND hoặc một bước lượng tử được chọn có chủ đích; ngày công, số gói, số giường cần định nghĩa số nguyên/đơn vị tối thiểu. Không đổi mọi thứ sang float tùy ý. [CP-SAT integer constraints](https://developers.google.com/optimization/cp/cp_solver)
- Lợi ích số ca giả định là số thực: đặt \(\tilde\delta_{i\ell}=\operatorname{round}(S_G\delta_{i\ell})\). Trả cả giá trị scaled và giá trị chấm lại theo hệ số gốc.
- Nếu có tối đa \(L_{total}\) marginal được chọn, sai số rounding lợi ích của một plan không vượt \(L_{total}/(2S_G)\) khi round-to-nearest từng hệ số. Optimum của mô hình scaled không tự là optimum của mô hình gốc.
- Không round cost xuống hoặc budget lên làm phát sinh overspend. Khi lượng tử hóa theo bước \(q\), có thể ceil cost/floor budget để bảo thủ, nhưng phải báo mất khả thi/optimality do lượng tử hóa. Ưu tiên exact integer monetary units khi không gây overflow.
- Kiểm bound của tổng hệ số × miền biến theo int64, model validation và sensitivity với độ phân giải. Không chọn scale lớn chỉ để trông chính xác hơn dữ liệu.
- Benefit prefix mô hình hóa đúng các mức nguyên đã cho. PWL liên tục là approximation của hàm hiệu lực; certificate chỉ áp cho mô hình đó. So CP-SAT/SCIP trên cùng bảng scaled trước khi so các approximation khác nhau.

### 5.3. Mã minh họa CP-SAT cho phần lõi P2

**Chỉ là đoạn mã trong tài liệu, chưa chạy và chưa đưa vào project.** Nó biểu diễn M1–M4 và objective đầu tiên cho ví dụ §4.8; chưa phải API production, chưa có validation boundary, soft phase, nhiều pool/owner, inventory hoặc roster.

~~~python
from ortools.sat.python import cp_model

gains = {"A": [6, 2, 1], "B": [5, 4, 1], "C": [3, 2]}
floors = {"A": 0, "B": 0, "C": 1}
budget, available_stock = 4, 4

model = cp_model.CpModel()
x = {}
for i, marginal in gains.items():
    for ell in range(len(marginal)):
        x[i, ell] = model.new_bool_var(f"x_{i}_{ell}")
        if ell > 0:
            model.add(x[i, ell] <= x[i, ell - 1])
    model.add(sum(x[i, ell] for ell in range(len(marginal))) >= floors[i])

# Trong ví dụ, mỗi gói có cost = 1 và stock consumption = 1.
model.add(sum(x.values()) <= budget)
model.add(sum(x.values()) <= available_stock)
benefit = sum(gains[i][ell] * var for (i, ell), var in x.items())
model.maximize(benefit)

solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 10.0
solver.parameters.num_search_workers = 1
solver.parameters.random_seed = 42
solver.parameters.absolute_gap_limit = 0.0
solver.parameters.relative_gap_limit = 0.0
status = solver.solve(model)

result = {"status": solver.status_name(status), "plan": None}
if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    result["plan"] = {
        i: sum(solver.value(x[i, ell]) for ell in range(len(marginal)))
        for i, marginal in gains.items()
    }
    result["benefit"] = solver.objective_value
    result["best_bound"] = solver.best_objective_bound
    # Trước khi export: validator độc lập phải kiểm lại mọi hard rule.
~~~

Đối với soft phase: thêm M5, giữ benefit không thấp hơn threshold được duyệt rồi đổi objective sang penalty. Nếu phase 1 chỉ FEASIBLE, giữ metadata phase 1; không biến kết quả phase 2 thành chứng minh tối ưu của benefit ban đầu.

### 5.4. Mã minh họa MILP tương ứng

**Chưa chạy.** Dùng cùng instance, cùng bảng lợi ích và cùng constraints để phép so có ý nghĩa:

~~~python
from ortools.linear_solver import pywraplp

gains = {"A": [6, 2, 1], "B": [5, 4, 1], "C": [3, 2]}
floors = {"A": 0, "B": 0, "C": 1}
mip = pywraplp.Solver.CreateSolver("SCIP")
if mip is None:
    raise RuntimeError("SCIP backend unavailable; do not silently change solver")

x = {}
for i, marginal in gains.items():
    for ell in range(len(marginal)):
        x[i, ell] = mip.IntVar(0, 1, f"x_{i}_{ell}")
        if ell > 0:
            mip.Add(x[i, ell] <= x[i, ell - 1])
    mip.Add(sum(x[i, ell] for ell in range(len(marginal))) >= floors[i])

mip.Add(sum(x.values()) <= 4)  # budget
mip.Add(sum(x.values()) <= 4)  # available stock, separate business rule
mip.Maximize(sum(gains[i][ell] * var for (i, ell), var in x.items()))
mip.SetTimeLimit(10_000)  # milliseconds
status = mip.Solve()

result = {"status_code": status, "plan": None}
if status in (mip.OPTIMAL, mip.FEASIBLE):
    result["plan"] = {
        i: sum(int(round(x[i, ell].solution_value())) for ell in range(len(marginal)))
        for i, marginal in gains.items()
    }
    result["benefit"] = mip.Objective().Value()
    result["best_bound"] = mip.Objective().BestBound()
    # Kiểm integrality tolerance và các hard constraints trên số gốc trước export.
~~~

SCIP là backend, OR-Tools là interface. Cần ghi backend version, time limit và tolerances; không thay backend hoặc quy tắc làm tròn mà không ghi trong benchmark. Với MILP continuous/PWL, kiểm sai số số học theo đơn vị nghiệp vụ, không áp certificate của ví dụ nguyên vào hàm hiệu lực liên tục gốc.

### 5.5. Gap limit: điểm dễ báo sai kết quả

Với bài **maximize** lợi ích:

\[
LB=G(x_{inc}),\qquad UB=G_{best\_bound},\qquad
gap_{abs}=\max(0,UB-LB).
\tag{G1}
\]

Một quy ước relative gap thống nhất để báo cáo:

\[
gap_{rel}=\frac{gap_{abs}}{\max(1,|LB|)}.
\tag{G2}
\]

Với bài minimize, incumbent là UB và best bound là LB. Phải ghi orientation, công thức gap, đơn vị/scale và objective offset. Relative gap thay đổi khi cộng hằng số vào objective, nên chỉ so cùng formulation/offset; với lexicographic lưu gap riêng từng phase.

Theo nguồn OR-Tools, **OPTIMAL còn có thể được trả khi đạt absolute/relative gap limit đã cấu hình**, hoặc khi bài toán chỉ hỏi feasibility. Vì vậy không suy ra “exact optimum” từ status đơn lẻ. [cp_model.proto](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.proto), [sat_parameters.proto](https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto)

Ví dụ: incumbent 100, best bound 105, relative tolerance 0.06 → gap 5% nằm trong mức cho phép 6% theo G2; vẫn chưa chứng minh không còn phương án tốt hơn 100. “Tối ưu tới tolerance” và “tối ưu chính xác mô hình scaled” là hai nhãn khác nhau.

| Trạng thái | Nhãn/UI đúng | Điều kiện xuất plan |
|---|---|---|
| OPTIMAL | Tối ưu theo cấu hình/tolerance đã ghi; chỉ dùng “exact” khi bound/gap xác nhận. | Có incumbent và validator độc lập đạt. |
| FEASIBLE | Có phương án hợp lệ, còn gap hoặc hết thời gian. | Có validator; hiển thị bound/gap khi có. |
| INFEASIBLE | Đã chứng minh không có phương án với input/rules này. | Không phát hành plan; trả conflict. |
| UNKNOWN | Chưa xác định được kết quả trong giới hạn. | Không gọi infeasible; không trả default greedy như nghiệm hiện tại. |
| MODEL_INVALID | Mô hình không hợp lệ. | Báo lỗi kỹ thuật, không tạo plan. |
| SA/TS incumbent | Phương án heuristic, không có proof riêng. | Validator đạt; bound chỉ lấy từ oracle cùng mô hình, nếu có. |

Mô tả status cơ bản có trong [tài liệu CP-SAT](https://developers.google.com/optimization/cp/cp_solver). Chi tiết gap/tolerance phải đối chiếu đúng phiên bản nguồn.

**Đề xuất cho benchmark:** gap limits bằng 0 trên oracle nhỏ/cần proof; fixed time budget trên bài lớn và báo incumbent + bound + gap thực tế. Khi heuristic tìm nghiệm tốt hơn incumbent exact solver chưa đóng gap, đó là bình thường. Khi exact solver đã chứng minh optimum mà heuristic vượt nó trên cùng instance, cần kiểm objective/feasibility/model mismatch.

### 5.6. Simulated Annealing

Giữ \(n_i\) hoặc roster làm state, không cần xử lý từng binary prefix trực tiếp trong move.

Neighborhood cấp tỉnh:

1. Thêm/bớt một gói khi còn budget/supply và không phá floor.
2. Chuyển một gói từ \(i\) sang \(j\), theo mức marginal ở vị trí mới.
3. Swap/block move nhiều gói khi cost khác nhau; kiểm lại mọi pool, cap và locked commitment.

Neighborhood cơ sở sau này: swap ca giữa người đủ kỹ năng; đổi assignment theo một đoạn lịch; block repair giữ lịch biên và coverage. Không chỉ check tổng giờ mà bỏ rest/overlap.

Trong phase đang optimize một scalar \(F\) theo hướng minimize:

\[
\Delta=F(x')-F(x),\qquad
\Pr(\text{accept})=
\begin{cases}
1,&\Delta\le0,\\
\exp(-\Delta/T),&\Delta>0.
\end{cases}
\tag{SA1}
\]

Chỉ áp acceptance sau khi candidate thỏa hard rules và các mức ưu tiên cao hơn đã khóa. Không dùng SA1 để chấp nhận vi phạm an toàn, hoặc đánh đổi benefit vượt allowance đã duyệt. Khi cần vượt local barriers, dùng move nhiều biến/CP repair, không xuất plan infeasible.

Cooling \(T_{j+1}=\alpha T_j\), \(\alpha\in(0,1)\); stopping theo thời gian/không cải thiện. Tune \(T_0,\alpha\), kích thước move trên bộ development, không chọn theo test cuối. Có thể đặt \(T_0=-\operatorname{median}(\Delta^+)/\log(p_0)\) từ các move kém hơn mẫu nếu mẫu tồn tại; ghi \(p_0\) và ngân sách tuning.

### 5.7. Tabu Search

- Tabu attribute là move ngược, ví dụ đưa một gói vừa chuyển về tỉnh cũ hoặc đưa người về assignment vừa bỏ; có tenure hữu hạn.
- Chọn candidate khả thi tốt nhất không bị tabu, dù có thể kém state hiện tại. Aspiration cho phép vượt tabu nếu cải thiện best feasible.
- Giữ best feasible riêng, diversify khi stagnation, thử tenure/move bằng development set.
- Không coi tabu tenure là constraint nghiệp vụ; không loại một plan hợp lệ khỏi validator vì nó bị tabu trong search.

SA và TS phải dùng cùng evaluator gốc, cùng policy và cùng khung thời gian/seed budget. Sau incremental scoring, full recomputation định kỳ và trước export để bắt lỗi cập nhật penalty/stock. Các công thức neighborhood/SA/TS ở đây là thiết kế đề xuất, chưa phải thuật toán đã benchmark của DengueSense.

### 5.8. Hybrid được khuyến nghị

~~~text
Input snapshot + policy version
    → validate data + precheck floor/budget/cap
    → CP-SAT hoặc MILP tạo incumbent
    → SA / TS / LNS cải thiện trong ngân sách còn lại
    → chấm lại objective gốc và validator độc lập
    → lưu plan, solver metadata, hard/soft report
    → người duyệt; sau đó mới chuyển slots cho Layer 3
~~~

**MVP:** CP-SAT là candidate mặc định, SCIP là đối chứng; SA/TS là hai đối chứng bắt buộc trong nghiên cứu được yêu cầu, chưa mặc định phải có cả hai trong production. Nếu không đem lại lợi ích đủ rõ, giữ solver đơn.

**B/P3:** thử fix-and-optimize/LNS: cố định phần còn lại, mở một cụm địa bàn/kỳ hoặc nhóm nhân sự, solve lại. Hiệu quả hybrid trong nghiên cứu IHTC là tiền lệ, không bảo đảm decomposition này tối ưu toàn cục cho dengue. [Nghiên cứu hybrid IHTC](https://arxiv.org/html/2511.04685v2)

### 5.9. Chẩn đoán infeasibility và cách giải thích

Precheck: budget tối thiểu theo floor; supply/reserve; cap nhỏ hơn floor; quá nhiều locked commitments; coverage tối thiểu không có đủ nhân sự qualified.

Có thể gắn assumptions cho các linear rule được hỗ trợ và chạy bản feasibility riêng để tìm một tập rule gây infeasible. CP-SAT trả **sufficient core**, không bảo đảm core tối thiểu; cấu hình đa luồng/objective cũng ảnh hưởng độ hữu ích của core. [Nguồn assumptions](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.proto)

UI cần trả rule ID, phạm vi và giải thích như “floor C cần ít nhất 1 đơn vị budget, hiện budget là 0”; không chỉ “solver failed”. Không tự nới hard rule. Một diagnostic run nới constraints để ước lượng nhu cầu bổ sung phải được đánh dấu **không phải plan thực hiện**.

Về “shadow price” trong docs/04: với bài nguyên, dùng budget sensitivity:

\[
\Delta_B=\frac{G^\star(B+\Delta B)-G^\star(B)}{\Delta B}.
\tag{G3}
\]

G3 là lợi ích cận biên hữu hạn theo mức budget, không gọi nó dual shadow price của toàn bộ MILP/CP-SAT. Nếu chỉ có incumbents/bounds, báo interval/ước lượng; dual của LP relaxation phải có nhãn riêng.

## 6. Features đáp ứng các ràng buộc thực tế

### 6.1. Feature → dữ liệu → constraint → tiêu chí nghiệm thu

| Feature | Dữ liệu cần | Rule liên quan | Tiêu chí kiểm | Giai đoạn |
|---|---|---|---|---|
| **Danh mục pool nguồn lực và owner** | Supply, đơn vị, source_id, thẩm quyền, commitment. | H01–H03 | Không dùng/cấp nguồn ngoài scope, không double allocation. | A |
| **Budget/reserve và gói can thiệp** | Giá, BOM, deadline, cap, phiên bản efficacy và giả định. | H02–H05, M1–M4 | Plan đúng từng budget/pool; lợi ích có nguồn và nhãn giả định. | A |
| **Policy hard/soft có version** | Rule ID, owner, nguồn, hiệu lực, target/penalty. | Tất cả | Thay policy tạo version/plan mới; không có slider nới rule an toàn cho người không có quyền. | A |
| **Chọn forecast và kỳ phân bổ** | run_id, origin, target_month, horizon, model/data version, flags. | H01 | Không nhầm demo 2010 thành live; không dùng exceed_prob thay số ca. | A |
| **Compare phương án** | Baseline, exact/heuristic plan, cùng objective và input. | S01–S04, M6–M7 | Thấy trade-off benefit/cost/equity, không chỉ điểm tổng. | A |
| **Solver job + quality report** | Solver/backend version, time/seed, incumbent, bound, gap/tolerance, validator. | §5.5 | Không báo tối ưu exact khi còn gap; timeout không tạo plan giả. | A |
| **What-if budget/supply** | Snapshot kế hoạch và tham số đã đổi. | H02–H05, G3 | Scenario tách riêng, không ghi đè plan đã duyệt; sensitivity có đơn vị. | A |
| **Infeasibility explanation** | Conflicting rule IDs, precheck/core, capacity shortage. | H02–H12 | Không tự relax; người có quyền nhận giải thích và lựa chọn điều chỉnh input. | A |
| **Bảng kế hoạch và duyệt version** | Plan snapshot/hash, người tạo, review, org. | H12 | Chỉ duyệt/gửi đúng bản hiện tại; stale update bị chặn. | A + backend phối hợp |
| **Cơ sở nhận và capacity thực** | Mapping, beds operable, staff skill capacity, tổng workload. | H04/H08/H11 | Cơ sở trả khả năng thực hiện/thiếu hụt; không hứa staffing chỉ vì có giường. | B |
| **Inventory/lead time/expiry** | Batch, stock, pipeline, deadline, tuyến và capacity vận chuyển. | H03/H06/H07, M8–M10 | Không dùng hàng chưa đến/hết hạn; balance không âm. | B |
| **Roster editor và replan** | Availability, role/skill, FTE, lịch khóa, rest/hour policy, request. | H09–H12, S04–S08 | Đổi thủ công phải validate; không overlap/thiếu nghỉ; giải thích request không đạt. | Cơ sở sau B |
| **Scenario uncertainty** | Joint demand scenarios, nhãn calibrated/stress, recourse policy. | M19–M23 | Không “nhìn trước tương lai”; report worst-case/regret đúng nghĩa. | Sau khi có dữ liệu |
| **Feedback vận hành** | Giao/nhận, thực hiện, chi phí thực, demand và deviations. | Model validation | So planned/actual; cập nhật efficacy bằng nghiên cứu phù hợp, không lấy tương quan làm nhân quả. | Pilot |

“A/B” trong bảng là roadmap phạm vi đề xuất ở §2.4, không phải công việc đã hoàn thành.

### 6.2. Vai trò và luồng web/app

Luồng tỉnh: officer chọn kỳ/run → kiểm snapshot và policy → nhập budget/supply đã có nguồn → solve → xem phương án/constraint report → so baseline và what-if → gửi approver.

Luồng cơ sở: người phụ trách nhận allocation → xác nhận capacity/nguồn lực thực → lập lịch hoặc phản hồi không khả thi → validate và duyệt. Không cho UI giả vờ có facility forecast nếu hiện chỉ có province forecast.

Tách quyền xem, nhập nguồn lực, đổi policy, solve, duyệt và dispatch. Hidden button không thay thế authorization phía service. Dữ liệu nhân sự chi tiết là phạm vi dữ liệu mới so với repo hiện tại; cần xác định quyền truy cập, lưu trữ và audit trước rollout roster.

UI luôn hiển thị nguồn, đơn vị, thời gian và version; gồm trạng thái loading/empty/error, thiếu dữ liệu, không khả thi, feasible và optimal-with-tolerance. Bản đồ có bảng thay thế; không dùng màu làm kênh duy nhất.

### 6.3. Bàn giao sang Layer 3

Layer 3 nhận **snapshot plan đã kiểm**, không chỉ một câu “phân bổ tối ưu”:

- plan_id/version/hash; run/model/data/policy/efficacy version; scope/kỳ và source flags.
- Allocation có resource_id, unit, quantity, recipient/site, cost, deadline và pool owner.
- Giả định, hard-rule validation, soft shortfalls, solver status, bound/gap và rationale có thể truy nguồn.
- Bằng chứng citation/chính sách liên quan đã xác minh, người chịu trách nhiệm và phần chưa có dữ liệu.

Workflow dựng slots từ bản đã lưu; GenAI không tự sinh lượng vật tư, đổi soft thành hard, viết lại thời hạn hoặc tuyên bố “tối ưu” vượt mức proof. Nếu thiếu dữ liệu, để [CẦN BỔ SUNG]; không được duyệt khi phần bắt buộc còn thiếu.

Văn bản phải nói rõ “theo kịch bản/giả định hiệu lực…” khi lợi ích chưa được đo tại địa phương. Giữ chỉnh sửa của cán bộ và lý do; sau sửa phải kiểm lại số/citation và duyệt đúng version/hash. GenAI không trực tiếp gửi văn bản.

### 6.4. Gắn với repo hiện tại

- [ai-service/README.md](../../ai-service/README.md) giao Layer 2 tối ưu số ca giảm được, Layer 3 soạn dự thảo từ phương án; không chuyển optimize sang Go.
- [docs/04](../04-phuong-phap-toi-uu.md) chốt hướng P2; tài liệu này mở rộng hard/soft và liên kết NRP, đồng thời yêu cầu kiểm lại các phát biểu tốc độ/tối ưu chưa có benchmark.
- [docs/07](../07-model-card.md) và [docs/08](../08-ban-giao-layer1.md): dữ liệu thật cấp tỉnh hiện chỉ tới 2010; interval chưa có. Demo/backtest không được coi là chứng minh live.
- CodeGraph xác nhận allocate_resources hiện greedy theo cases_pred, amount=1, giả định giảm 20%; request chỉ có budget/items. Đó là scaffold, chưa biểu diễn policy, inventory, nhiều resource, efficacy hay roster.
- [optimize-internal.yaml](../../contracts/openapi/optimize-internal.yaml) chưa đủ cho model ở đây. Cần PR contract riêng khi triển khai, giữ tương thích; không sửa schema/mã sinh trong lượt research này.
- Logic solver dự kiến ở app/optimize, API adapter ở app/serving/optimize_api, tái dùng common. GenAI logic ở app/genai_rag; workflow, authorization, approval và notification thuộc backend theo docs/09.
- Trước pilot phải xử lý các phụ thuộc đã review: URL/payload/response, token/actor/org, idempotency/version, event delivery, guardrail thật. Thêm solver không tự sửa các vấn đề này.

## 7. Nhận xét, đề xuất phương pháp và tiêu chí review

### 7.1. Phương pháp khuyến nghị

**Sau review, đề xuất MVP nhân sự:** một cấp điều phối với nhiều nơi nhận, nhóm nhân sự có kỹ năng và năng lực khả dụng, nhiệm vụ có nhu cầu workload, nguồn kinh phí, clinical commitment và policy. Dùng scenario giả lập có căn cứ nguồn thật; chưa gán tên một bệnh viện/tỉnh thật cho input được sinh. Đây là hướng chuẩn bị pilot, chưa phải cho phép vận hành bằng dữ liệu giả.

Mục tiêu đề xuất: giữ hard safety/commitment/thẩm quyền; ưu tiên đáp ứng các nhiệm vụ sức khỏe theo workload/độ ưu tiên đã khai báo; sau đó giảm chi phí. Mức đáp ứng nhiệm vụ là **proxy vận hành**, không phải bằng chứng giảm ca nhiễm hoặc tử vong. Hiệu lực e/k chưa có bằng chứng nên chỉ nằm ở nhánh sensitivity nghiên cứu, không là điều kiện để giả vờ có health outcome đã đo.

CP-SAT là ứng viên ban đầu; MILP/SCIP là đối chứng cùng staffing model. SA/Tabu là đối chứng research, quyết định giữ trong production sau benchmark. Có thể mở roster dùng M13–M26 khi có availability/policy/lịch cá nhân và task cụ thể; không dựng toàn bộ NRP ngay để giải bài toán tổng hợp chưa có dữ liệu.

**Dữ liệu trước giả lập:** dùng nguồn chính thức để kiểm quy mô/định nghĩa, dữ liệu tác giả hoặc benchmark để kiểm cấu trúc, và workload methodology để thiết kế trường dữ liệu. Chỉ dùng số đã QA để hiệu chỉnh; nguồn mới tìm hoặc bị chặn không được coi là đã tải/đã kiểm chứng. Registry ở §7.5.

P2 cấp tỉnh, S0 rank-risk và greedy marginal vẫn là đối chứng cho **phòng dịch** ở §4.2. Khi so **staffing**, baseline phải dùng cùng staffing constraints/objective; không lấy score P2 so trực tiếp với score NRP. Phạm vi master có nơi nhận/feedback tối thiểu từ B; inventory đa tài nguyên đầy đủ và model tích hợp C tiếp tục hoãn.

### 7.2. Benchmark và nghiệm thu đề xuất

Sau review, benchmark phải tách **P2 phòng dịch** và **staffing MVP**: P2 chấm theo benefit giả định M1–M7; staffing chấm coverage/shortfall và chi phí HStaff1–HStaff5. Không so score khác đơn vị như cùng một bài toán; hai snippet §5.3–5.4 vẫn chỉ minh họa P2.

| Kiểm tra | Cách thực hiện khi được duyệt triển khai | Điều kiện nhận |
|---|---|---|
| Tính hợp lệ | Validator độc lập trên số/đơn vị gốc; budget, stock, floor, cap, scope, lock. | 0 hard violations ở mọi plan xuất. |
| Instance nhỏ | Enumerate các mức gói hoặc binary choices; đối chiếu CP-SAT/SCIP với zero-gap oracle. | Cùng optimum của cùng model; cho phép nhiều plan tối ưu. |
| Biên | Budget=0, floor không thể đáp ứng, zero benefit, cost=0 hợp lệ, âm/NaN/Infinity, thiếu/tỉnh trùng, stock/route không đủ. | Reject/feasible/infeasible đúng semantics; không fallback giả. |
| Soft constraints | Target không đạt, FTE khác nhau, previous plan/locks, thay đổi epsilon. | Penalty và từng shortfall được tính đúng. |
| Tốc độ | Time budget cố định, phần cứng/version ghi rõ; đo time-to-first-feasible và p50/p95. | SLO theo pilot được thống nhất; không mặc định cam kết <1s mọi N. |
| So solver | S0, greedy, CP-SAT, SCIP, SA, TS, hybrid; cùng instance, evaluator và wall/CPU budget. | Incumbent, bound khi có, gap, tỷ lệ feasible và seed variation. |
| Efficacy | Sweep e/k, budget và nhiều phân phối nguồn lực; đánh giá bằng cùng mô hình outcome đã khai báo. | Báo cả điều kiện P2 không hơn baseline; không suy ra causal benefit từ simulation. |
| Robustness | Joint scenarios, demand shock, staff absence, stock disruption, lead time; test out-of-sample. | Kết luận chỉ trong phạm vi scenario; không tự tạo guarantee xác suất. |
| Roster biên | Ca đêm, travel, lịch ngoài horizon, nghỉ đã duyệt, multicredential, workload ngoài dengue. | Không mất ràng buộc khi cắt thời gian hoặc chia cơ sở. |
| End-to-end | Snapshot → solve → sửa/duyệt → draft → gửi thử, restart/retry/stale version. | Không mất event, không gửi lặp hoặc gửi bản chưa duyệt. |

Chỉ enumerate \(2^M\) khi \(M\) là **tổng số biến binary/gói**, không dùng số tỉnh làm độ phức tạp khi mỗi tỉnh có nhiều mức. Với counts, số cấu hình là \(\prod_i(L_i+1)\); chọn oracle đủ nhỏ để hoàn tất.

Quy mô đầu tiên: 1 và 34 tỉnh với số gói/pool được ghi rõ. 100/570/3.321 đơn vị là **stress test tổng hợp**; không tự biến thành dự báo cấp xã đã được Layer 1 xác thực. NRP/IHTC dùng để kiểm roster/integrated methods, dataset địa phương mới dùng để nghiệm thu pilot.

Với deterministic/heuristic: chạy nhiều seed, báo phân phối kết quả và thời gian; ngân sách tuning cũng phải công khai. Seed cố định không bảo đảm mọi môi trường/parallel run cho cùng một plan, nhất là khi có nhiều optimum.

Các cổng O1–O7 trong docs/04 được giữ làm tham chiếu; yêu cầu “optimal ở N=3.321” và thời gian là mục tiêu cần đo, không phải thuộc tính tự có. Duyệt pilot phải gồm chuẩn dữ liệu và nghiệp vụ, không chỉ đạt optimum giả định.

### 7.3. Những điểm trong phương pháp hiện tại cần chỉnh khi review

1. Sửa cách gọi “MILP—CP-SAT” để phân biệt model và solver.
2. Không dùng “CP-SAT luôn tối ưu <1s” hoặc “SA/TS không bao giờ hơn incumbent” khi exact solver chưa đóng gap.
3. Không tự gán giảm 20% hoặc lấy risk ranking làm chứng cứ efficacy.
4. Thay shadow price của bài nguyên bằng sensitivity hữu hạn có bound/proof rõ.
5. Phân biệt số ca dự báo, ca tránh được giả định, nhu cầu giường và an toàn roster.
6. Hard floor/coverage thiếu khả thi phải tạo conflict/escalation; không thêm penalty rồi cho vi phạm.
7. Nhận định ưu thế P2 có điều kiện theo efficacy/BOM/benefit model; không coi simulation là thử nghiệm tác động thật.
8. Gap và efficacy uncertainty là hai thứ khác nhau: solver gap nhỏ không làm dự báo hoặc hiệu lực can thiệp đáng tin hơn.

### 7.4. Quyết định sau phản hồi của người dùng

**Trạng thái:** đã xác nhận hướng sản phẩm; một số chính sách/dữ liệu vận hành chưa chốt. Không đánh dấu mọi điều kiện pilot là đã có chỉ vì đã trả lời questionnaire.

| # | Quyết định | Phản hồi đã nhận | Cách ghi vào thiết kế / việc còn mở |
|---|---|---|---|
| 1 | Mục tiêu | Chuẩn bị pilot thực tế, cần MVP sớm; đánh giá và cải thiện thuật toán dần. | Tách MVP mô phỏng/benchmark, shadow pilot với dữ liệu thật và rollout có duyệt. Kỳ tuần/tháng chưa được người dùng chốt. |
| 2 | Phạm vi/thẩm quyền | Chưa chọn tỉnh/cơ quan. Hình dung Bộ Y tế → bệnh viện lớn tỉnh/thành → khu vực nhỏ hơn; người đứng đầu từng khu vực quyết định budget. | Đây là cấu trúc mong muốn, không phải xác nhận quyền pháp lý. Giữ scope/owner/approval cấu hình theo đối tác; không tự chọn tỉnh hay suy ra cấp dưới được chuyển budget từ cấp trên. |
| 3 | Nguồn lực đầu tiên | **Nhân sự**, chưa có dữ liệu về lượng, kỹ năng, giá hoặc khả dụng. | MVP master theo nhóm kỹ năng/nhiệm vụ và nơi nhận; model/đơn vị đề xuất ở §7.6. Headcount, FTE, giờ/ngày công chưa có giá trị được duyệt. |
| 4 | Dữ liệu | Chưa có dữ liệu thật; dùng giả lập, tìm nguồn thật trước khi tạo. | Tìm nguồn/QA trước, rồi mới generator có manifest/seed và nhãn. Đã lập registry §7.5; chưa sinh dataset. Nguồn thống kê tổng không thay lịch ca và nhân lực có thể huy động. |
| 5 | Objective/policy | Hiệu quả phòng dịch/sức khỏe trước, tối ưu chi phí sau. | Giữ hard safety trước mọi objective. Đề xuất dùng workload coverage/shortfall làm proxy khi chưa có efficacy; minimum/floor/reserve/fairness và epsilon cụ thể vẫn chưa chốt. |
| 6 | Rà chuyên môn/hiệu lực | Dự kiến Bộ Y tế hoặc lãnh đạo bệnh viện; chưa có bằng chứng, trước mắt dùng giả định. | Chưa có reviewer đã nhận nhiệm vụ. Mọi efficacy/workload standard chưa xác minh phải có assumption_id; không báo “đã được Bộ Y tế duyệt”. |
| 7 | Deadline/gap | Chọn sau khi đo thời gian thuật toán và metrics. | Chưa áp SLO/gap acceptance vận hành. Benchmark theo time budget, incumbent/bound/gap, feasible rate và time-to-first-feasible; chốt threshold sau kết quả. |

**Giữ mở:** đối tác pilot, danh mục nơi nhận, kỳ kế hoạch, pool/BOM nhân sự, bảo vệ nguồn lực gốc, workload/skill/policy được xác nhận, định mức chi phí, reviewer và tiêu chí acceptance. Không cần hỏi lại các hướng đã xác nhận; tiếp tục chuẩn bị nguồn/spec độc lập với những giá trị này.

**Không coi là đã được giao:** cài solver, sinh nhân sự giả, chạy benchmark, sửa API/frontend/backend, thực hiện điều phối hoặc gửi văn bản. Bước tiếp theo là review scope nhân sự và implementation plan/PR contract tương ứng; không tự chuyển sang triển khai từ tài liệu nghiên cứu.

### 7.5. Nguồn dữ liệu thật/benchmark tìm trước khi thiết kế giả lập

**Tra cứu ngày 09/10/2026.** “Tìm được nguồn” khác với “đã tải, parse, QA và được phép tái sử dụng”. Bảng ghi rõ mức đã xác minh để tránh biến thống kê thực thành lịch nhân sự giả mà vẫn mang nhãn real.

| ID / loại | Nguồn và mức đã xác minh | Có thể dùng cho việc gì | Không cung cấp / điều kiện còn thiếu |
|---|---|---|---|
| D01 — Thống kê chính thức | [NSO: Niên giám Việt Nam 2024](https://www.nso.gov.vn/en/default/2026/01/statistical-yearbook-of-viet-nam-2024-2/), trang xuất bản đã mở và có metadata. | Candidate để kiểm tổng quy mô/chỉ tiêu theo năm, đối chiếu với niên giám địa phương. | Chưa trích/QA bảng nhân lực y tế; không dùng làm số lượng huy động tức thời. |
| D02 — Thống kê địa phương chính thức | [Quảng Trị 2024](https://thongkequangtri.nso.gov.vn/nien-giam-thong-ke/3) và [2025](https://thongkequangtri.nso.gov.vn/nien-giam-thong-ke/4): đã xác minh trang và link PDF. Năm 2025 có chỉ tiêu sơ bộ theo thông báo. PDF bị timeout trong lượt tra cứu này. | Candidate về quy mô cơ sở/nhân lực địa phương trước khi hiệu chỉnh scenario. | Chưa QA bảng/số liệu; cần xác định địa giới cũ/mới, phạm vi sở hữu và năm. Không chọn Quảng Trị làm pilot chỉ vì tìm được nguồn. |
| D03 — Thống kê WHO/NHWA | [WHO Health Workforce Statistics](https://www.who.int/data/gho/data/themes/topics/health-workforce/GHO/): đã đọc metadata về dữ liệu báo cáo quốc gia và occupation classification. | Đối chiếu khái niệm, số lượng/mật độ và coverage thống kê ở cấp quốc gia. | Bảng dynamic/API chưa lấy được số VNM đã QA; không suy ra FTE, roster hay skill cho một cơ sở. |
| D04 — Country profile | [WHO Western Pacific SOWN 2025](https://data.wpro.who.int/state-of-the-worlds-nursing-2025/): đã xác minh có link Viet Nam. Link profile chuyển tới đăng nhập SharePoint. | Candidate bổ sung tổng quan nursing Việt Nam. | Chưa đọc profile/số cụ thể; không coi đây là file tải công khai đã sẵn sàng sử dụng. |
| D05 — Dataset tác giả, nguồn thực quốc tế | [Nghiên cứu NRP thực tế 2023](https://air.uniud.it/handle/11390/1240544) công bố dataset tại [satt/nrp-instances](https://bitbucket.org/satt/nrp-instances/). | Candidate để kiểm thuật toán trên instance nguồn thực do tác giả mô tả. | Trang repo chỉ trả nội dung động rỗng; chưa tải/QA/license. Không coi là dữ liệu thật của Việt Nam. |
| D06 — Benchmark cấu trúc | [Scheduling Benchmarks NRP](https://www.schedulingbenchmarks.org/nrp/) và [format guide](https://www.schedulingbenchmarks.org/nrp/instances1_24.html) đã mở, có TXT/XML và cách kiểm constraints. | Test parser, feasibility, score, size và đối chiếu thuật toán sau khi review license/provenance từng bộ. | Instances 1–24 được thiết kế realistic; không gán nhãn HR thực VN. Format này đơn giản hóa lịch ngoài biên, cần test riêng. |
| D07 — Benchmark đa giai đoạn | [INRC-II: specification](https://arxiv.org/html/1501.04177v1): đã đọc format scenario/history/week và validator/simulator. | Thiết kế test horizon/history, skills, succession và evaluate roster. | Đã xác minh specification, chưa tải/QA bộ instance/validator; không mặc định benchmark là dữ liệu nhân sự thật. |
| D08 — Phương pháp xác định nhu cầu | [WHO WISN, ấn bản 2 năm 2023](https://www.who.int/publications/i/item/9789240070066): đã đọc overview dùng workload và activity time standards. | Căn cứ thiết kế trường workload và available working time; xem xét tại partner khi có volume/định mức. | Là phương pháp, không phải dataset dengue hoặc định mức mặc định cho mọi bệnh viện Việt Nam. |

Thông tin workforce tổng hợp thường chỉ giúp kiểm quy mô. Để sinh/tối ưu đúng bài toán điều phối cần bổ sung: nhân lực khả dụng sau nhiệm vụ thường xuyên, tổ chức nguồn/đích, kỹ năng đủ điều kiện, workload phòng dịch, thời gian nhiệm vụ, lịch/giới hạn làm việc và quyền huy động. **Headcount không bằng nhân sự sẵn sàng**, bác sĩ/điều dưỡng không mặc nhiên có năng lực hoặc được phép làm nhiệm vụ kiểm soát véc-tơ.

Trong tra cứu Bộ Y tế, mới thấy một số niên giám cũ và tài liệu dự thảo; chưa xác nhận một bộ nhân sự cơ sở hiện tại tải công khai. Không dùng dự thảo làm policy đã có hiệu lực, không tuyên bố “không có dữ liệu thật” chỉ vì chưa truy cập được.

**Quy trình giả lập đề xuất cho task sau:**

1. Chọn loại nhiệm vụ và đơn vị nhân sự; lập data dictionary, boundary/year và chuẩn role/skill.
2. Trích dữ liệu ứng viên trong D01–D05 nếu truy cập được; kiểm bảng gốc, checksum, provenance, quyền dùng và độ phủ. Chỉ số đã QA mới được dùng để hiệu chỉnh.
3. Khi chỉ có tổng nhân lực, giữ tổng đó riêng với nhãn nguồn thực; sinh phân bố nơi nhận/availability/skill từ giả định có version. Profile được sinh mang nhãn simulated, không real.
4. Dùng benchmark D06/D07 kiểm cấu trúc constraints; không sao chép rule benchmark thành pháp luật/định mức VN.
5. Tạo cả ca feasible và infeasible: thiếu người đủ kỹ năng, nguồn đang committed, donor reserve, quyền chuyển bị cấm, demand shock, chi phí cao, workload và số ca ít/nhiều. Không chỉ sinh ca dễ có nghiệm.
6. Manifest cần source_url/year/boundary, checked_fields, assumption_id, generator_version, seed, data_source và policy_is_verified. Lưu raw/processed ngoài git theo repo; không sinh danh tính người bệnh/nhân viên thật.
7. Khi có partner, thay dữ liệu theo cùng schema, validate lại policy và chạy shadow evaluation trước khi cho plan ảnh hưởng vận hành.

Nếu chỉ có dữ liệu tổng quốc gia hoặc benchmark ngoại quốc, dataset sinh ra chỉ đủ **MVP mô phỏng/đánh giá**, chưa đủ vận hành pilot. Phần chưa biết phải giữ là unknown hoặc giả định có nhãn; không lấy vắng dữ liệu làm reserve=0 hoặc unlimited availability.

### 7.6. Staffing formulation đề xuất cho MVP đã chọn

Đây là đề xuất điều chỉnh phạm vi theo lựa chọn **nhân sự trước**; chưa được benchmark hoặc chấp nhận như policy vận hành. Bản đầu là master allocation một cấp với nhiều nơi nhận, chưa lập toàn bộ ca cá nhân.

Đặt \(g\in\mathcal G\) là nhóm nhân sự nguồn; các nhóm **không chồng nhau** về người, đồng nhất về qualification/khả năng huy động. \(f\in\mathcal F\) là nơi nhận, \(k\in\mathcal K\) là vai trò/nhiệm vụ, \(t\) là kỳ kế hoạch.

- \(a_{gfkt}\in\mathbb Z_{\ge0}\): số người từ nhóm \(g\) được bố trí vào nhiệm vụ \(k\), nơi \(f\), kỳ \(t\). Một người chỉ được tính một lần trong cùng kỳ của model này.
- \(A_{gt}\): số người thực sự có thể huy động sau commitment và reserve bắt buộc của nguồn. Khi chưa có dữ liệu, đây là giả định scenario được ghi rõ.
- \(E_{gfkt}\in\{0,1\}\): đủ qualification và được phép huy động theo tuyến/phạm vi/thời gian.
- \(h_{gt}\): số giờ nhiệm vụ khả dụng trên mỗi người trong kỳ, chưa thể suy từ headcount công khai.
- \(D_{fkt}\): nhu cầu giờ công của nhiệm vụ; từ volume × activity time đã được partner xác minh, hoặc giả định khi benchmark.

Các hard constraints:

\[
\sum_{f,k}a_{gfkt}\le A_{gt};\qquad
a_{gfkt}\le E_{gfkt}A_{gt}.
\tag{HStaff1}
\]

\[
\underline m^{hard}_{fkt}\le\sum_g a_{gfkt}
\le \overline m^{capacity}_{fkt};
\qquad a_{gfkt}=\bar a_{gfkt}\text{ khi locked}.
\tag{HStaff2}
\]

\[
\sum_{g,f,k,t}c^o_{gfkt}a_{gfkt}\le B_o^{available}
\quad\forall o.
\tag{HStaff3}
\]

Chi phí phải được gán đúng funding source, gồm phần tăng thêm như huy động/đi lại/overtime theo policy; không cộng cùng một khoản vào nhiều owner. Hard floor/cap/budget trong scenario không được gọi là chính sách đã phê duyệt.

Demand coverage còn thiếu:

\[
u_{fkt}\ge D_{fkt}-\sum_g h_{gt}a_{gfkt},
\qquad u_{fkt}\ge0.
\tag{HStaff4}
\]

Theo ưu tiên người dùng, đề xuất optimize phân cấp:

\[
\operatorname{lexmin}\left(
\sum_{f,k,t}w^{health}_{fkt}u_{fkt},
\ \operatorname{IncrementalCost}(a),
\ \operatorname{SoftFairnessAndChange}(a)\right)
\quad\text{s.t. mọi hard constraints}.
\tag{HStaff5}
\]

\(w^{health}\) là độ ưu tiên nhiệm vụ được khai báo/xác nhận, không phải xác suất giảm tử vong hoặc e/k tự tạo. HStaff4 đo target preparedness; hoạt động an toàn bắt buộc phải được hard coverage bảo vệ. Không giảm coverage nơi cho để làm nơi nhận có score tốt hơn.

Mỗi phase sau giữ giá trị/allowance phase trước được chấp nhận và báo bound/gap riêng. Nếu pha sức khỏe chỉ FEASIBLE, không gọi giá trị đó là optimum và không để bước giảm chi phí âm thầm làm nó tệ hơn. Deadline/allowance hiện còn mở.

Mô hình aggregate giả định người trong nhóm có thể thay thế nhau và dùng một assignment mỗi kỳ. Nếu cần chia một người giữa nhiệm vụ, lịch nghỉ khác nhau, thời gian di chuyển hoặc lịch theo ca, phải dùng biến giờ/nhân sự và constraints M13–M26; không diễn giải aggregate feasible thành roster đã khả thi.

P2 \(\sum_iG_i\) là nhánh kiểm hiệu lực phòng dịch khi có mô hình/bằng chứng tương ứng. HStaff5 hiện là proxy đáp ứng workload để đánh giá thuật toán; report phải tách “giờ công/nhiệm vụ đáp ứng” khỏi “ca có thể tránh được theo giả định”.

**Benchmark staffing cần:** hard violations=0; weighted/unweighted unmet workload; protected coverage tại nguồn; incremental cost khi giữ cùng mức coverage; overtime hợp lệ, fairness/stability; feasible rate, time-to-first-feasible, p50/p95, objective/bound/gap và seed variation. So CP-SAT, MILP/SCIP, SA/TS và baseline phân bổ nhân sự bằng cùng metric. SLO và việc giữ heuristic chỉ chốt sau các số đo này.

**Gate để chuyển từ MVP giả lập sang pilot có tác động thực:** chọn partner/authority, có snapshot nhân sự/capacity/workload/commitment thật, policy được duyệt, người rà chuyên môn nhận trách nhiệm, shadow test đạt và workflow/authorization/version/event delivery đúng. Chưa điều kiện nào được tự xem là hoàn tất từ câu trả lời định hướng.

## 8. Nguồn và giới hạn kiểm chứng

### 8.1. Nguồn chính

1. **R01:** Cheang, B.; Li, H.; Lim, A.; Rodrigues, B. (2003), *Nurse rostering problems—a bibliographic survey*. EJOR 151(3), 447–460. [DOI](https://doi.org/10.1016/S0377-2217(03)00021-3), [kho tác giả](https://ink.library.smu.edu.sg/lkcsb_research/2280/). Metadata/abstract; toàn văn chưa truy cập được.
2. **R02:** Ceschia, S. và cộng sự (2023), nghiên cứu NRP thực tế bằng Simulated Annealing. [Kho tác giả](https://air.uniud.it/handle/11390/1240544), [DOI](https://doi.org/10.1016/j.orhc.2023.100379). Abstract/metadata; chưa đọc toàn văn.
3. **R03:** Zhang, X. và cộng sự (2024), MDQN-MA cho NRP, Swarm and Evolutionary Computation 87, 101547. [Publisher/DOI](https://doi.org/10.1016/j.swevo.2024.101547). Abstract và mô tả publisher truy hồi được; không dùng số liệu benchmark như cam kết.
4. **R04:** Böðvarsdóttir, E. B.; Stidsen, T., review multi-objective personnel rostering; online 21/05/2025, Journal of Scheduling 29 (2026), 1–19. [Toàn văn](https://link.springer.com/article/10.1007/s10951-025-00845-0).
5. **R05:** Combrink, A. và cộng sự (2025), so SMT/MILP cho NRP. [Bản tác giả v2](https://arxiv.org/html/2505.10328v2). Không suy từ SMT sang CP-SAT.
6. **R06:** Zhang, S.; Tang, P. M.; Lau, H. C. (2025), staffing/scheduling với bounded flexibility và demand uncertainty. [Preprint v2](https://arxiv.org/html/2505.22124v2). Có phương pháp sinh/điều hướng search; không đồng nghĩa GenAI được phép đặt rule an toàn.
7. **R07:** Guericke, D. và cộng sự, hybrid IHTC-2024; bản đầu 2025, v2 01/05/2026. [Toàn văn bản tác giả](https://arxiv.org/html/2511.04685v2). Tách nguồn này khỏi kết luận chung cho dengue.
8. **R08:** Koukaras, P. và cộng sự (25/07/2026), review NRP, Operational Research 26, article 101. [Toàn văn](https://link.springer.com/article/10.1007/s12351-026-01090-9). Corpus tìm ban đầu tháng 11/2024.
9. **R09:** Araujo, E. C. và cộng sự (2026), Dengue Forecasting Sprint Brazil, PNAS 123(7), e2508989123; online 12/02/2026. [Abstract/metadata](https://pubmed.ncbi.nlm.nih.gov/41678308/), [DOI](https://doi.org/10.1073/pnas.2508989123).
10. **R10:** Knerer, G.; Currie, C. S. M.; Brailsford, S. C. (2021), constrained optimization dengue tại Thái Lan, BMC Public Health 21, 807. [Toàn văn](https://link.springer.com/article/10.1186/s12889-021-10747-3).
11. **R11:** Ban tổ chức IHTC-2024, benchmark và validator. [Trang chính thức](https://ihtc2024.github.io/).
12. **R12:** Google OR-Tools: [CP-SAT](https://developers.google.com/optimization/cp/cp_solver), [MIP](https://developers.google.com/optimization/mip/mip_example), [employee scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling), [channeling](https://developers.google.com/optimization/cp/channeling), [solver limits](https://developers.google.com/optimization/cp/cp_tasks). Đã kiểm tài liệu hiện tại, chưa kiểm runtime wheel trong project.
13. **R13:** Google OR-Tools source: [CP model/status/assumptions](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.proto), [gap/solver parameters](https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto). Nhánh stable có thể đổi; khi triển khai lưu version/commit tương ứng.

### 8.2. Giới hạn và mức kết luận

- Đã research nguồn ngoài và đối chiếu docs/code/contract bằng CodeGraph; chỉ tạo/cập nhật file Markdown này. Chưa cài solver, chạy hai code snippet, sinh dataset, benchmark SA/TS, fit efficacy hoặc kiểm end-to-end.
- Các công thức P2/flow/roster là proposal; cần review policy và model assumptions trước khi thành specification triển khai.
- Chưa xác minh một cơ sở/tỉnh cụ thể, định mức lâm sàng hoặc quy định lao động hiện hành áp dụng cho pilot. Không có con số định mức pháp lý/lâm sàng tự suy diễn trong mô hình.
- Ưu điểm được báo trong paper không phải performance guarantee cho repo. Với nguồn chỉ đọc abstract, kết luận giới hạn ở nội dung truy cập được.
- Thiếu dữ liệu real hiện đại, demand bridge và efficacy là giới hạn sản phẩm; exact optimum của mô hình giả định không giải quyết các giới hạn đó.

**Đề xuất để review:** nhận cách chia tỉnh → cơ sở, hard safety/supply/authority và soft target riêng; chọn A, CP-SAT/SCIP làm mốc, SA/Tabu làm đối chứng. Quyết định mở ở §7.4 cần chốt trước khi chuyển sang implementation.

