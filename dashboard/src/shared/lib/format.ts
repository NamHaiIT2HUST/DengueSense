/**
 * Định dạng số/ngày tiếng Việt (docs/10 §9.3). MỌI nơi hiển thị số/ngày phải đi qua đây — không gọi
 * `toFixed`/`toLocaleString` rải rác (luật T7: làm tròn nhất quán, không hiện `0.4123456`).
 *
 * Múi giờ hiển thị cố định Asia/Ho_Chi_Minh, không phụ thuộc múi giờ máy người dùng.
 */
const DASH = "—";
const TZ = "Asia/Ho_Chi_Minh";

const countFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const oneDecimalFmt = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Số ca: làm tròn nguyên, phân cách nghìn kiểu Việt ("1.234"). */
export function formatCount(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? DASH : countFmt.format(n);
}

const decimalFmts = new Map<number, Intl.NumberFormat>();

/** Số thực với `digits` chữ số thập phân, dấu phẩy Việt ("0,52"). */
export function formatDecimal(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  let f = decimalFmts.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    decimalFmts.set(digits, f);
  }
  return f.format(n);
}

/** Tỉ lệ ∈ [0,1] → phần trăm với `digits` chữ số thập phân ("22,2%"). Khác formatProbability (nguyên, chặn [0,1]) ở chỗ
 * dùng cho MỨC CẢI THIỆN/tỉ lệ thống kê có thể cần độ chính xác cao hơn; KHÔNG chặn ngoài [0,1] (cải thiện có thể âm). */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return DASH;
  return `${formatDecimal(ratio * 100, digits)}%`;
}

/** Tỉ lệ trên 100.000 dân: 1 chữ số thập phân ("12,3"). */
export function formatIncidence(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? DASH : oneDecimalFmt.format(n);
}

/** Xác suất ∈ [0,1] → phần trăm nguyên ("41%"). Giá trị ngoài [0,1] bị chặn để không hiện "120%". */
export function formatProbability(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return DASH;
  const clamped = Math.min(1, Math.max(0, p));
  return `${Math.round(clamped * 100)}%`;
}

/** "2010-03" → "03/2010". Sai định dạng → "—" (không ném lỗi trong lúc render). */
export function formatMonth(month: string | null | undefined): string {
  const m = month ? YEAR_MONTH.exec(month) : null;
  return m ? `${m[2]}/${m[1]}` : DASH;
}

/** Cộng n tháng vào "YYYY-MM" (n có thể âm). Sai định dạng → null. */
export function addMonths(month: string, n: number): string | null {
  const m = YEAR_MONTH.exec(month);
  if (!m || !Number.isInteger(n)) return null;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const year = Math.floor(total / 12);
  const mon = (total % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/**
 * Thời điểm RFC 3339 → "25/09/2026 09:14" giờ Việt Nam. Ghép từ các phần (formatToParts) chứ không cắt chuỗi
 * của Intl: ICU vi-VN đặt GIỜ TRƯỚC NGÀY ("09:14 25/09/2026") và thứ tự đó đổi theo phiên bản ICU.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const parts = new Map(dateTimeFmt.formatToParts(d).map((p) => [p.type, p.value] as const));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.get(t) ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Tầm dự báo: ("2010-03", 3) → "sau 3 tháng (06/2010)". */
export function formatHorizon(originMonth: string, horizon: number): string {
  const target = addMonths(originMonth, horizon);
  return target ? `sau ${horizon} tháng (${formatMonth(target)})` : `sau ${horizon} tháng`;
}
