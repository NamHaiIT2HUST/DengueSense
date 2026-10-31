import { DollarSign, HeartPulse, TrendingUp, ShieldCheck } from "lucide-react";

import { formatCurrency, formatDecimal } from "@/shared/lib/format";

interface Props {
  casesPrevented: number;
  interventionCost: number;
}

// Định mức kinh tế y tế (WHO & Bộ Y tế Việt Nam)
const DIRECT_MEDICAL_COST_PER_CASE = 5_200_000; // 5.2 triệu VNĐ: Viện phí, xét nghiệm NS1/IgM, dịch truyền, hồi sức
const INDIRECT_SOCIETAL_COST_PER_CASE = 3_800_000; // 3.8 triệu VNĐ: Ngày công lao động mất, chi phí người thân chăm sóc
const DALYS_SAVED_PER_CASE = 0.045; // DALYs tránh được trên mỗi ca bệnh (mô hình GBD - Global Burden of Disease)

export function HealthEconomicsEvaluation({ casesPrevented, interventionCost }: Props) {
  if (casesPrevented <= 0) return null;

  const directMedicalSaved = casesPrevented * DIRECT_MEDICAL_COST_PER_CASE;
  const indirectSocietalSaved = casesPrevented * INDIRECT_SOCIETAL_COST_PER_CASE;
  const totalEconomicBenefit = directMedicalSaved + indirectSocietalSaved;
  const netBenefit = totalEconomicBenefit - interventionCost;
  const benefitCostRatio =
    interventionCost > 0 ? (totalEconomicBenefit / interventionCost).toFixed(1) : "N/A";
  const dalysAverted = (casesPrevented * DALYS_SAVED_PER_CASE).toFixed(1);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <HeartPulse size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Đánh Giá Hiệu Quả Kinh Tế Y Tế & DALYs
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Đối chuẩn phương án can thiệp sớm MILP so với phản ứng thụ động
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck size={12} />
          <span>ROI: 1 đồng đầu tư tiết kiệm {benefitCostRatio} đồng</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tiết kiệm y tế trực tiếp */}
        <div className="rounded-lg bg-white/70 p-3 border border-emerald-500/15 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Viện phí & Điều trị tránh được</span>
            <DollarSign size={13} className="text-emerald-500" />
          </div>
          <span className="mt-1 block text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCurrency(directMedicalSaved)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            ≈ 5.2 tr.đ / ca cấp cứu, nội trú
          </span>
        </div>

        {/* Tiết kiệm gián tiếp xã hội */}
        <div className="rounded-lg bg-white/70 p-3 border border-emerald-500/15 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Chi phí xã hội & Ngày công</span>
            <TrendingUp size={13} className="text-blue-500" />
          </div>
          <span className="mt-1 block text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums">
            {formatCurrency(indirectSocietalSaved)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            ≈ 3.8 tr.đ / ca năng suất & chăm sóc
          </span>
        </div>

        {/* Lợi ích kinh tế ròng */}
        <div className="rounded-lg bg-white/70 p-3 border border-emerald-500/15 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Lợi ích kinh tế ròng (Net)</span>
            <ShieldCheck size={13} className="text-indigo-500" />
          </div>
          <span className="mt-1 block text-base font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
            {formatCurrency(netBenefit)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Tổng lợi ích trừ chi phí can thiệp
          </span>
        </div>

        {/* DALYs bảo vệ */}
        <div className="rounded-lg bg-white/70 p-3 border border-emerald-500/15 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Gánh nặng bệnh tật tránh được</span>
            <HeartPulse size={13} className="text-rose-500" />
          </div>
          <span className="mt-1 block text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            ≈ {formatDecimal(Number(dalysAverted), 1)} DALYs
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Năm sống lành mạnh được bảo toàn
          </span>
        </div>
      </div>
    </div>
  );
}
