import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Activity,
  Award,
  Eye,
  Check,
  Compass,
} from "lucide-react";

import { toUserFacing } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";

import { login } from "./api";
import { safeRedirect } from "./safeRedirect";

const schema = z.object({
  username: z.string().trim().min(1, vi.auth.required).max(128, vi.auth.tooLong),
  password: z.string().min(1, vi.auth.required).max(256, vi.auth.tooLong),
});
type FormValues = z.infer<typeof schema>;

const ROLE_METADATA: Record<
  string,
  { label: string; roleTag: string; icon: typeof Activity; color: string }
> = {
  "demo.xem": {
    label: "Người xem",
    roleTag: "Viewer",
    icon: Eye,
    color: "from-slate-500/20 to-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  "demo.phan-tich": {
    label: "Chuyên viên phân tích",
    roleTag: "Analyst",
    icon: TrendingUp,
    color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
  },
  officer: {
    label: "Cán bộ điều hành",
    roleTag: "Officer",
    icon: Activity,
    color: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
  },
  approver: {
    label: "Lãnh đạo phê duyệt",
    roleTag: "Approver",
    icon: Award,
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
  },
};

export function LoginPage({ redirect }: { redirect?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFormError(null);
    try {
      await login(username, password);
    } catch (err) {
      setFormError(toUserFacing(err).message);
      return;
    }
    router.history.push(safeRedirect(redirect));
  });

  const handleSelectDemo = (username: string, password: string) => {
    setValue("username", username, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
    setActiveAccount(username);
    setFormError(null);
  };

  const isDemo = env.VITE_APP_MODE === "demo";

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full bg-blue-600/15 blur-[140px]" />
        <div className="absolute top-1/2 -right-32 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[150px]" />
        <div className="absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-indigo-600/15 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full lg:grid lg:grid-cols-12 min-h-screen">
        {/* Left Column: Modern Showcase (Desktop Only, Linear/Vercel Style) */}
        <section className="hidden lg:flex lg:col-span-7 xl:col-span-7 flex-col justify-between p-10 xl:p-14 border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Technical Grid Lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          {/* Top Brand Link */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3.5 group">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/30 via-slate-900 to-slate-950 p-2 ring-1 ring-white/10 shadow-[0_0_20px_rgba(37,99,235,0.25)] transition-transform duration-300 group-hover:scale-105 group-hover:ring-cyan-400/50">
                <img
                  src="/logo-icon.png"
                  alt="DengueSense Logo"
                  className="h-full w-full object-contain drop-shadow transition-transform group-hover:scale-110"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold tracking-tight text-white leading-none transition-colors group-hover:text-cyan-200">
                  Dengue<span className="text-red-500">Sense</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium tracking-wide mt-1">
                  Đội thi MedSentinel · ĐH Bách Khoa Hà Nội
                </span>
              </div>
            </Link>
          </div>

          {/* Middle Showcase Content */}
          <div className="relative z-10 my-auto py-10 space-y-8 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-900/90 px-3.5 py-1 text-xs font-semibold text-cyan-300 shadow-md">
              <Compass size={13} className="text-cyan-400" />
              <span className="uppercase tracking-widest text-[10px] font-bold">
                Cổng Điều Hành Y Tế Số Khép Kín
              </span>
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-[1.2]">
                Chuyển từ <span className="text-slate-400">ứng phó bị động</span> sang{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  đón đầu dịch sốt xuất huyết
                </span>
              </h2>
              <p className="text-sm xl:text-base text-slate-300 leading-relaxed">
                Nền tảng hỗ trợ ra quyết định lâm sàng và điều hành y tế công cộng đầu tiên tại Việt
                Nam tích hợp dữ liệu viễn thám khí tượng ECMWF ERA5 cùng mô hình học máy tổ hợp
                Spatio-Temporal M4-R2.
              </p>
            </div>

            {/* 3 Telemetry Feature Bento Cards */}
            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
                <div className="font-mono text-lg font-bold text-cyan-400">1–6 Tháng</div>
                <div className="text-xs font-semibold text-white mt-1">Cảnh Báo Sớm</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Độ chính xác 89.5%, kiểm chứng thực nghiệm 34 tỉnh.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
                <div className="font-mono text-lg font-bold text-blue-400">&lt; 1 Phút</div>
                <div className="text-xs font-semibold text-white mt-1">Tối Ưu Nguồn Lực</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Quy hoạch MILP cân đối giường bệnh & hóa chất diệt muỗi.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
                <div className="font-mono text-lg font-bold text-emerald-400">NĐ 30/2020</div>
                <div className="text-xs font-semibold text-white mt-1">Chuẩn Thể Thức</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Tự động xuất công điện khẩn chỉ đạo dập dịch tức thì.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Accreditation */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/70 pt-4">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-cyan-400" />
              <span>Chứng thực EdDSA Fail-Closed · Chuẩn Bộ Y Tế</span>
            </div>
            <span>Bản quyền © 2026 MedSentinel</span>
          </div>
        </section>

        {/* Right Column: Authentication Form Panel */}
        <main className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 xl:p-12 relative overflow-y-auto">
          {/* Top Mobile Brand Lockup (visible on mobile / tablet) */}
          <div className="flex items-center justify-between mb-6 lg:mb-0">
            <Link to="/" className="lg:hidden flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-xl p-1.5 bg-gradient-to-br from-blue-600/30 to-slate-950 border border-cyan-400/30 shadow-md">
                <img
                  src="/logo-icon.png"
                  alt="DengueSense Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-display text-lg font-bold text-white">
                Dengue<span className="text-red-500">Sense</span>
              </span>
            </Link>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white ml-auto"
            >
              <ArrowLeft size={13} />
              <span>{vi.auth.backToLanding}</span>
            </Link>
          </div>

          {/* Centered Auth Card Container */}
          <div className="my-auto w-full max-w-md mx-auto py-6 space-y-6">
            {/* Official Project Logo & Card Header */}
            <div className="text-center sm:text-left">
              <div className="hidden lg:flex items-center gap-3.5 mb-5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/25 via-slate-900 to-slate-950 p-2.5 ring-1 ring-cyan-500/40 shadow-[0_0_25px_rgba(14,165,233,0.35)]">
                  <img
                    src="/logo-icon.png"
                    alt="DengueSense Logo"
                    className="h-full w-full object-contain drop-shadow"
                  />
                </div>
                <div>
                  <div className="font-display text-2xl font-bold tracking-tight text-white leading-none">
                    Dengue<span className="text-red-500">Sense</span>
                  </div>
                  <div className="text-xs text-slate-400 font-medium tracking-wide mt-1">
                    Cổng Điều Hành Y Tế Số
                  </div>
                </div>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {vi.auth.title}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
                {vi.auth.subtitle}
              </p>
            </div>

            {/* Demo Quick-Select Role Switcher (Linear/Vercel Style) */}
            {isDemo && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur-md space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-cyan-400" />
                    <span>{vi.auth.demoAccounts}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">Chọn nhanh 1 chạm</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((a) => {
                    const meta = ROLE_METADATA[a.username] ?? {
                      label: a.displayName,
                      roleTag: "User",
                      icon: Activity,
                      color: "border-slate-800 text-slate-300",
                    };
                    const Icon = meta.icon;
                    const isSelected = activeAccount === a.username;

                    return (
                      <button
                        key={a.username}
                        type="button"
                        onClick={() => handleSelectDemo(a.username, a.password)}
                        className={`group relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-500/15 shadow-[0_0_15px_rgba(14,165,233,0.25)] ring-1 ring-cyan-400"
                            : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/90"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg border text-xs ${meta.color}`}
                          >
                            <Icon size={12} />
                          </span>
                          {isSelected ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-300">
                              {vi.auth.fillDemo}
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5">
                          <div className="font-display text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {meta.label}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate max-w-[130px]">
                            {a.username}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={vi.auth.title}>
              {formError ? <Alert tone="error">{formError}</Alert> : null}

              <div className="space-y-3.5">
                <TextField
                  label={vi.auth.username}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  error={errors.username?.message}
                  {...register("username")}
                  className="bg-slate-900/90 border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm"
                />

                <TextField
                  label={vi.auth.password}
                  type="password"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  {...register("password")}
                  className="bg-slate-900/90 border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm"
                />
              </div>

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-[0_0_25px_rgba(14,165,233,0.45)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>{isSubmitting ? vi.auth.submitting : vi.auth.submit}</span>
                {!isSubmitting && <ArrowRight size={15} />}
              </Button>
            </form>
          </div>

          {/* Bottom Auxiliary Links */}
          <div className="text-center text-xs text-slate-400 pt-4">
            <span>Bảo mật hệ thống bởi </span>
            <strong className="text-white">MedSentinel Decision Platform</strong>
          </div>
        </main>
      </div>
    </div>
  );
}
