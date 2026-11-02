import { describe, expect, it } from "vitest";

import { forecastLabels, monthIndex, timeTicks } from "./timeSeriesLayout";

describe("time-series readability", () => {
  it.each([180, 320, 728, 1300])(
    "keeps both ends of a 31-year timeline without crowding at %ipx",
    (width) => {
      const lo = monthIndex("1994-02");
      const hi = monthIndex("2025-03");
      const ticks = timeTicks(lo, hi, width);
      expect(ticks[0]).toBe("1994-02");
      expect(ticks.at(-1)).toBe("2025-03");
      expect(new Set(ticks).size).toBe(ticks.length);
      ticks.slice(1).forEach((tick, index) => {
        expect(
          ((monthIndex(tick) - monthIndex(ticks[index]!)) / (hi - lo)) * width
        ).toBeGreaterThanOrEqual(90);
      });
    }
  );

  it("shows every month when a short series has enough room, including a single month", () => {
    expect(timeTicks(monthIndex("2010-11"), monthIndex("2011-02"), 400)).toEqual([
      "2010-11",
      "2010-12",
      "2011-01",
      "2011-02",
    ]);
    expect(timeTicks(monthIndex("2010-03"), monthIndex("2010-03"), 200)).toEqual(["2010-03"]);
  });

  it.each([
    { x: 120, y: 180 },
    { x: 66, y: 57 },
    { x: 243, y: 312 },
  ])("separates coincident forecast labels near $x,$y without clipping", (point) => {
    const bounds = { left: 56, right: 250, top: 56, bottom: 312 };
    const markers = Array.from({ length: 4 }, () => point);
    const labels = forecastLabels(markers, bounds);
    labels.forEach((label, index) => {
      expect(label.x - 16).toBeGreaterThanOrEqual(bounds.left);
      expect(label.x + 16).toBeLessThanOrEqual(bounds.right);
      expect(label.y - 10).toBeGreaterThanOrEqual(bounds.top);
      expect(label.y + 10).toBeLessThanOrEqual(bounds.bottom);
      for (const other of labels.slice(index + 1)) {
        expect(Math.abs(label.x - other.x) >= 38 || Math.abs(label.y - other.y) >= 24).toBe(true);
      }
      for (const marker of markers) {
        expect(Math.abs(label.x - marker.x) >= 28 || Math.abs(label.y - marker.y) >= 22).toBe(true);
      }
    });
  });
});
