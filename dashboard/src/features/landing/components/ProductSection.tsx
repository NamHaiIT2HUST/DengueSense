import { Boxes, TrendingUp, Map, Cpu, FileText, CheckCircle2 } from "lucide-react";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";

const PRODUCT_MODULES = [
  {
    icon: TrendingUp,
    code: "MÔ-ĐUN 01",
    tag: "AI Dự Báo Chu Kỳ",
    title: "Dự Báo Dịch Tễ Sớm 1–6 Tháng",
    desc: "Mô hình M4-R2 kết hợp dữ liệu ca bệnh lịch sử và khí hậu ERA5 để ước lượng số ca và nguy cơ vượt ngưỡng theo tháng.",
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
    desc: "Giám sát trực quan mật độ ca mắc, tỉ suất trên 100.000 dân và phân tầng 4 cấp độ cảnh báo dịch theo chu kỳ giám sát hàng tháng, hỗ trợ phân tích xu hướng dịch tễ đa chiều.",
    highlight: "34 tỉnh/thành trong bộ dữ liệu",
    color: "from-blue-500/15 via-indigo-500/5 to-slate-950 border-blue-500/30",
    badgeColor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    accentText: "text-blue-400",
  },
  {
    icon: Cpu,
    code: "MÔ-ĐUN 03",
    tag: "Quy Hoạch MILP",
    title: "Tối Ưu Hóa Phân Bổ Nguồn Lực",
    desc: "Bộ giải OR-Tools lập phương án phân bổ giường bệnh, vật tư phòng dịch và đội phản ứng nhanh theo ràng buộc ngân sách mô phỏng.",
    highlight: "Phương án mô phỏng cần xác nhận",
    color: "from-indigo-500/15 via-purple-500/5 to-slate-950 border-indigo-500/30",
    badgeColor: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    accentText: "text-indigo-400",
  },
  {
    icon: FileText,
    code: "MÔ-ĐUN 04",
    tag: "Chuẩn NĐ 30/2020",
    title: "Hỗ Trợ Dự Thảo Điều Hành",
    desc: "Trợ lý số hỗ trợ soạn dự thảo chỉ đạo từ hồ sơ và phương án đã xác nhận, kèm kiểm tra số liệu và trích dẫn trước khi người có thẩm quyền duyệt.",
    highlight: "Dự thảo mô phỏng, chưa phát hành",
    color: "from-emerald-500/15 via-teal-500/5 to-slate-950 border-emerald-500/30",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    accentText: "text-emerald-400",
  },
];

export function ProductSection() {
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
          Một bản demo khép kín từ dự báo lịch sử cấp tỉnh, lập phương án phân bổ đến dự thảo chỉ
          đạo có kiểm soát. Số liệu can thiệp là mô phỏng và cần kiểm chứng thực địa.
        </p>
      </div>

      {/* 4 Core Modules Grid with 3D Tactile Tilt & Glare */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
        {PRODUCT_MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <TiltCard3D
              key={m.code}
              maxTilt={7}
              scale={1.02}
              glare={true}
              glareOpacity={0.15}
              className={`group relative flex flex-col justify-between rounded-3xl border bg-gradient-to-b p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] ${m.color}`}
            >
              {/* Top accent glowing bar */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="space-y-4">
                {/* Header row with Icon and Badge */}
                <div
                  className="flex items-center justify-between"
                  style={{ transform: "translateZ(18px)" }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white shadow-md transition-transform group-hover:scale-110">
                    <Icon size={20} className={m.accentText} />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${m.badgeColor}`}
                  >
                    {m.tag}
                  </span>
                </div>

                <div style={{ transform: "translateZ(12px)" }}>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                    {m.code}
                  </span>
                  <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-300 transition-colors mt-1">
                    {m.title}
                  </h3>
                </div>

                <p
                  className="text-xs text-slate-300 leading-relaxed"
                  style={{ transform: "translateZ(8px)" }}
                >
                  {m.desc}
                </p>
              </div>

              {/* Bottom Highlight */}
              <div
                className="mt-5 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors"
                style={{ transform: "translateZ(10px)" }}
              >
                <CheckCircle2 size={13} className={m.accentText} />
                <span>{m.highlight}</span>
              </div>
            </TiltCard3D>
          );
        })}
      </div>
    </section>
  );
}
