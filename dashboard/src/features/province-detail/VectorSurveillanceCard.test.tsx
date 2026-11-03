import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as exportCsvModule from "@/shared/lib/exportCsv";
import * as notifyModule from "@/shared/lib/notify";
import { VectorSurveillanceCard } from "./VectorSurveillanceCard";

describe("VectorSurveillanceCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 4 core entomological indices per QĐ 3711/QĐ-BYT", () => {
    render(<VectorSurveillanceCard provinceId="hcm" provinceName="TP. Hồ Chí Minh" />);

    expect(
      screen.getByText("Mô phỏng chỉ số côn trùng (chưa có khảo sát thực địa)")
    ).toBeInTheDocument();
    expect(screen.getByText("QĐ 3711/QĐ-BYT")).toBeInTheDocument();
    expect(screen.getByText("Chỉ số Breteau (BI)")).toBeInTheDocument();
    expect(screen.getByText("Nhà có bọ gậy (HI)")).toBeInTheDocument();
    expect(screen.getByText("Dụng cụ có bọ gậy (CI)")).toBeInTheDocument();
    expect(screen.getByText("Mật độ muỗi (DI)")).toBeInTheDocument();
  });

  it("triggers CSV export of entomological metrics", () => {
    const exportSpy = vi.spyOn(exportCsvModule, "exportCsv").mockImplementation(() => {});
    const notifySpy = vi.spyOn(notifyModule.notify, "success");

    render(<VectorSurveillanceCard provinceId="hcm" provinceName="TP. Hồ Chí Minh" />);

    const exportBtn = screen.getByRole("button", { name: /Xuất kịch bản/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith(
      expect.stringContaining("Mo_Phong_Con_Trung_QD3711"),
      expect.any(Array),
      expect.any(Array)
    );
    expect(notifySpy).toHaveBeenCalledWith("Đã xuất kịch bản côn trùng", expect.any(String));
  });

  it("updates indices when adjusting simulation slider", () => {
    render(<VectorSurveillanceCard provinceId="danang" provinceName="Đà Nẵng" />);

    const larvaeSlider = screen.getByLabelText(/Số dụng cụ có lăng quăng/i);
    fireEvent.change(larvaeSlider, { target: { value: "85" } });

    expect(screen.getByText("85 dụng cụ")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument(); // BI becomes 85
  });

  it("resets survey metrics to initial state on click", () => {
    const notifySpy = vi.spyOn(notifyModule.notify, "info");

    render(<VectorSurveillanceCard provinceId="hcm" provinceName="TP. Hồ Chí Minh" />);

    const resetBtn = screen.getByRole("button", { name: /Đặt lại/i });
    fireEvent.click(resetBtn);

    expect(notifySpy).toHaveBeenCalledWith("Đã đặt lại kịch bản", expect.any(String));
  });
});
