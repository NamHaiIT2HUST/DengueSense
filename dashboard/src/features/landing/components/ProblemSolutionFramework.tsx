import {
  AlertTriangle,
  Layers,
  ShieldCheck,
  X,
  ArrowRight,
  Zap,
  Target,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";
import { Model3DCube } from "./Model3DCube";

export function ProblemSolutionFramework() {
  return (
    <section id="framework" className="relative space-y-12 overflow-hidden">
      {/* Dynamic Ambient Glow Behind Section */}
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-72 w-96 -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(14, 165, 233, 0.2) 60%, transparent 100%)",
        }}
      />

      {/* Section Header */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold tracking-wider text-cyan-300 shadow-md backdrop-blur-md">
          <Activity size={14} className="text-cyan-400" />
          <span className="uppercase tracking-widest text-[11px] font-bold">
            Bối Cảnh Y Tế & Giải Pháp Đột Phá
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Giải Quyết Trực Diện </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Điểm Nghẽn Phòng Chống Dịch
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Chuyển dịch toàn diện từ mô hình y tế ứng phó thụ động sang hệ thống dự phòng chủ động đón
          đầu nhờ AI viễn thám và toán học tối ưu.
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid gap-6 lg:grid-cols-3 text-left">
        {/* Card 1: The Bottlenecks */}
        <TiltCard3D
          maxTilt={6}
          scale={1.015}
          glare={true}
          glareOpacity={0.12}
          containerClassName="h-full"
          className="group relative flex flex-col justify-between h-full rounded-3xl border border-red-500/25 bg-gradient-to-b from-red-950/20 via-slate-950/90 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-red-500/50 hover:shadow-[0_12px_40px_rgba(239,68,68,0.2)]"
        >
          {/* Top glowing line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 shadow-inner transition-transform group-hover:scale-110">
                <AlertTriangle size={22} />
              </span>
              <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Điểm Nghẽn Thực Địa
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white group-hover:text-red-200 transition-colors">
                Thực Trạng Ứng Phó Truyền Thống
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Các phương thức giám sát dịch tễ hiện hành dựa trên báo cáo hành chính thủ công bộc
                lộ nhiều hạn chế chí mạng khi dịch bùng phát.
              </p>
            </div>

            <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Độ trễ báo cáo 30–60 ngày:</strong> Báo cáo giấy từ
                  trạm y tế cơ sở lên tuyến tỉnh quá chậm, khi nhận diện được thì bệnh viện đã kín
                  giường.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Phân bổ cảm tính, cào bằng:</strong> Chia đều ngân
                  sách và vật tư mà không có mô hình định lượng, dẫn tới nơi thiếu nghiêm trọng, nơi
                  tồn kho lãng phí.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Soạn văn bản mất 2–3 ngày:</strong> Thủ tục ban
                  hành công điện điều phối qua nhiều cấp trung gian làm bỏ lỡ thời điểm vàng khống
                  chế dịch.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Quá tải bệnh viện tuyến trên:</strong> Thiếu dự
                  phòng sớm khiến ca nặng dồn về tuyến cuối, gây kiệt quệ y bác sĩ và trang thiết bị
                  hồi sức.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-red-500/20 text-xs font-semibold text-red-400/90 flex items-center justify-between">
            <span>Hậu quả: Chi phí dập dịch tăng gấp 5 lần</span>
          </div>
        </TiltCard3D>

        {/* Card 2: DengueSense Solution */}
        <TiltCard3D
          maxTilt={7}
          scale={1.02}
          glare={true}
          glareOpacity={0.16}
          containerClassName="h-full"
          className="group relative flex flex-col justify-between h-full rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-950/40 via-slate-950/95 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-2xl ring-1 ring-blue-500/30 transition-all duration-300 hover:border-cyan-400 hover:shadow-[0_16px_50px_rgba(14,165,233,0.3)]"
        >
          {/* Top glowing line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 transition-opacity duration-300" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/40 text-cyan-400 shadow-inner transition-transform group-hover:scale-110">
                <Layers size={22} />
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/20 px-3 py-1 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Giải Pháp Đột Phá AI
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                Hệ Thống AI Dự Phòng Khép Kín
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
                <span>ROC-AUC 6 mùa 0.809</span>
              </div>
            </div>

            <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Dự Báo Khí Tượng ERA5:</strong> Kết hợp chuỗi thời
                  gian dịch tễ với lượng mưa, nhiệt độ, độ ẩm toàn cầu, cảnh báo sớm trước 1–6
                  tháng.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Tối Ưu Phân Bổ Nguồn Lực (MILP):</strong> Thuật
                  toán Google OR-Tools phân bổ tối ưu 3 nguồn lực thiết yếu (Giường bệnh, Hóa chất,
                  Đội phản ứng nhanh) dưới 1 phút.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Tự Động Hóa Soạn Thảo Công Điện:</strong> Soạn thảo
                  dự thảo công điện B2G & phác đồ B2B chuẩn Nghị định 30/2020/NĐ-CP & Quyết định
                  02/2016/QĐ-TTg chỉ trong 5 phút.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-blue-500/20 text-xs font-semibold text-cyan-400 flex items-center justify-between">
            <span>Hiệu quả: Triệt tiêu đỉnh dịch ngay từ cơ sở</span>
            <Link
              to="/app"
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-white transition-colors"
            >
              <span>Thử nghiệm</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </TiltCard3D>

        {/* Card 3: Governance & Trust */}
        <TiltCard3D
          maxTilt={6}
          scale={1.015}
          glare={true}
          glareOpacity={0.12}
          containerClassName="h-full"
          className="group relative flex flex-col justify-between h-full rounded-3xl border border-indigo-500/25 bg-gradient-to-b from-indigo-950/20 via-slate-950/90 to-slate-950 p-6 sm:p-7 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-indigo-400/50 hover:shadow-[0_12px_40px_rgba(99,102,241,0.2)]"
        >
          {/* Top glowing line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-inner transition-transform group-hover:scale-110">
                <ShieldCheck size={22} />
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                Quản Trị & Ràng Buộc
              </span>
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-white group-hover:text-indigo-200 transition-colors">
                Cam Kết Chuẩn Mực & An Toàn AI
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Được thiết kế phục vụ khối y tế công quyền và bệnh viện, mọi tính năng của
                DengueSense đều được bảo vệ bởi các hàng rào kiểm soát chặt chẽ.
              </p>
            </div>

            <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Khóa số liệu an toàn:</strong> Khóa cứng 100% số
                  liệu dự báo và phân bổ nguồn lực qua Guardrail G1, ngăn chặn sai lệch số liệu
                  trong y tế.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Thẩm định 4 mắt (Human-in-the-Loop):</strong> AI
                  không tự ban hành. Cán bộ chuyên môn lập hồ sơ, Lãnh đạo thẩm duyệt và ký phê
                  duyệt theo quy trình 4 mắt.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Bảo vệ dữ liệu (NĐ 13/2023):</strong> Giám sát vĩ
                  mô trên số liệu cộng gộp cấp tỉnh/huyện, tuyệt đối không lưu trữ hay xử lý thông
                  tin cá nhân (PII).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Minh bạch TreeSHAP:</strong> Báo cáo định lượng tỷ
                  trọng đóng góp của từng yếu tố viễn thám khí hậu (22.6% – 27.9%), không phải hộp
                  đen (Black Box).
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-500/20 text-xs font-semibold text-indigo-300 flex items-center justify-between">
            <span>Nguyên tắc: AI hỗ trợ — Con người phê duyệt</span>
          </div>
        </TiltCard3D>
      </div>

      {/* Interactive 3D Model Decision & Capability Cube Showcase */}
      <Model3DCube />
    </section>
  );
}
