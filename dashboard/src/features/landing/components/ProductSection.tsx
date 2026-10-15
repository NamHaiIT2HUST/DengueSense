import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  TrendingUp,
  Map,
  Cpu,
  FileText,
  ArrowRight,
  Database,
  Brain,
  ShieldAlert,
  Send,
  CheckCircle2,
} from "lucide-react";

const PRODUCT_MODULES = [
  {
    icon: TrendingUp,
    code: "MÔ-ĐUN 01",
    tag: "AI Dự Báo Chu Kỳ",
    title: "Dự Báo Dịch Tễ Sớm 1–6 Tháng",
    desc: "Mô hình học máy tổ hợp Spatio-Temporal M4-R2 tích hợp trực tiếp dữ liệu khí tượng toàn cầu ECMWF ERA5 (nhiệt độ, độ ẩm, lượng mưa) giúp phát hiện mầm mống dịch sớm hàng tháng.",
    highlight: "Tầm dự báo: 1, 2, 3, 6 tháng",
    color: "from-cyan-500/15 via-blue-500/5 to-slate-950 border-cyan-500/30",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    accentText: "text-cyan-400",
  },
  {
    icon: Map,
    code: "MÔ-ĐUN 02",
    tag: "GIS Không Gian",
    title: "Bản Đồ Số Dịch Tễ 34 Tỉnh Thành",
    desc: "Giám sát trực quan mật độ ca mắc, tỉ suất trên 100.000 dân và phân tầng 4 cấp độ cảnh báo dịch theo thời gian thực, hỗ trợ phân tích xu hướng dịch tễ đa chiều.",
    highlight: "34 tỉnh trọng điểm toàn quốc",
    color: "from-blue-500/15 via-indigo-500/5 to-slate-950 border-blue-500/30",
    badgeColor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    accentText: "text-blue-400",
  },
  {
    icon: Cpu,
    code: "MÔ-ĐUN 03",
    tag: "Quy Hoạch MILP",
    title: "Tối Ưu Hóa Phân Bổ Nguồn Lực",
    desc: "Ứng dụng thuật toán quy hoạch nguyên hỗn hợp (Google OR-Tools) tự động cân đối và phân bổ giường bệnh điều trị, hóa chất diệt muỗi Cloramin B và đội phản ứng nhanh.",
    highlight: "Giải toán tối ưu dưới 1 phút",
    color: "from-indigo-500/15 via-purple-500/5 to-slate-950 border-indigo-500/30",
    badgeColor: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    accentText: "text-indigo-400",
  },
  {
    icon: FileText,
    code: "MÔ-ĐUN 04",
    tag: "Chuẩn NĐ 30/2020",
    title: "Tự Động Hóa Điều Hành CDC",
    desc: "Trợ lý số trích xuất dự báo thành công điện khẩn, kế hoạch can thiệp y tế chuẩn thể thức văn bản Nhà nước, tích hợp cơ chế Guardrail G1 khóa cứng số liệu chống ảo giác.",
    highlight: "Rút ngắn 80% thời gian soạn thảo",
    color: "from-emerald-500/15 via-teal-500/5 to-slate-950 border-emerald-500/30",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    accentText: "text-emerald-400",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    icon: Database,
    title: "Thu Thập & Đồng Bộ",
    desc: "Hấp thụ dữ liệu ca bệnh lịch sử CDC kết hợp ảnh vệ tinh viễn thám khí hậu ERA5 theo chu kỳ thực địa.",
    accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  {
    step: "02",
    icon: Brain,
    title: "Suy Luận & Dự Phóng",
    desc: "Mô hình M4-R2 chạy phân tích tương quan không-thời gian, bóc tách căn nguyên qua giải trình TreeSHAP.",
    accent: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  },
  {
    step: "03",
    icon: ShieldAlert,
    title: "Phân Cấp & Tối Ưu",
    desc: "Khoanh vùng điểm nóng trên bản đồ 34 tỉnh, giải thuật toán phân bổ vật tư và nhân lực ứng phó.",
    accent: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  },
  {
    step: "04",
    icon: Send,
    title: "Chỉ Đạo & Thực Thi",
    desc: "Xuất công điện khẩn chuẩn thể thức hành chính, gửi cơ quan y tế địa phương dập dịch đón đầu.",
    accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
];

export function ProductSection() {
  const handleScrollToMap = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const mapEl = document.getElementById("map");
    if (mapEl) {
      const top = mapEl.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
      window.history.pushState(null, "", "#map");
    }
  };

  return (
    <section id="product" className="relative space-y-14 overflow-hidden scroll-mt-24">
      {/* Dynamic ambient backlight */}
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-80 w-[700px] -translate-x-1/2 rounded-full opacity-20 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(14, 165, 233, 0.25) 50%, transparent 100%)",
        }}
      />

      {/* Section Header */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-md backdrop-blur-md">
          <Boxes size={14} className="text-cyan-400" />
          <span className="uppercase tracking-widest text-[11px] font-bold">
            Hệ Sinh Thái DengueSense
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Giới Thiệu </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Nền Tảng DengueSense
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          DengueSense là giải pháp AI y tế dự phòng khép kín tiên phong tại Việt Nam, kết nối liền
          mạch từ viễn thám khí tượng toàn cầu, thuật toán dự báo dịch tễ chuyên sâu đến điều phối
          nguồn lực thực địa và tự động hóa thể thức chỉ đạo hành chính.
        </p>
      </div>

      {/* 4 Core Modules Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
        {PRODUCT_MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.code}
              whileHover={{ y: -6, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`group relative flex flex-col justify-between rounded-3xl border bg-gradient-to-b p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] ${m.color}`}
            >
              {/* Top accent glowing bar */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="space-y-4">
                {/* Header row with Icon and Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white shadow-md transition-transform group-hover:scale-110">
                    <Icon size={20} className={m.accentText} />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${m.badgeColor}`}
                  >
                    {m.tag}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                    {m.code}
                  </span>
                  <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-300 transition-colors mt-1">
                    {m.title}
                  </h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {m.desc}
                </p>
              </div>

              {/* Bottom Highlight */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                <CheckCircle2 size={13} className={m.accentText} />
                <span>{m.highlight}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* End-to-End Workflow Pipeline */}
      <div className="relative rounded-3xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Quy Trình Hoạt Động Khép Kín
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
              Từ Dữ Liệu Khí Hậu Đến Hành Động Dập Dịch Thực Địa
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Khép kín 4 công đoạn tự động
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((w) => {
            const StepIcon = w.icon;
            return (
              <div
                key={w.step}
                className="relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 transition-colors hover:border-slate-700 hover:bg-slate-900/80"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xl font-black text-slate-600">
                      {w.step}
                    </span>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm ${w.accent}`}>
                      <StepIcon size={16} />
                    </div>
                  </div>
                  <h4 className="font-display text-sm font-bold text-white mb-1.5">
                    {w.title}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {w.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Sẵn sàng thử nghiệm trên toàn bộ 34 tỉnh thành trọng điểm nguy cơ cao.
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#map"
              onClick={handleScrollToMap}
              className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              Xem Bản Đồ 34 Tỉnh
            </a>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Vào Console Điều Hành</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
