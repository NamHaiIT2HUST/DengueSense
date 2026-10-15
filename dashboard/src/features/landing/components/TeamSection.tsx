import { motion } from "framer-motion";
import { Users, GraduationCap, ShieldCheck, Binary, Stethoscope, Globe, Award } from "lucide-react";

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface TeamMember {
  name: string;
  role: string;
  tag: string;
  affiliation: string;
  focus: string;
  icon: typeof Binary;
  color: string;
  github?: string;
}

const MEMBERS: TeamMember[] = [
  {
    name: "Nguyễn Đào Nam Hải",
    role: "Kỹ Sư Trưởng & Kiến Trúc Sư AI",
    tag: "Tech Lead & AI Architecture",
    affiliation: "Trường CNTT & TT — ĐH Bách khoa Hà Nội (HUST)",
    focus:
      "Mô hình tổ hợp ERA5 viễn thám M4-R2, tối ưu hóa quy hoạch MILP Google OR-Tools, RAG Guardrail chuẩn NĐ 30.",
    icon: Binary,
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-cyan-400",
    github: "https://github.com/NamHaiIT2HUST",
  },
  {
    name: "Ban Cố Vấn Dịch Tễ & Y Tế",
    role: "Chuyên Gia Dịch Tễ & Lâm Sàng",
    tag: "Epidemiological Advisory",
    affiliation: "Hệ Thống Y Tế Dự Phòng & Bệnh Viện Truyền Nhiễm",
    focus:
      "Hiệu chuẩn ngưỡng cảnh báo bùng dịch P75 trên 34 tỉnh, tham vấn quy trình cách ly và phác đồ điều trị QĐ 02/2016.",
    icon: Stethoscope,
    color: "from-red-500/20 to-rose-500/10 border-red-500/30 text-red-400",
  },
  {
    name: "Nhóm Kỹ Thuật Dữ Liệu & GIS",
    role: "Kỹ Sư Viễn Thám & Bản Đồ Số",
    tag: "Geo-Spatial & Data Pipeline",
    affiliation: "Phòng Thí Nghiệm Khoa Học Dữ Liệu (HUST)",
    focus:
      "Xử lý lưới khí tượng ECMWF ERA5 quy mô toàn cầu, chuẩn hóa bản đồ GIS ranh giới 34 tỉnh thành Việt Nam.",
    icon: Globe,
    color: "from-cyan-500/20 to-indigo-500/10 border-cyan-500/30 text-cyan-300",
  },
  {
    name: "Nhóm An Toàn & Pháp Lý Y Tế",
    role: "Kiểm Định Hệ Thống & Quản Trị",
    tag: "Compliance & Safety Oversight",
    affiliation: "Tổ Công Tác Thẩm Duyệt & An Toàn AI",
    focus:
      "Kiểm soát hàng rào Guardrail G1 chống ảo giác, đảm bảo cơ chế 4 mắt Human-in-the-loop và tuân thủ NĐ 13/2023.",
    icon: ShieldCheck,
    color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-400",
  },
];

export function TeamSection() {
  return (
    <section id="team" className="relative space-y-12">
      {/* Dynamic ambient backlight */}
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-72 w-96 -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.4) 0%, rgba(14, 165, 233, 0.2) 60%, transparent 100%)",
        }}
      />

      {/* Section Header */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-md backdrop-blur-md">
          <Users size={14} className="text-cyan-400" />
          <span className="uppercase tracking-widest text-[11px] font-bold">
            Đội Ngũ Nghiên Cứu & Phát Triển
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Con Người Đằng Sau </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Nền Tảng DengueSense
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Sự giao thoa giữa chuyên gia Trí tuệ nhân tạo (Đại học Bách khoa Hà Nội) và các cố vấn y
          tế dự phòng lâm sàng thực địa nhằm kiến tạo giải pháp công nghệ phục vụ cộng đồng.
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto text-left">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`group relative flex flex-col justify-between rounded-3xl border bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] ${m.color}`}
          >
            {/* Top glowing accent bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner transition-transform group-hover:scale-110">
                  <m.icon size={22} />
                </span>
                <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                  {m.tag}
                </span>
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {m.name}
                </h3>
                <div className="text-xs font-semibold text-cyan-400/90 mt-0.5">{m.role}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <GraduationCap size={13} className="shrink-0 text-slate-500" />
                  <span className="line-clamp-1">{m.affiliation}</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-300/90">{m.focus}</p>
            </div>

            {m.github && (
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <a
                  href={m.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
                >
                  <GithubIcon size={14} />
                  <span>GitHub Profile</span>
                </a>
                <span className="text-[10px] font-mono text-cyan-400">@NamHaiIT2HUST</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Institutional Credentials Banner */}
      <div className="max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-around gap-6 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-cyan-400" />
            <span>Nghiên cứu ứng dụng cấp cơ sở (HUST 2026)</span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-400" />
            <span>Dữ liệu khí hậu toàn cầu ECMWF ERA5</span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <span>Chuẩn hành chính Nghị định 30/2020/NĐ-CP</span>
          </div>
        </div>
      </div>
    </section>
  );
}
