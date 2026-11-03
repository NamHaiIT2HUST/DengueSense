/** Calendar months on a linear axis, without timezone-dependent Date conversions. */
export function monthIndex(month: string): number {
  const [year, value] = month.split("-");
  return Number(year) * 12 + Number(value) - 1;
}

export function monthAt(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Keep both endpoints; only label intervening months when there is room to read them. */
export function timeTicks(lo: number, hi: number, width: number): string[] {
  if (lo === hi) return [monthAt(lo)];
  const gap = 90;
  const intervals = Math.max(1, Math.floor(width / gap));
  const minimumStep = (hi - lo) / intervals;
  const step =
    [1, 2, 3, 6, 12, 24, 36, 60, 120].find((n) => n >= minimumStep) ??
    Math.ceil(minimumStep / 120) * 120;
  const ticks = [lo];
  const distance = (a: number, b: number) => ((b - a) / (hi - lo)) * width;
  for (let i = Math.ceil((lo + 1) / step) * step; i < hi; i += step) {
    if (distance(ticks[ticks.length - 1]!, i) >= gap && distance(i, hi) >= gap) {
      ticks.push(i);
    }
  }
  return [...ticks, hi].map(monthAt);
}

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Separate the four horizon labels even when forecasts coincide or touch an axis. */
export function forecastLabels(points: readonly Point[], bounds: Bounds): Point[] {
  const placed: Point[] = [];
  const fits = (candidate: Point) =>
    candidate.x - 18 >= bounds.left &&
    candidate.x + 18 <= bounds.right &&
    candidate.y - 12 >= bounds.top &&
    candidate.y + 12 <= bounds.bottom &&
    placed.every((p) => Math.abs(p.x - candidate.x) >= 38 || Math.abs(p.y - candidate.y) >= 24) &&
    points.every((p) => Math.abs(p.x - candidate.x) >= 28 || Math.abs(p.y - candidate.y) >= 22);

  for (const point of points) {
    const candidates: Point[] = [];
    for (let offset = 24; offset < bounds.bottom - bounds.top; offset += 24) {
      for (const dy of [-offset, offset]) {
        for (const dx of [0, -38, 38, -76, 76]) {
          candidates.push({
            x: Math.max(bounds.left + 18, Math.min(bounds.right - 18, point.x + dx)),
            y: point.y + dy,
          });
        }
      }
    }
    const position = candidates.find(fits) ?? { x: point.x, y: bounds.top + 12 };
    placed.push(position);
  }
  return placed;
}
