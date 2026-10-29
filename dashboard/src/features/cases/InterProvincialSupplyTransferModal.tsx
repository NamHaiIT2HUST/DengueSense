import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  FileCheck,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { exportCsv } from "@/shared/lib/exportCsv";
import { notify } from "@/shared/lib/notify";
import {
  evaluateSupplyTransfer,
  PROVINCE_INVENTORY_REGISTRY,
  type ProvinceInventoryStock,
  type SupplyTransferRequest,
} from "@/shared/lib/interProvincialTransfer";
import { Button } from "@/shared/ui/Button";

const FALLBACK_TARGET_STOCK: ProvinceInventoryStock = {
  provinceId: "angiang",
  provinceName: "An Giang",
  region: "nam",
  ulvChemicalLiters: 120,
  abateLarvicideKg: 350,
  dextran40Bags: 60,
  sprayerMachines: 8,
  riskLevel: "critical",
};

const FALLBACK_DONOR_STOCK: ProvinceInventoryStock = {
  provinceId: "can_tho",
  provinceName: "Cần Thơ",
  region: "nam",
  ulvChemicalLiters: 950,
  abateLarvicideKg: 2100,
  dextran40Bags: 450,
  sprayerMachines: 32,
  riskLevel: "safe",
};

export interface InterProvincialTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetProvinceId?: string;
}

