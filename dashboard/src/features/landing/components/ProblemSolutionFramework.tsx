import { motion } from "framer-motion";
import {
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  ArrowRight,
  Zap,
  Target,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ProblemSolutionFramework() {
  return (
    <section id="framework" className="relative space-y-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400">
          <Sparkles size={13} />
          <span>BỐI CẢNH Y TẾ & GIẢI PHÁP ĐỘT PHÁ</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
          Giải Quyết Trực Diện Điểm Nghẽn Phòng Chống Dịch
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Chuyển dịch toàn diện từ mô hình y tế ứng phó thụ động sang hệ thống dự phòng chủ động đón
          đầu nhờ AI viễn thám và toán học tối ưu.
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid gap-6 lg:grid-cols-3 text-left">
        {/* Card 1: The Bottlenecks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4 }}
          className="relative flex flex-col justify-between rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-950/20 via-slate-950/80 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-xl ring-1 ring-red-500/10 hover:border-red-500/40 transition-all"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 shadow-inner">
                <AlertTriangle size={22} />
              </span>
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Điểm Nghẽn Thực Địa
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Thực Trạng Ứng Phó Truyền Thống
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Các phương thức giám sát dịch tễ hiện hành dựa trên báo cáo hành chính thủ công bộc
                lộ nhiều hạn chế chí mạng khi dịch bùng phát.
              </p>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Độ trễ báo cáo 30–60 ngày:</strong> Báo cáo giấy từ trạm y tế cơ sở lên
                  tuyến tỉnh quá chậm, khi nhận diện được thì bệnh viện đã kín giường.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Phân bổ cảm tính, cào bằng:</strong> Chia đều ngân sách và vật tư mà không
                  có mô hình định lượng, dẫn tới nơi thiếu nghiêm trọng, nơi tồn kho lãng phí.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Soạn văn bản mất 2–3 ngày:</strong> Thủ tục ban hành công điện điều phối
                  qua nhiều cấp trung gian làm bỏ lỡ thời điểm vàng khống chế dịch.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Quá tải bệnh viện tuyến trên:</strong> Thiếu dự phòng sớm khiến ca nặng
                  dồn về tuyến cuối, gây kiệt quệ y bác sĩ và trang thiết bị hồi sức.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-red-500/20 text-xs font-semibold text-red-400/90 flex items-center justify-between">
            <span>Hậu quả: Chi phí dập dịch tăng gấp 5 lần</span>
          </div>
        </motion.div>

        {/* Card 2: DengueSense Solution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="relative flex flex-col justify-between rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-950/40 via-slate-950/90 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-2xl ring-1 ring-blue-500/20 hover:border-cyan-400/50 transition-all"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/40 text-cyan-400 shadow-inner">
                <Sparkles size={22} />
              </span>
              <span className="rounded-full border border-blue-500/40 bg-blue-500/20 px-3 py-1 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Giải Pháp Đột Phá AI
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Hệ Sinh Thái AI 3 Tầng Khép Kín
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                DengueSense giải quyết trọn vẹn chu trình y tế công cộng từ viễn thám khí hậu, tối
                ưu hóa nguồn lực đến tự động hóa công điện chỉ đạo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2 text-cyan-300">
                <Zap size={14} className="shrink-0 text-cyan-400" />
                <span>Rút ngắn ≥60% phản ứng</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-300">
                <Target size={14} className="shrink-0 text-cyan-400" />
                <span>Độ chính xác 89.5%</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>AI Viễn thám ERA5 (Layer 1):</strong> Kết hợp chuỗi thời gian dịch tễ với
                  lượng mưa, nhiệt độ, độ ẩm toàn cầu, cảnh báo sớm trước 1–6 tháng.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>MILP Solver Tối ưu (Layer 2):</strong> Google OR-Tools phân bổ tối ưu 3
                  nguồn lực thiết yếu (Giường bệnh, Hóa chất, Đội phản ứng nhanh) dưới 1 phút.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>GenAI RAG Thể thức (Layer 3):</strong> Soạn thảo công điện B2G & phác đồ
                  B2B chuẩn Nghị định 30/2020/NĐ-CP & Quyết định 02/2016 chỉ trong 5 phút.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-blue-500/20 text-xs font-semibold text-cyan-400 flex items-center justify-between">
            <span>Hiệu quả: Triệt tiêu đỉnh dịch ngay từ cơ sở</span>
            <Link
              to="/app"
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <span>Thử nghiệm</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </motion.div>

        {/* Card 3: Governance & Trust */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="relative flex flex-col justify-between rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 via-slate-950/80 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-xl ring-1 ring-emerald-500/10 hover:border-emerald-500/40 transition-all"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
                <ShieldCheck size={22} />
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Quản Trị & Ràng Buộc
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Cam Kết Chuẩn Mực & An Toàn AI
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Được thiết kế phục vụ khối y tế công quyền và bệnh viện, mọi tính năng của
                DengueSense đều được bảo vệ bởi các hàng rào kiểm soát chặt chẽ.
              </p>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Guardrail G1 (Khóa số liệu):</strong> Khóa cứng 100% số liệu từ Layer 1 &
                  2. Triệt tiêu hoàn toàn nguy cơ ảo giác (Zero-Hallucination) trong y tế.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Thẩm định 4 mắt (Human-in-the-Loop):</strong> AI không tự ban hành. Cán bộ
                  chuyên môn lập phương án, Lãnh đạo thẩm duyệt mới được ký số điện tử.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Bảo vệ dữ liệu (NĐ 13/2023):</strong> Giám sát vĩ mô trên số liệu cộng gộp
                  cấp tỉnh/huyện, tuyệt đối không lưu trữ hay xử lý thông tin cá nhân (PII).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Minh bạch TreeSHAP:</strong> Báo cáo định lượng tỷ trọng đóng góp của từng
                  yếu tố viễn thám khí hậu (22.6% – 27.9%), không phải hộp đen (Black Box).
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-emerald-500/20 text-xs font-semibold text-emerald-400/90 flex items-center justify-between">
            <span>Nguyên tắc: AI hỗ trợ — Con người phê duyệt</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
