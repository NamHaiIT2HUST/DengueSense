import { motion } from "framer-motion";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  Binary,
  Brain,
  Stethoscope,
  Globe,
  Award,
  CheckCircle2,
} from "lucide-react";

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
  initials: string;
  focus: string;
  bullets: string[];
  skills: string[];
  icon: typeof Binary;
  color: string;
  avatarBg: string;
  github?: string;
  githubHandle?: string;
}

const MEMBERS: TeamMember[] = [
  {
    name: "Nguyễn Đào Nam Hải",
    role: "Trưởng Nhóm Công Nghệ & Kiến Trúc Hệ Thống",
    tag: "Tech Lead & System Architect",
    affiliation: "Trường CNTT & TT — ĐH Bách khoa Hà Nội (HUST)",
    initials: "NH",
    focus:
      "Chủ trì toàn diện kiến trúc khép kín 3 tầng, phát triển Backend Go Microservices (NATS JetStream), Frontend React Console SPA & Guardrail G1.",
    bullets: [
      "Thiết kế kiến trúc hệ sinh thái DengueSense từ tầng dự báo đến điều phối tức thì.",
      "Xây dựng Backend Go tốc độ cao, xử lý luồng sự kiện phân tán và bảo mật RBAC.",
      "Phát triển Dashboard Console và quy trình 4 mắt chuẩn Nghị định 30/2020/NĐ-CP.",
    ],
    skills: ["Go / Microservices", "React / TS", "NATS JetStream", "DevOps & Cloud"],
    icon: Binary,
    color: "from-blue-500/20 via-cyan-500/10 to-slate-950 border-blue-500/35 text-cyan-400",
    avatarBg: "from-blue-600 to-cyan-500 text-white shadow-blue-500/30",
    github: "https://github.com/NamHaiIT2HUST",
    githubHandle: "@NamHaiIT2HUST",
  },
  {
    name: "Đồng Minh Dương",
    role: "Kỹ Sư Trưởng AI/ML & Nghiên Cứu Y Sinh",
    tag: "AI/ML Research Lead",
    affiliation: "Trường CNTT & TT — ĐH Bách khoa Hà Nội (HUST)",
    initials: "MD",
    focus:
      "Chủ trì nghiên cứu mô hình tổ hợp M4-R2 (XGBoost + Random Forest + GLM NegBin), thuật toán tối ưu MILP OR-Tools và giải trình TreeSHAP ERA5.",
    bullets: [
      "Phát triển mô hình Spatio-Temporal M4-R2 cảnh báo sớm 1–6 tháng với độ chính xác 89.5%.",
      "Xây dựng bộ giải quy hoạch nguyên hỗn hợp MILP phân bổ nguồn lực dưới 1 phút.",
      "Bóc tách nguyên nhân dịch bằng TreeSHAP và đối chiếu lâm sàng theo phác đồ Bộ Y tế.",
    ],
    skills: ["M4-R2 Ensemble", "Google OR-Tools", "TreeSHAP ERA5", "AI Y Sinh"],
    icon: Brain,
    color: "from-purple-500/20 via-indigo-500/10 to-slate-950 border-purple-500/35 text-purple-300",
    avatarBg: "from-purple-600 to-indigo-500 text-white shadow-purple-500/30",
  },
  {
    name: "Ban Cố Vấn Dịch Tễ & Y Tế",
    role: "Chuyên Gia Dịch Tễ Học & Y Tế Dự Phòng",
    tag: "Clinical Advisory Board",
    affiliation: "Hệ Thống Y Tế Dự Phòng & Bệnh Viện Truyền Nhiễm",
    initials: "BYT",
    focus:
      "Tham vấn hiệu chuẩn ngưỡng báo động dịch P75 trên 34 tỉnh, điều kiện công bố dịch QĐ 02/2016/QĐ-TTg và phác đồ can thiệp thực địa.",
    bullets: [
      "Hiệu chuẩn ngưỡng P75 lịch sử cho từng tỉnh thành, loại trừ tín hiệu nhiễu dịch tễ.",
      "Cố vấn căn cứ công bố dịch theo Quyết định số 02/2016/QĐ-TTg của Thủ tướng Chính phủ.",
      "Thẩm định danh mục 3 trụ cột can thiệp: Giường hồi sức, Cloramin B và Đội phản ứng nhanh.",
    ],
    skills: ["Ngưỡng P75", "QĐ 02/2016/QĐ-TTg", "Nghị định 30/2020", "Lâm sàng thực địa"],
    icon: Stethoscope,
    color: "from-rose-500/20 via-red-500/10 to-slate-950 border-rose-500/35 text-rose-300",
    avatarBg: "from-rose-600 to-red-500 text-white shadow-rose-500/30",
  },
  {
    name: "Nhóm Kỹ Thuật Dữ Liệu & GIS",
    role: "Kỹ Sư Viễn Thám & Bản Đồ Số",
    tag: "Geo-Spatial & Data Pipeline",
    affiliation: "Phòng Thí Nghiệm Khoa Học Dữ Liệu (HUST)",
    initials: "GIS",
    focus:
      "Pipeline tự động hóa nạp dữ liệu khí hậu toàn cầu ECMWF ERA5, chuẩn hóa GIS 34 tỉnh thành và chống rò rỉ dữ liệu chuỗi thời gian.",
    bullets: [
      "Xử lý dữ liệu lưới khí quyển ERA5 (nhiệt độ, lượng mưa tích lũy, độ ẩm) độ trễ 1–3 tháng.",
      "Số hóa bản đồ ranh giới 34 tỉnh/thành phố và ma trận láng giềng không gian (Adjacency).",
      "Đảm bảo nguyên tắc nhân quả trong chia tập dữ liệu và điền khuyết khí hậu tự động.",
    ],
    skills: ["ECMWF ERA5", "Bản đồ GIS 34 Tỉnh", "Causal Lag Data", "OpenDengue"],
    icon: Globe,
    color:
      "from-emerald-500/20 via-teal-500/10 to-slate-950 border-emerald-500/35 text-emerald-300",
    avatarBg: "from-emerald-600 to-teal-500 text-white shadow-emerald-500/30",
  },
];