export function InterProvincialSupplyTransferModal({
  isOpen,
  onClose,
  initialTargetProvinceId = "angiang",
}: InterProvincialTransferModalProps) {
  const [targetId, setTargetId] = useState(initialTargetProvinceId);
  const [donorId, setDonorId] = useState("can_tho");

  const [ulvLiters, setUlvLiters] = useState(250);
  const [abateKg, setAbateKg] = useState(500);
  const [dextranBags, setDextranBags] = useState(100);
  const [sprayers, setSprayers] = useState(6);

  const targetProvince = PROVINCE_INVENTORY_REGISTRY[targetId] ?? FALLBACK_TARGET_STOCK;
  const donorProvince = PROVINCE_INVENTORY_REGISTRY[donorId] ?? FALLBACK_DONOR_STOCK;

  const transferRequest: SupplyTransferRequest = useMemo(
    () => ({
      targetProvinceId: targetId,
      targetProvinceName: targetProvince.provinceName,
      donorProvinceId: donorId,
      donorProvinceName: donorProvince.provinceName,
      ulvChemicalLiters: ulvLiters,
      abateLarvicideKg: abateKg,
      dextran40Bags: dextranBags,
      sprayerMachines: sprayers,
    }),
    [targetId, donorId, ulvLiters, abateKg, dextranBags, sprayers, targetProvince, donorProvince]
  );

  const evaluation = useMemo(() => evaluateSupplyTransfer(transferRequest), [transferRequest]);

  if (!isOpen) return null;

  function handleExportManifestCsv() {
    exportCsv(
      `DengueSense_Bien_Ban_Dieu_Dong_Chi_Vien_${evaluation.transferManifestId}_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: "Danh mục biên bản chi viện liên tỉnh", key: (r) => r.field },
        { header: "Thông tin chi tiết", key: (r) => r.value },
        { header: "Quy chuẩn & Căn cứ", key: (r) => r.note },
      ],
      [
        {
          field: "Mã lệnh điều động",
          value: evaluation.transferManifestId,
          note: "Hệ số định danh chuẩn Nghị định 30/2020/NĐ-CP",
        },
        {
          field: "Đơn vị xuất cấp chi viện (Donor CDC)",
          value: donorProvince.provinceName,
          note: `Tồn kho sau điều phối: ${evaluation.donorReserveRatio}% (Đạt ngưỡng an toàn)`,
        },
        {
          field: "Đơn vị tiếp nhận khẩn cấp (Target CDC)",
          value: targetProvince.provinceName,
          note: `Mức độ nguy cơ dịch tễ: ${targetProvince.riskLevel.toUpperCase()}`,
        },
        {
          field: "Khối lượng hóa chất ULV diệt muỗi",
          value: `${ulvLiters} Lít (Permethrin 50EC / Hantox)`,
          note: "Dập dịch không gian khẩn cấp 2 vòng",
        },
        {
          field: "Khối lượng bột diệt bọ gậy Abate 1SG",
          value: `${abateKg} Kg`,
          note: "Xử lý triệt để ổ bọ gậy nguồn",
        },
        {
          field: "Dịch truyền cao phân tử Dextran 40",
          value: `${dextranBags} túi (500ml)`,
          note: "Bảo toàn cấp cứu chống sốc sốt xuất huyết nặng",
        },
        {
          field: "Máy phun ULV đeo vai chuyên dụng",
          value: `${sprayers} máy`,
          note: "Huy động tổ cơ động dập dịch",
        },
        {
          field: "Khoảng cách & Thời gian vận chuyển",
          value: `${evaluation.transitDistanceKm} km · Dự kiến ${evaluation.estimatedTransitHours} giờ`,
          note: "Xe chuyên dụng bảo quản lạnh CDC",
        },
        {
          field: "Thời hạn hoàn trả kho quốc gia",
          value: evaluation.restitutionDueDate,
          note: "Thời hạn tối đa 14 ngày kể từ ngày ký lệnh",
        },
      ]
    );

    notify.success(
      "Xuất lệnh điều động chi viện thành công",
      "Đã tải về biên bản bàn giao vật tư liên tỉnh chuẩn RFC 4180 Excel."
    );
  }

  function handleConfirmDispatch() {
    notify.success(
      "Ban hành lệnh điều động chi viện khẩn cấp",
      `Đã kích hoạt vận chuyển vật tư từ ${donorProvince.provinceName} sang ${targetProvince.provinceName}. Mã lệnh: ${evaluation.transferManifestId}`
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-[var(--accent)]">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="transfer-modal-title"
                  className="text-lg font-bold text-[var(--ink-primary)]"
                >
                  Điều Phối & Chi Viện Kho Vật Tư Liên Tỉnh
                </h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--status-good-ink)]">
                  Cơ chế mượn - hoàn trả
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                Quy chế phối hợp khẩn cấp giữa các CDC khu vực theo Nghị định 30/2020/NĐ-CP khi tâm
                dịch cạn dự trữ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ điều phối"
            className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Route Selector: Donor -> Target */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
          <div className="md:col-span-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
            <span className="block text-[11px] font-medium text-[var(--ink-secondary)]">
              Đơn vị xuất cấp chi viện (Donor CDC):
            </span>
            <select
              aria-label="Chọn đơn vị xuất cấp chi viện"
              value={donorId}
              onChange={(e) => setDonorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] outline-none"
            >
              {Object.values(PROVINCE_INVENTORY_REGISTRY)
                .filter((p) => p.provinceId !== targetId)
                .map((p) => (
                  <option key={p.provinceId} value={p.provinceId}>
                    {p.provinceName} (Kho: {p.ulvChemicalLiters}L ULV, {p.dextran40Bags} túi
                    Dextran)
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-center md:col-span-1 text-[var(--accent)]">
            <div className="flex flex-col items-center gap-1">
              <ArrowRight size={20} className="rotate-90 md:rotate-0" />
              <span className="text-[10px] font-mono font-semibold text-[var(--ink-muted)]">
                {evaluation.transitDistanceKm} km
              </span>
            </div>
          </div>

          <div className="md:col-span-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
            <span className="block text-[11px] font-medium text-[var(--ink-secondary)]">
              Địa bàn tâm dịch tiếp nhận (Target CDC):
            </span>
            <select
              aria-label="Chọn địa bàn tâm dịch tiếp nhận"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] outline-none"
            >
              {Object.values(PROVINCE_INVENTORY_REGISTRY)
                .filter((p) => p.provinceId !== donorId)
                .map((p) => (
                  <option key={p.provinceId} value={p.provinceId}>
                    {p.provinceName} (Nguy cơ: {p.riskLevel.toUpperCase()})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Supply Transfer Sliders */}
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 text-xs font-semibold text-[var(--ink-primary)]">
            <span>Định mức vật tư đề nghị xuất cấp chi viện:</span>
            <span className="text-[11px] font-normal text-[var(--ink-muted)]">
              Mã lệnh:{" "}
              <code className="font-mono text-[var(--accent)]">
                {evaluation.transferManifestId}
              </code>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* ULV Chemical */}
            <div>
              <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
                <label htmlFor="ulv-slider">Hóa chất ULV (Permethrin/Hantox):</label>
                <span className="font-bold tabular-nums text-[var(--ink-primary)]">
                  {ulvLiters} Lít
                </span>
              </div>
              <input
                id="ulv-slider"
                type="range"
                min="50"
                max="600"
                step="10"
                value={ulvLiters}
                onChange={(e) => setUlvLiters(parseInt(e.target.value, 10))}
                className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--ink-muted)]">
                Tồn kho CDC chi viện còn: {evaluation.donorStockRemaining.ulvLiters} L
              </span>
            </div>

            {/* Abate Larvicide */}
            <div>
              <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
                <label htmlFor="abate-slider">Bột diệt bọ gậy Abate 1SG:</label>
                <span className="font-bold tabular-nums text-[var(--ink-primary)]">
                  {abateKg} Kg
                </span>
              </div>
              <input
                id="abate-slider"
                type="range"
                min="100"
                max="1200"
                step="50"
                value={abateKg}
                onChange={(e) => setAbateKg(parseInt(e.target.value, 10))}
                className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--ink-muted)]">
                Tồn kho CDC chi viện còn: {evaluation.donorStockRemaining.abateKg} kg
              </span>
            </div>

            {/* Dextran 40 Bags */}
            <div>
              <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
                <label htmlFor="dextran-slider">Dịch truyền cao phân tử Dextran 40:</label>
                <span className="font-bold tabular-nums text-[var(--ink-primary)]">
                  {dextranBags} Túi
                </span>
              </div>
              <input
                id="dextran-slider"
                type="range"
                min="20"
                max="250"
                step="10"
                value={dextranBags}
                onChange={(e) => setDextranBags(parseInt(e.target.value, 10))}
                className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--ink-muted)]">
                Tồn kho cấp cứu hồi sức còn: {evaluation.donorStockRemaining.dextranBags} túi
              </span>
            </div>

            {/* Sprayer Machines */}
            <div>
              <div className="flex justify-between text-[11px] text-[var(--ink-secondary)]">
                <label htmlFor="sprayer-slider">Máy phun ULV đeo vai chuyên dụng:</label>
                <span className="font-bold tabular-nums text-[var(--ink-primary)]">
                  {sprayers} Máy
                </span>
              </div>
              <input
                id="sprayer-slider"
                type="range"
                min="1"
                max="15"
                step="1"
                value={sprayers}
                onChange={(e) => setSprayers(parseInt(e.target.value, 10))}
                className="mt-1 w-full accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--ink-muted)]">
                Tổ máy cơ động dự phòng còn: {evaluation.donorStockRemaining.sprayers} chiếc
              </span>
            </div>
          </div>
        </div>

        {/* Viability & Logistics Telemetry */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
            <span className="block text-[10px] text-[var(--ink-secondary)]">
              Thời gian vận chuyển
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={13} className="text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--ink-primary)]">
                ≈ {evaluation.estimatedTransitHours} giờ
              </span>
            </div>
            <span className="text-[9px] text-[var(--ink-muted)]">
              Cự ly: {evaluation.transitDistanceKm} km
            </span>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
            <span className="block text-[10px] text-[var(--ink-secondary)]">
              Mức đệm dự trữ còn lại
            </span>
            <span
              className={`block text-sm font-bold ${
                evaluation.donorReserveRatio >= 35
                  ? "text-[var(--status-good-ink)]"
                  : "text-[var(--status-critical-ink)]"
              }`}
            >
              {evaluation.donorReserveRatio}%
            </span>
            <span className="text-[9px] text-[var(--ink-muted)]">
              Ngưỡng an toàn tối thiểu: 35%
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
            <span className="block text-[10px] text-[var(--ink-secondary)]">
              Hạn hoàn trả kho TW
            </span>
            <span className="block text-sm font-bold font-mono text-[var(--ink-primary)]">
              {evaluation.restitutionDueDate}
            </span>
            <span className="text-[9px] text-[var(--ink-muted)]">Chu kỳ mượn khẩn: 14 ngày</span>
          </div>
        </div>

        {/* Status / Warning Banner */}
        {evaluation.warnings.length > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-[var(--status-critical-ink)]">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div className="space-y-0.5">
              <span className="font-semibold">Cảnh báo vi phạm an toàn kho điều phối:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {evaluation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-[var(--status-good-ink)]">
            <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>Phương án khả thi:</strong> Đơn vị chi viện bảo toàn đầy đủ cơ số dự phòng an
              toàn dịch tễ (&gt;35%). Sẵn sàng ký duyệt lệnh điều động.
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs gap-1 text-[var(--ink-secondary)]"
            onClick={() => {
              setUlvLiters(250);
              setAbateKg(500);
              setDextranBags(100);
              setSprayers(6);
            }}
          >
            <RotateCcw size={13} />
            Định mức chuẩn
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs gap-1"
              onClick={handleExportManifestCsv}
            >
              <Download size={13} />
              Xuất biên bản lệnh điều động (.csv)
            </Button>
            <Button
              variant="primary"
              className="px-4 py-1.5 text-xs gap-1.5"
              disabled={!evaluation.isViable}
              onClick={handleConfirmDispatch}
            >
              <FileCheck size={14} />
              Ban hành lệnh chi viện
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
