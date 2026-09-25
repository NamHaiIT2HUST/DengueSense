import { describe, expect, it } from "vitest";

import {
  addMonths,
  formatCount,
  formatDateTime,
  formatDecimal,
  formatHorizon,
  formatIncidence,
  formatMonth,
  formatPercent,
  formatProbability,
} from "./format";

describe("formatCount", () => {
  it("làm tròn nguyên, phân cách nghìn kiểu Việt", () => {
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(1234567.6)).toBe("1.234.568");
    expect(formatCount(0)).toBe("0");
  });
  it("giá trị thiếu/không hữu hạn → dấu gạch", () => {
    for (const bad of [null, undefined, NaN, Infinity]) expect(formatCount(bad)).toBe("—");
  });
});

describe("formatIncidence", () => {
  it("một chữ số thập phân, dấu phẩy Việt", () => {
    expect(formatIncidence(12.34)).toBe("12,3");
    expect(formatIncidence(5)).toBe("5,0");
    expect(formatIncidence(null)).toBe("—");
  });
});

describe("formatProbability (luật T7: không hiện 0.4123456)", () => {
  it("phần trăm nguyên", () => {
    expect(formatProbability(0.41)).toBe("41%");
    expect(formatProbability(0.4123456)).toBe("41%");
    expect(formatProbability(0.005)).toBe("1%");
    expect(formatProbability(0)).toBe("0%");
    expect(formatProbability(1)).toBe("100%");
  });
  it("chặn ngoài [0,1] để không hiện 120% hay -5%", () => {
    expect(formatProbability(1.2)).toBe("100%");
    expect(formatProbability(-0.05)).toBe("0%");
  });
  it("giá trị thiếu → dấu gạch", () => {
    expect(formatProbability(NaN)).toBe("—");
    expect(formatProbability(undefined)).toBe("—");
  });
});

describe("formatMonth / addMonths / formatHorizon", () => {
  it("đổi YYYY-MM sang MM/YYYY; sai định dạng không ném lỗi", () => {
    expect(formatMonth("2010-03")).toBe("03/2010");
    for (const bad of ["2010-13", "2010-3", "abc", "", null, undefined]) {
      expect(formatMonth(bad)).toBe("—");
    }
  });
  it("cộng tháng, qua năm và số âm", () => {
    expect(addMonths("2010-03", 3)).toBe("2010-06");
    expect(addMonths("2010-11", 3)).toBe("2011-02");
    expect(addMonths("2010-01", -1)).toBe("2009-12");
    expect(addMonths("2010-12", 12)).toBe("2011-12");
    expect(addMonths("2010-03", 0)).toBe("2010-03");
    expect(addMonths("bad", 3)).toBeNull();
    expect(addMonths("2010-03", 1.5)).toBeNull();
  });
  it("tầm dự báo hiển thị tháng đích", () => {
    expect(formatHorizon("2010-03", 3)).toBe("sau 3 tháng (06/2010)");
    expect(formatHorizon("2010-11", 6)).toBe("sau 6 tháng (05/2011)");
    expect(formatHorizon("bad", 3)).toBe("sau 3 tháng");
  });
});

describe("formatDateTime", () => {
  it("luôn hiển thị giờ Việt Nam (UTC+7), không phụ thuộc múi giờ máy", () => {
    expect(formatDateTime("2026-09-25T02:14:09Z")).toBe("25/09/2026 09:14");
    expect(formatDateTime("2026-09-25T17:30:00Z")).toBe("26/09/2026 00:30");
    expect(formatDateTime("2026-12-31T16:59:00Z")).toBe("31/12/2026 23:59");
  });
  it("giá trị thiếu/sai → dấu gạch", () => {
    for (const bad of [null, undefined, "", "không phải ngày"])
      expect(formatDateTime(bad)).toBe("—");
  });
});

describe("formatDecimal / formatPercent", () => {
  it("dấu phẩy Việt, số chữ số cố định", () => {
    expect(formatDecimal(0.515, 2)).toBe("0,52");
    expect(formatDecimal(0.5, 3)).toBe("0,500");
    expect(formatDecimal(1234.5, 1)).toBe("1.234,5");
    expect(formatDecimal(null)).toBe("—");
    expect(formatDecimal(Number.NaN)).toBe("—");
  });
  it("phần trăm từ tỉ lệ; cải thiện âm không bị chặn", () => {
    expect(formatPercent(0.222, 1)).toBe("22,2%");
    expect(formatPercent(0.182)).toBe("18%");
    expect(formatPercent(-0.05, 1)).toBe("-5,0%");
    expect(formatPercent(undefined)).toBe("—");
  });
});
