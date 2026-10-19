import { useId, useMemo, useState } from "react";
import { exportCsv } from "@/shared/lib/exportCsv";
import { notify } from "@/shared/lib/notify";
import { Card } from "@/shared/ui/Card";
import {
  DEFAULT_SEIRV_PARAMS,
  type PresetKey,
  PRESET_SCENARIOS,
  type SeirvParameters,
  simulateSeirv,
} from "./seirvModel";

export function SeirvSimulationPlayground() {
  const [params, setParams] = useState<SeirvParameters>(DEFAULT_SEIRV_PARAMS);
  const [activePreset, setActivePreset] = useState<string>("baseline");

  const tempId = useId();
  const larvicideId = useId();
  const ulvId = useId();
  const mosquitoDensityId = useId();

  // Run simulation for current params and baseline for comparison
  const simulation = useMemo(() => simulateSeirv(params), [params]);
  const baselineSim = useMemo(() => simulateSeirv(PRESET_SCENARIOS.baseline.params), []);

  const casesAverted = Math.max(0, baselineSim.totalCases - simulation.totalCases);
  const avertedPercent =
    baselineSim.totalCases > 0 ? ((casesAverted / baselineSim.totalCases) * 100).toFixed(1) : "0";

  const handlePresetSelect = (key: PresetKey) => {
    setActivePreset(key);
    const preset = PRESET_SCENARIOS[key];
    if (preset) {
      setParams((prev) => ({
        ...prev,
        ...preset.params,
      }));
      notify.info(
        `Đã kích hoạt kịch bản: ${preset.name}`,
        "Tham số can thiệp dịch tễ SEIR-V đã được cập nhật tương ứng."
      );
    }
  };

  const handleExportCsv = () => {
    exportCsv(
      `denguesense_seirv_simulation_${activePreset}.csv`,
      [
        { header: "Ngày", key: (r) => r.day },
        { header: "Người nhạy cảm (Sh)", key: (r) => r.sh },
        { header: "Người ủ bệnh (Eh)", key: (r) => r.eh },
        { header: "Người nhiễm bệnh (Ih)", key: (r) => r.ih },
        { header: "Người hồi phục (Rh)", key: (r) => r.rh },
        { header: "Tỷ lệ muỗi nhiễm virus (Iv)", key: (r) => r.ivFraction },
        { header: "Ca mắc mới tích lũy", key: (r) => r.cumulativeCases },
        { header: "Hệ số lây nhiễm hiệu dụng Rt", key: (r) => r.rt },
      ],
      simulation.timeline
    );
    notify.success(
      "Xuất dữ liệu mô phỏng thành công",
      `Đã tải về tệp denguesense_seirv_simulation_${activePreset}.csv chuẩn RFC 4180 Excel.`
    );
  };

  // SVG dimensions for responsive chart
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxCases = Math.max(...simulation.timeline.map((t) => t.ih), baselineSim.peakCases, 100);

  const points = simulation.timeline.map((step) => {
    const x = padding.left + (step.day / params.simulationDays) * chartW;
    const y = padding.top + chartH - (step.ih / maxCases) * chartH;
    return `${x},${y}`;
  });

  const baselinePoints = baselineSim.timeline.map((step) => {
    const x = padding.left + (step.day / params.simulationDays) * chartW;
    const y = padding.top + chartH - (step.ih / maxCases) * chartH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding.left},${padding.top + chartH}`,
    ...points,
    `${padding.left + chartW},${padding.top + chartH}`,
  ].join(" ");

  const peakX = padding.left + (simulation.peakDay / params.simulationDays) * chartW;
  const peakY = padding.top + chartH - (simulation.peakCases / maxCases) * chartH;

  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--ink-primary)]">
              Mô phỏng Động học Lan truyền SEIR-V
            </h2>
            <span className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-secondary)]">
              Mechanistic ODE (RK4)
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Tích phân số học hệ phương trình vi phân Ross-Macdonald, định lượng tác động của can
            thiệp lên hệ số lây nhiễm $R_0$, $R_t$ và đường cong dịch bệnh.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--ink-primary)] transition hover:border-[var(--accent-ink)] hover:text-[var(--accent-ink)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Xuất dữ liệu (.csv)
        </button>
      </div>

      {/* Preset Scenarios Buttons */}
      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Kịch bản can thiệp tác chiến định sẵn (1-Click Presets)
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(PRESET_SCENARIOS).map(([key, item]) => {
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key as PresetKey)}
                className={`rounded-lg border p-2.5 text-left transition ${
                  isSelected
                    ? "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-ink)] shadow-sm ring-1 ring-[var(--selection-border)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <div className="text-xs font-semibold text-[var(--ink-primary)]">{item.name}</div>
                <div className="mt-1 line-clamp-2 text-[10px] text-[var(--ink-secondary)]">
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intervention Sliders & Controls */}
      <div className="mt-5 grid gap-4 rounded-xl bg-[var(--bg-surface-2)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex justify-between text-xs">
            <label htmlFor={larvicideId} className="font-medium text-[var(--ink-primary)]">
              Diệt bọ gậy / BI-HI
            </label>
            <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
              {Math.round(params.larvicideEfficacy * 100)}%
            </span>
          </div>
          <input
            id={larvicideId}
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={params.larvicideEfficacy}
            onChange={(e) => {
              setActivePreset("custom");
              setParams((p) => ({
                ...p,
                larvicideEfficacy: parseFloat(e.target.value),
              }));
            }}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--border-subtle)] accent-[var(--accent-ink)]"
          />
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Giảm tốc độ sinh muỗi mới $\Lambda_v$
          </p>
        </div>

        <div>
          <div className="flex justify-between text-xs">
            <label htmlFor={ulvId} className="font-medium text-[var(--ink-primary)]">
              Phun không gian ULV
            </label>
            <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
              {Math.round(params.spaceSprayingCoverage * 100)}%
            </span>
          </div>
          <input
            id={ulvId}
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={params.spaceSprayingCoverage}
            onChange={(e) => {
              setActivePreset("custom");
              setParams((p) => ({
                ...p,
                spaceSprayingCoverage: parseFloat(e.target.value),
              }));
            }}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--border-subtle)] accent-[var(--accent-ink)]"
          />
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Tăng tỷ lệ tử vong muỗi trưởng thành $\mu_v$
          </p>
        </div>

        <div>
          <div className="flex justify-between text-xs">
            <label htmlFor={tempId} className="font-medium text-[var(--ink-primary)]">
              Nhiệt độ môi trường
            </label>
            <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
              {params.temperatureC.toFixed(1)}°C
            </span>
          </div>
          <input
            id={tempId}
            type="range"
            min="18"
            max="35"
            step="0.5"
            value={params.temperatureC}
            onChange={(e) => {
              setActivePreset("custom");
              setParams((p) => ({
                ...p,
                temperatureC: parseFloat(e.target.value),
              }));
            }}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--border-subtle)] accent-[var(--accent-ink)]"
          />
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Ảnh hưởng chu kỳ ủ bệnh ngoại sinh $\sigma_v(T)$
          </p>
        </div>

        <div>
          <div className="flex justify-between text-xs">
            <label htmlFor={mosquitoDensityId} className="font-medium text-[var(--ink-primary)]">
              Mật độ muỗi / Người
            </label>
            <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
              {params.mosquitoPerPerson.toFixed(1)}
            </span>
          </div>
          <input
            id={mosquitoDensityId}
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={params.mosquitoPerPerson}
            onChange={(e) => {
              setActivePreset("custom");
              setParams((p) => ({
                ...p,
                mosquitoPerPerson: parseFloat(e.target.value),
              }));
            }}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--border-subtle)] accent-[var(--accent-ink)]"
          />
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">Tỷ số vector $m = N_v / N_h$</p>
        </div>
      </div>

      {/* Calculated Epidemic KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="text-xs text-[var(--ink-secondary)]">Hệ số lây nhiễm $R_0$</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {simulation.r0.toFixed(2)}
            </span>
            <span
              className={`text-xs font-semibold ${
                simulation.r0 < 1.0
                  ? "text-[var(--status-good-ink)]"
                  : simulation.r0 < 1.8
                    ? "text-[var(--status-warning-ink)]"
                    : "text-[var(--status-critical-ink)]"
              }`}
            >
              {simulation.r0 < 1.0 ? "R₀ < 1 (Kiểm soát)" : "R₀ ≥ 1 (Lây lan)"}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--ink-muted)]">Hệ số cơ bản đầu chu kỳ</div>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="text-xs text-[var(--ink-secondary)]">Đỉnh dịch ($I_h$)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {simulation.peakCases.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">(Ngày {simulation.peakDay})</span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Số ca mắc đồng thời cao nhất
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="text-xs text-[var(--ink-secondary)]">Ca tích lũy (120 ngày)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
              {simulation.totalCases.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">
              ({simulation.attackRatePercent}%)
            </span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--ink-muted)]">Tỷ lệ tấn công cộng đồng</div>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <div className="text-xs text-[var(--ink-secondary)]">Ca ngăn chặn (Averted)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--status-good-ink)]">
              +{casesAverted.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs font-semibold text-[var(--status-good-ink)]">
              (-{avertedPercent}%)
            </span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Hiệu quả so với không can thiệp
          </div>
        </div>
      </div>

      {/* SVG Interactive Epidemiological Curve */}
      <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
        <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
          <span className="font-medium text-[var(--ink-primary)]">
            Đường cong ca nhiễm hoạt động $I_h(t)$ theo thời gian
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)] opacity-60" />
              <span>Không can thiệp (Baseline)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-ink)]" />
              <span>Kịch bản hiện tại</span>
            </div>
          </div>
        </div>

        <div className="relative mt-3 w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full min-w-[500px]"
            role="img"
            aria-label="Biểu đồ đường cong dịch tễ SEIR-V so sánh kịch bản can thiệp với kịch bản gốc"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
              const y = padding.top + chartH * frac;
              const val = Math.round(maxCases * (1 - frac));
              return (
                <g key={frac}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + chartW}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--ink-muted)"
                  >
                    {val.toLocaleString("vi-VN")}
                  </text>
                </g>
              );
            })}

            {/* X-axis days */}
            {[0, 30, 60, 90, 120].map((day) => {
              const x = padding.left + (day / params.simulationDays) * chartW;
              return (
                <g key={day}>
                  <line
                    x1={x}
                    y1={padding.top + chartH}
                    x2={x}
                    y2={padding.top + chartH + 5}
                    stroke="var(--border-strong)"
                  />
                  <text
                    x={x}
                    y={padding.top + chartH + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--ink-muted)"
                  >
                    N{day}
                  </text>
                </g>
              );
            })}

            {/* Baseline Curve (Dashed) */}
            <polyline
              fill="none"
              stroke="var(--ink-muted)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
              points={baselinePoints.join(" ")}
            />

            {/* Current Scenario Area Fill */}
            <polygon fill="var(--accent-subtle)" opacity="0.4" points={areaPoints} />

            {/* Current Scenario Curve */}
            <polyline
              fill="none"
              stroke="var(--accent-ink)"
              strokeWidth="2.5"
              points={points.join(" ")}
            />

            {/* Peak Marker */}
            <circle
              cx={peakX}
              cy={peakY}
              r="4.5"
              fill="var(--accent-ink)"
              stroke="var(--bg-surface)"
              strokeWidth="2"
            />
            <text
              x={peakX}
              y={Math.max(peakY - 8, padding.top + 10)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="var(--accent-ink)"
            >
              Đỉnh: {simulation.peakCases.toLocaleString("vi-VN")} ca
            </text>
          </svg>
        </div>
      </div>
    </Card>
  );
}
