import { Users, GraduationCap, Binary, Brain, Award, TrendingUp, Boxes } from "lucide-react";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";

interface TeamMember {
  name: string;
  roleCode: "CEO" | "CTO" | "CAIO" | "CMO" | "COO";
  roleTitle: string;
  tag: string;
  major: string;
  avatar: string;
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
    tag: "CMO - Tiếp Thị & Phát Triển",
    major: "Chuyên ngành Kỹ thuật Y Sinh, Đại học Bách khoa Hà Nội",
    avatar: "/team/nguyen-dinh-dao.png",
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
    tag: "CEO - Lãnh Đạo & Điều Hành",
    major: "Chuyên ngành Hệ thống thông tin quản lý, Đại học Bách khoa Hà Nội",
    avatar: "/team/phan-thi-hai-yen.png",
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
    tag: "CAIO - Trưởng Nhóm AI/ML",
    major: "Chuyên ngành Kỹ thuật Y Sinh, Đại học Bách khoa Hà Nội",
    avatar: "/team/dong-minh-duong.png",
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
    tag: "CTO - Kiến Trúc Hệ Thống",
    major: "Chuyên ngành Kỹ thuật máy tính, Đại học Bách khoa Hà Nội",
    avatar: "/team/nguyen-dao-nam-hai.png",
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
    tag: "COO - Vận Hành & Chuỗi Cung Ứng",
    major: "Chuyên ngành Quản lý công nghiệp, Đại học Bách khoa Hà Nội",
    avatar: "/team/do-ngoc-lan-anh.png",
    icon: Boxes,
    color: "from-emerald-500/15 via-teal-500/5 to-slate-950 border-emerald-500/35",
    ringColor: "ring-emerald-500/40 shadow-emerald-500/20",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    accentText: "text-emerald-400",
  },
];

export function TeamSection() {
  return (
    <section id="team" className="relative space-y-12 overflow-hidden">
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
            Đội Thi MedSentinel - Đại Học Bách Khoa Hà Nội
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Đội Ngũ </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Phát Triển MedSentinel
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Đội ngũ sáng lập MedSentinel gồm 5 thành viên từ các chuyên ngành mũi nhọn tại Đại học
          Bách khoa Hà Nội, kết hợp nghiên cứu khoa học chuyên sâu cùng giải pháp công nghệ y tế
          cộng đồng.
        </p>
      </div>

      {/* Team Cards Container: 3 in row 1, 2 centered in row 2 on desktop */}
      <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto">
        {MEMBERS.map((m) => (
          <TiltCard3D
            key={m.name}
            maxTilt={8}
            scale={1.025}
            glare={true}
            glareOpacity={0.16}
            containerClassName="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm"
            className={`group relative flex w-full flex-col items-center justify-between text-center rounded-3xl border bg-gradient-to-b p-7 backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_16px_50px_rgba(37,99,235,0.25)] ${m.color}`}
          >
            {/* Top glowing accent bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex flex-col items-center text-center w-full">
              {/* Avatar - Centered with 3D Z-Depth Elevation */}
              <div className="relative" style={{ transform: "translateZ(30px)" }}>
                <div
                  className={`relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full ring-2 shadow-2xl transition-transform duration-300 group-hover:scale-105 bg-slate-900 ${m.ringColor}`}
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
                <span className="absolute bottom-0 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-300 shadow-md">
                  <m.icon size={14} className={m.accentText} />
                </span>
              </div>

              {/* Name */}
              <h3
                className="font-display text-xl font-bold text-white group-hover:text-cyan-300 transition-colors tracking-tight mt-4"
                style={{ transform: "translateZ(18px)" }}
              >
                {m.name}
              </h3>

              {/* Project Role */}
              <div
                className="mt-2.5 flex flex-col items-center gap-1"
                style={{ transform: "translateZ(14px)" }}
              >
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase shadow-sm ${m.badgeColor}`}
                >
                  {m.tag}
                </span>
                <span className={`text-xs font-semibold ${m.accentText}`}>{m.roleTitle}</span>
              </div>

              {/* Major & University */}
              <div
                className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-300/90 leading-relaxed max-w-[280px]"
                style={{ transform: "translateZ(10px)" }}
              >
                <GraduationCap size={16} className="shrink-0 text-cyan-400" />
                <span>{m.major}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-center">
              <span className="text-xs font-semibold tracking-wider text-slate-400 group-hover:text-cyan-300 transition-colors">
                MedSentinel - HUST
              </span>
            </div>
          </TiltCard3D>
        ))}
      </div>
    </section>
  );
}
