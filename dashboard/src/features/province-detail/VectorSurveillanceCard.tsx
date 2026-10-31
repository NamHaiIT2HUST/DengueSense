import { useMemo, useState } from "react";
import { Bug, Download, Info, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { exportCsv } from "@/shared/lib/exportCsv";
import { notify } from "@/shared/lib/notify";
import {
  calculateVectorIndices,
  type EntomologicalSurveyData,
  getProvinceVectorSurvey,
} from "@/shared/lib/vectorSurveillance";
import { Button } from "@/shared/ui/Button";

export interface VectorSurveillanceCardProps {
  provinceId: string;
  provinceName: string;
}

export function VectorSurveillanceCard({ provinceId, provinceName }: VectorSurveillanceCardProps) {
  const initialSurvey = useMemo(() => getProvinceVectorSurvey(provinceId), [provinceId]);
  const [survey, setSurvey] = useState<EntomologicalSurveyData>(initialSurvey);

  const assessment = useMemo(() => calculateVectorIndices(survey), [survey]);

  function handleReset() {
    setSurvey(getProvinceVectorSurvey(provinceId));
    notify.info("Đã đặt lại dữ liệu", "Phục hồi bộ chỉ số côn trùng điều tra thực địa ban đầu.");
  }

  function handleExportCsv() {
    exportCsv(
      `DengueSense_${provinceName}_Giam_Sat_Con_Trung_QD3711_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: "Chỉ số côn trùng (Entomological Index)", key: (r) => r.metric },
        { header: "Giá trị đo đạc thực địa", key: (r) => r.value },
        { header: "Ngưỡng cảnh báo QĐ 3711/QĐ-BYT", key: (r) => r.threshold },
        { header: "Đánh giá mức độ rủi ro", key: (r) => r.status },
      ],
      [
        {
          metric: "Chỉ số Breteau (BI)",
          value: `${assessment.breteauIndex} dụng cụ/100 nhà`,
          threshold: "Ngưỡng an toàn < 20; Ngưỡng báo động ≥ 30",
          status: assessment.breteauIndex >= 30 ? "Vượt ngưỡng nguy cơ cao" : "Dưới ngưỡng",
        },
        {
          metric: "Chỉ số nhà có bọ gậy (HI)",
          value: `${assessment.houseIndex}%`,
          threshold: "Ngưỡng báo động ≥ 20%",
          status: assessment.houseIndex >= 20 ? "Vượt ngưỡng" : "Bình thường",
        },
        {
          metric: "Chỉ số dụng cụ có bọ gậy (CI)",
          value: `${assessment.containerIndex}%`,
          threshold: "Ngưỡng báo động ≥ 10%",
          status: assessment.containerIndex >= 10 ? "Vượt ngưỡng" : "Bình thường",
        },
        {
          metric: "Mật độ muỗi Aedes cái (DI)",
          value: `${assessment.densityIndex} con/nhà`,
          threshold: "Ngưỡng báo động ≥ 0.5 con/nhà",
          status: assessment.densityIndex >= 0.5 ? "Vượt ngưỡng nguy hiểm" : "Bình thường",
        },
        {
          metric: "Tổng số nhà điều tra",
          value: `${survey.housesInspected} nhà`,
          threshold: "Chuẩn tối thiểu 100 nhà/điểm điều tra",
          status: "Đạt chuẩn quy trình",
        },
        {
          metric: "Tổng số dụng cụ chứa nước kiểm tra",
          value: `${survey.containersInspected} dụng cụ`,
          threshold: "Toàn bộ bể chứa, lu, vại, phế thải",
          status: "Đạt chuẩn quy trình",
        },
      ]
    );

    notify.success(
      "Xuất dữ liệu giám sát côn trùng thành công",
      "Đã tải về tệp khảo sát thực địa vector truyền bệnh chuẩn RFC 4180 Excel."
    );
  }

  const isAlarm = assessment.riskLevel === "alarm" || assessment.riskLevel === "outbreak_imminent";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <Bug size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
                Giám Sát Côn Trùng Thực Địa & Chỉ Số Vector
              </h3>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                QĐ 3711/QĐ-BYT
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
              Chỉ số điều tra bọ gậy và muỗi truyền bệnh tại {provinceName} theo quy chuẩn Bộ Y tế.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="px-2.5 py-1 text-xs gap-1 text-[var(--ink-secondary)]"
            onClick={handleReset}
            title="Đặt lại về số liệu khảo sát gốc"
          >
            <RotateCcw size={13} />
            Đặt lại
          </Button>
          <Button
            variant="secondary"
            className="px-2.5 py-1 text-xs gap-1"
            onClick={handleExportCsv}
          >
            <Download size={13} />
            Xuất số liệu côn trùng (.csv)
          </Button>
        </div>
      </div>

      {/* 4 Core Index Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Breteau Index */}
        <div
          className={`rounded-xl border p-3 ${
            assessment.breteauIndex >= 30
              ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/20"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--ink-secondary)]">
              Chỉ số Breteau (BI)
            </span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                assessment.breteauIndex >= 30
                  ? "bg-red-500/20 text-[var(--status-critical-ink)]"
                  : "bg-emerald-500/20 text-[var(--status-good-ink)]"
              }`}
            >
              Ngưỡng: 30
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {assessment.breteauIndex}
            </span>
            <span className="text-[10px] text-[var(--ink-muted)]">dụng cụ/100 nhà</span>
          </div>
          <div className="mt-2 text-[10px] text-[var(--ink-muted)]">
            {assessment.breteauIndex >= 30 ? (
              <span className="font-semibold text-[var(--status-critical-ink)]">
                ⚠️ Vượt ngưỡng bùng dịch
              </span>
            ) : (
              <span className="text-[var(--status-good-ink)]">✓ Mức kiểm soát an toàn</span>
            )}
          </div>
        </div>

        {/* House Index */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--ink-secondary)]">
              Nhà có bọ gậy (HI)
            </span>
            <span className="text-[9px] font-bold text-[var(--ink-muted)]">Ngưỡng: 20%</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {assessment.houseIndex}%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-[var(--ink-muted)]">
            {survey.housesPositiveLarvae} / {survey.housesInspected} nhà điều tra
          </div>
        </div>

        {/* Container Index */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--ink-secondary)]">
              Dụng cụ có bọ gậy (CI)
            </span>
            <span className="text-[9px] font-bold text-[var(--ink-muted)]">Ngưỡng: 10%</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {assessment.containerIndex}%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-[var(--ink-muted)]">
            {survey.containersPositiveLarvae} / {survey.containersInspected} dụng cụ nước
          </div>
        </div>

        {/* Density Index */}
        <div
          className={`rounded-xl border p-3 ${
            assessment.densityIndex >= 0.5
              ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--ink-secondary)]">
              Mật độ muỗi (DI)
            </span>
            <span className="text-[9px] font-bold text-[var(--ink-muted)]">Ngưỡng: 0.50</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {assessment.densityIndex}
            </span>
            <span className="text-[10px] text-[var(--ink-muted)]">con cái/nhà</span>
          </div>
          <div className="mt-2 text-[10px] text-[var(--ink-muted)]">
            Tổng {survey.femaleAedesCount} muỗi Aedes bắt được
          </div>
        </div>
      </div>

      {/* Field Adjustment Sliders (Simulation sandbox) */}
      <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-primary)]">
          <Info size={13} className="text-[var(--accent)]" />
          <span>Mô phỏng cập nhật số liệu khảo sát thực địa tại điểm điều tra:</span>
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
              <label htmlFor="survey-larvae">Số dụng cụ có lăng quăng (tổng cộng):</label>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">
                {survey.totalLarvaeContainers} dụng cụ
              </span>
            </div>
            <input
              id="survey-larvae"
              type="range"
              min="0"
              max="120"
              step="1"
              value={survey.totalLarvaeContainers}
              onChange={(e) =>
                setSurvey((prev) => ({
                  ...prev,
                  totalLarvaeContainers: parseInt(e.target.value, 10),
                  containersPositiveLarvae: Math.min(
                    prev.containersInspected,
                    parseInt(e.target.value, 10)
                  ),
                }))
              }
              className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
              <label htmlFor="survey-aedes">Số lượng muỗi Aedes cái bắt được:</label>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">
                {survey.femaleAedesCount} con
              </span>
            </div>
            <input
              id="survey-aedes"
              type="range"
              min="0"
              max="150"
              step="1"
              value={survey.femaleAedesCount}
              onChange={(e) =>
                setSurvey((prev) => ({
                  ...prev,
                  femaleAedesCount: parseInt(e.target.value, 10),
                }))
              }
              className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Tactical Public Health Recommendation Banner */}
      <div
        className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 border text-xs ${
          isAlarm
            ? "border-red-500/30 bg-red-500/10 text-[var(--status-critical-ink)]"
            : "border-emerald-500/30 bg-emerald-500/10 text-[var(--status-good-ink)]"
        }`}
      >
        {isAlarm ? (
          <ShieldAlert size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
        ) : (
          <ShieldCheck
            size={18}
            className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
          />
        )}
        <div className="space-y-1">
          <div className="font-semibold">
            {assessment.levelLabel} — Phân loại giám sát vector y tế:
          </div>
          <div className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
            {assessment.recommendedAction}
          </div>
        </div>
      </div>
    </div>
  );
}
