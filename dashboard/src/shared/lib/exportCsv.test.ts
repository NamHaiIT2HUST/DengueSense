import { describe, expect, it, vi } from "vitest";
import { buildCsvContent, escapeCsvValue, exportToCsv } from "./exportCsv";

describe("exportCsv", () => {
  it("escapes special characters correctly according to RFC 4180", () => {
    expect(escapeCsvValue("Bình thường")).toBe("Bình thường");
    expect(escapeCsvValue("Hà Nội, Việt Nam")).toBe('"Hà Nội, Việt Nam"');
    expect(escapeCsvValue('Dự án "DengueSense"')).toBe('"Dự án ""DengueSense"""');
    expect(escapeCsvValue("Dòng 1\nDòng 2")).toBe('"Dòng 1\nDòng 2"');
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(12345)).toBe("12345");
  });

  it("builds CSV content with UTF-8 BOM and correct headers and rows", () => {
    const data = [
      { id: "hcm", name: "TP. Hồ Chí Minh", cases: 1250, risk: "Cao" },
      { id: "hn", name: "Hà Nội", cases: 340, risk: "Trung bình" },
    ];

    const columns = [
      { header: "Mã tỉnh", key: "id" as const },
      { header: "Tên tỉnh/thành", key: "name" as const },
      { header: "Số ca dự báo", key: (item: (typeof data)[0]) => item.cases },
      { header: "Mức độ rủi ro", key: "risk" as const },
    ];

    const csv = buildCsvContent(columns, data);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Mã tỉnh,Tên tỉnh/thành,Số ca dự báo,Mức độ rủi ro");
    expect(csv).toContain("hcm,TP. Hồ Chí Minh,1250,Cao");
    expect(csv).toContain("hn,Hà Nội,340,Trung bình");
  });

  it("triggers file download correctly in browser environment", () => {
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://localhost/test");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    exportToCsv("test_report", [{ header: "Cột", key: "col" }], [{ col: "Giá trị" }]);

    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/test");

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
