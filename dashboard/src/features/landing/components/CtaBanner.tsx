import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-b from-blue-950/60 via-slate-950/80 to-slate-950 p-8 sm:p-12 text-center shadow-2xl backdrop-blur-2xl">
      {/* Background glow circle */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(239, 68, 68, 0.2) 60%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl space-y-6">
        <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="DengueSense Official Logo"
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-xl"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400">
          <ShieldCheck size={13} />
          <span>SẴN SÀNG CHO VÒNG THI & GIAI ĐOẠN PILOT THỰC ĐỊA</span>
        </div>

        <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-tight">
          Sẵn sàng đón đầu dịch bệnh{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-red-400 bg-clip-text text-transparent">
            cùng DengueSense?
          </span>
        </h2>

        <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
          Trải nghiệm toàn bộ hệ sinh thái khép kín từ bản đồ nhiệt GIS cảnh báo sớm, tối ưu hóa
          phân bổ nguồn lực đến xuất dự thảo công điện hành chính PDF chuẩn Nghị định 30/2020/NĐ-CP.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:shadow-cyan-500/40 active:scale-95"
          >
            <Sparkles size={16} />
            <span>Vào Bảng Điều Khiển Console</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            to="/dang-nhap"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:border-slate-500 hover:text-white hover:bg-slate-800"
          >
            <span>Đăng nhập Tài khoản Thử nghiệm</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
