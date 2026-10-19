/**
 * Tiện ích xuất dữ liệu ra file CSV chuẩn RFC 4180 có UTF-8 BOM.
 * Giúp Microsoft Excel mở trực tiếp tiếng Việt có dấu mà không bị lỗi font (mojibake).
 */

export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  key: keyof T | ((item: T) => string | number | null | undefined);
}

export function buildCsvContent<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const rowLines = data.map((item) =>
    columns
      .map((col) => {
        const val = typeof col.key === "function" ? col.key(item) : item[col.key];
        return escapeCsvValue(val as string | number | null | undefined);
      })
      .join(",")
  );

  return "\uFEFF" + [headerLine, ...rowLines].join("\r\n");
}

export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], data: T[]): void {
  const csvContent = buildCsvContent(columns, data);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const exportCsv = exportToCsv;