export function TeamSection() {
  return (
    <section id="team" className="relative space-y-12">
      {/* Dynamic ambient backlight */}
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-80 w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(14, 165, 233, 0.25) 50%, transparent 100%)",
        }}
      />

      {/* Section Header */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-md backdrop-blur-md">
          <Users size={14} className="text-cyan-400" />
          <span className="uppercase tracking-widest text-[11px] font-bold">
            Đội Thi MedSentinel · Đại Học Bách Khoa Hà Nội
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Con Người Đằng Sau </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Nền Tảng DengueSense
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Đội ngũ kỹ sư Trí tuệ nhân tạo và Khoa học dữ liệu Đại học Bách khoa Hà Nội kết hợp chặt
          chẽ cùng các cố vấn dịch tễ lâm sàng thực địa, đưa nghiên cứu khoa học vào giải quyết bài
          toán cấp bách của y tế cộng đồng.
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto text-left">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`group relative flex flex-col justify-between rounded-3xl border bg-gradient-to-b p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] ${m.color}`}
          >
            {/* Top glowing accent bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="space-y-4">
              {/* Top row: Avatar & Role Tag */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-sm shadow-md ${m.avatarBg}`}
                  >
                    {m.initials}
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 shadow-inner transition-transform group-hover:scale-110">
                    <m.icon size={16} />
                  </span>
                </div>
                <span className="rounded-full border border-slate-700/80 bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                  {m.tag}
                </span>
              </div>

              {/* Name & Role */}
              <div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {m.name}
                </h3>
                <div className="text-xs font-semibold text-cyan-400/90 mt-0.5 leading-snug">
                  {m.role}
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                  <GraduationCap size={13} className="shrink-0 text-slate-500" />
                  <span className="line-clamp-1">{m.affiliation}</span>
                </div>
              </div>

              {/* Focus summary */}
              <p className="text-xs leading-relaxed text-slate-300/90 font-normal">{m.focus}</p>

              {/* Key Highlights */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Đóng góp kỹ thuật chính:
                </span>
                <ul className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  {m.bullets.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-1.5">
                      <CheckCircle2 size={12} className="shrink-0 text-cyan-400 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech Badges */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {m.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer / Profile Link */}
            {m.github ? (
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <a
                  href={m.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 transition-colors hover:text-white"
                >
                  <GithubIcon size={14} />
                  <span>GitHub Profile</span>
                </a>
                <span className="text-[10px] font-mono text-cyan-400">{m.githubHandle}</span>
              </div>
            ) : (
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Trực thuộc Đề án</span>
                <span className="font-semibold text-slate-300">MedSentinel 2026</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Institutional Credentials Banner */}
      <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-xl shadow-xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <Award size={20} className="text-cyan-400 shrink-0" />
            <div>
              <div className="font-bold text-white">ĐH Bách khoa Hà Nội</div>
              <div className="text-[11px] text-slate-400">Trường CNTT & Truyền thông</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <Users size={20} className="text-blue-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Đội thi MedSentinel</div>
              <div className="text-[11px] text-slate-400">Sáng tạo Khởi nghiệp 2026</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <Globe size={20} className="text-teal-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Dữ liệu ECMWF ERA5</div>
              <div className="text-[11px] text-slate-400">Khí hậu & Viễn thám toàn cầu</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Chuẩn Nghị Định 30</div>
              <div className="text-[11px] text-slate-400">QĐ 02/2016 & QĐ 02/2016/QĐ-TTg</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
