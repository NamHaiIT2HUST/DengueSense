import { motion } from "framer-motion";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  Binary,
  Brain,
  Trophy,
  Award,
  CheckCircle2,
  Building2,
  TrendingUp,
  Boxes,
} from "lucide-react";

interface TeamMember {
  name: string;
  roleCode: "CEO" | "CTO" | "CAIO" | "CMO" | "COO";
  roleTitle: string;
  tag: string;
  major: string;
  avatar: string;
  bullets: string[];
  skills: string[];
  icon: typeof Binary;
  color: string;
  ringColor: string;
  badgeColor: string;
  accentText: string;
}

const MEMBERS: TeamMember[] = [
  {
    name: "Nguyễn Đình Đạo",
    roleCode: "CMO",
    roleTitle: "Chief Marketing Officer",
    tag: "CMO · Tiếp Thị & Phát Triển",
    major: "Chuyên ngành Kỹ thuật Y Sinh, Đại học Bách khoa Hà Nội",
    avatar: "/team/nguyen-dinh-dao.png",
    bullets: [
      "Quán quân Cuộc thi ý tưởng đổi mới sáng tạo - PTIT",
      "Marketing Intern – VMED Group",
      "Phát triển thị trường, kết nối giải pháp tới hệ thống y tế dự phòng và CDC",
    ],
    skills: ["Kỹ thuật Y Sinh", "VMED Group", "Chiến lược tiếp thị", "Y tế cơ sở"],
    icon: TrendingUp,
    color: "from-amber-500/15 via-orange-500/5 to-slate-950 border-amber-500/35",
    ringColor: "ring-amber-500/40 shadow-amber-500/20",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    accentText: "text-amber-400",
  },
  {
    name: "Phan Thị Hải Yến",
    roleCode: "CEO",
    roleTitle: "Chief Executive Officer",
    tag: "CEO · Lãnh Đạo & Điều Hành",
    major: "Chuyên ngành Hệ thống thông tin quản lý, Đại học Bách khoa Hà Nội",
    avatar: "/team/phan-thi-hai-yen.png",
    bullets: [
      "Quán quân Cuộc thi ý tưởng đổi mới sáng tạo - PTIT",
      "Chủ trì định hướng chiến lược, pháp lý và mô hình tăng trưởng đề án",
      "Điều phối liên ngành giữa công nghệ dữ liệu, quản lý và y tế cộng đồng",
    ],
    skills: ["Quản trị chiến lược", "Hệ thống thông tin", "Pháp lý y tế", "HUST MIS"],
    icon: Award,
    color: "from-rose-500/15 via-pink-500/5 to-slate-950 border-rose-500/35",
    ringColor: "ring-rose-500/40 shadow-rose-500/20",
    badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    accentText: "text-rose-400",
  },
  {
    name: "Đồng Minh Dương",
    roleCode: "CAIO",
    roleTitle: "Chief AI Officer",
    tag: "CAIO · Trưởng Nhóm AI/ML",
    major: "Chuyên ngành Kỹ thuật Y Sinh, Đại học Bách khoa Hà Nội",
    avatar: "/team/dong-minh-duong.png",
    bullets: [
      "Quán quân Cuộc thi ý tưởng đổi mới sáng tạo - PTIT",
      "Nghiên cứu mô hình tổ hợp Spatio-Temporal M4-R2 dự báo sớm 1–6 tháng",
      "Tối ưu phân bổ nguồn lực MILP (Google OR-Tools) & giải thích TreeSHAP",
    ],
    skills: ["M4-R2 Ensemble", "Google OR-Tools", "TreeSHAP ERA5", "AI Y Sinh"],
    icon: Brain,
    color: "from-purple-500/15 via-indigo-500/5 to-slate-950 border-purple-500/35",
    ringColor: "ring-purple-500/40 shadow-purple-500/20",
    badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    accentText: "text-purple-300",
  },
  {
    name: "Nguyễn Đào Nam Hải",
    roleCode: "CTO",
    roleTitle: "Chief Technology Officer",
    tag: "CTO · Kiến Trúc Hệ Thống",
    major: "Chuyên ngành Kỹ thuật máy tính, Đại học Bách khoa Hà Nội",
    avatar: "/team/nguyen-dao-nam-hai.png",
    bullets: [
      "Quán quân Cuộc thi ý tưởng đổi mới sáng tạo - PTIT",
      "Edge AI Engineer — VinRobotics, VinGroup",
      "Chủ trì kiến trúc kỹ thuật khép kín, Go Microservices & React Console",
    ],
    skills: ["Go / NATS", "React / TS", "Edge AI VinRobotics", "Hệ Thống Y Tế"],
    icon: Binary,
    color: "from-blue-500/15 via-cyan-500/5 to-slate-950 border-cyan-500/35",
    ringColor: "ring-cyan-500/40 shadow-cyan-500/20",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    accentText: "text-cyan-400",
  },
  {
    name: "Đỗ Ngọc Lan Anh",
    roleCode: "COO",
    roleTitle: "Chief Operating Officer",
    tag: "COO · Vận Hành & Chuỗi Cung Ứng",
    major: "Chuyên ngành Quản lý công nghiệp, Đại học Bách khoa Hà Nội",
    avatar: "/team/do-ngoc-lan-anh.png",
    bullets: [
      "Quán quân Cuộc thi ý tưởng đổi mới sáng tạo - PTIT",
      "Hoạch định quy trình vận hành và chuỗi cung ứng vật tư phòng dịch thực địa",
      "Tối ưu điều phối liên ngành chuẩn quản trị công nghiệp và Nghị định 30",
    ],
    skills: ["Quản lý công nghiệp", "Vận hành thực địa", "Chuỗi cung ứng", "Điều phối liên ngành"],
    icon: Boxes,
    color: "from-emerald-500/15 via-teal-500/5 to-slate-950 border-emerald-500/35",
    ringColor: "ring-emerald-500/40 shadow-emerald-500/20",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    accentText: "text-emerald-400",
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
          <span className="text-white">Đội Ngũ Và </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Thành Tích Đạt Được
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Đội ngũ sáng lập MedSentinel gồm 5 thành viên từ các chuyên ngành mũi nhọn tại Đại học
          Bách khoa Hà Nội (Hệ thống thông tin, Kỹ thuật máy tính, Kỹ thuật Y Sinh, Quản lý công
          nghiệp), kết hợp nghiên cứu khoa học chuyên sâu cùng kinh nghiệm thực chiến tại các tập
          đoàn công nghệ và y tế hàng đầu.
        </p>
      </div>

      {/* Team Cards Container: 3 in row 1, 2 centered in row 2 on desktop */}
      <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto text-left">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`group relative flex w-full flex-col justify-between rounded-3xl border bg-gradient-to-b p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm ${m.color}`}
          >
            {/* Top glowing accent bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="space-y-4">
              {/* Top row: Avatar & Role Tag */}
              <div className="flex items-start justify-between gap-3">
                <div className="relative shrink-0">
                  <div
                    className={`relative h-20 w-20 overflow-hidden rounded-full ring-2 shadow-lg transition-transform duration-300 group-hover:scale-105 bg-slate-900 ${m.ringColor}`}
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-300 shadow-md">
                    <m.icon size={13} className={m.accentText} />
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase shadow-sm ${m.badgeColor}`}
                  >
                    {m.roleCode}
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {m.tag}
                  </span>
                </div>
              </div>

              {/* Name & Role */}
              <div className="pt-1">
                <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-300 transition-colors tracking-tight">
                  {m.name}
                </h3>
                <div className={`text-xs font-semibold mt-0.5 leading-snug ${m.accentText}`}>
                  {m.roleTitle}
                </div>
                <div className="text-[11px] text-slate-300/90 mt-2 flex items-start gap-1.5 leading-snug">
                  <GraduationCap size={13} className="shrink-0 text-cyan-400 mt-0.5" />
                  <span>{m.major}</span>
                </div>
              </div>

              {/* Key Achievements & Roles */}
              <div className="space-y-2 pt-3 border-t border-slate-800/70">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  <Trophy size={11} className="text-amber-400 shrink-0" />
                  <span>Thành tích & Vai trò chính:</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  {m.bullets.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-1.5">
                      <CheckCircle2
                        size={12}
                        className={`shrink-0 mt-0.5 ${bIdx === 0 ? "text-amber-400" : "text-cyan-400"}`}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech / Competency Badges */}
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

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-center">
              <span className="text-xs font-semibold tracking-wider text-slate-300">
                MedSentinel - HUST
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Institutional Credentials Banner */}
      <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-xl shadow-xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <Trophy size={22} className="text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Quán Quân Sáng Tạo</div>
              <div className="text-[11px] text-slate-400">Ý tưởng Đổi mới Sáng tạo PTIT</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <GraduationCap size={22} className="text-cyan-400 shrink-0" />
            <div>
              <div className="font-bold text-white">ĐH Bách Khoa Hà Nội</div>
              <div className="text-[11px] text-slate-400">CNTT, Y Sinh & Quản Lý</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <Building2 size={22} className="text-blue-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Kinh Nghiệm Doanh Nghiệp</div>
              <div className="text-[11px] text-slate-400">VinRobotics & VMED Group</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <ShieldCheck size={22} className="text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Chuẩn Quy Trình Y Tế</div>
              <div className="text-[11px] text-slate-400">QĐ 02/2016 & Nghị Định 30/2020</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
