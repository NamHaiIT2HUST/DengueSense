import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as exportCsvModule from "@/shared/lib/exportCsv";
import * as notifyModule from "@/shared/lib/notify";
import { SeirvSimulationPlayground } from "./SeirvSimulationPlayground";

describe("SeirvSimulationPlayground Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the simulation playground with controls, presets, and KPIs", () => {
    render(<SeirvSimulationPlayground />);

    expect(screen.getByText("Mô phỏng Động học Lan truyền SEIR-V")).toBeInTheDocument();
    expect(screen.getByText("Không can thiệp (Baseline Outbreak)")).toBeInTheDocument();
    expect(screen.getByText("Chiến dịch Diệt bọ gậy cộng đồng")).toBeInTheDocument();
    expect(screen.getByText("Phun dập dịch khẩn cấp ULV")).toBeInTheDocument();
    expect(screen.getByText("Quản lý Vector tích hợp (IVM Tổng lực)")).toBeInTheDocument();

    // Check sliders
    expect(screen.getByLabelText(/Diệt bọ gậy \/ BI-HI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phun không gian ULV/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nhiệt độ môi trường/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật độ muỗi \/ Người/i)).toBeInTheDocument();
  });

  it("allows selecting a tactical preset and notifies the user", () => {
    const notifySpy = vi.spyOn(notifyModule.notify, "info");
    render(<SeirvSimulationPlayground />);

    const ivmButton = screen.getByText("Quản lý Vector tích hợp (IVM Tổng lực)");
    fireEvent.click(ivmButton);

    expect(notifySpy).toHaveBeenCalledWith(
      expect.stringContaining("Đã kích hoạt kịch bản: Quản lý Vector tích hợp (IVM Tổng lực)"),
      expect.any(String)
    );
  });

  it("triggers CSV export when clicking the export button", () => {
    const exportSpy = vi.spyOn(exportCsvModule, "exportCsv").mockImplementation(() => {});
    const successSpy = vi.spyOn(notifyModule.notify, "success");

    render(<SeirvSimulationPlayground />);

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu \(\.csv\)/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith(
      expect.stringContaining("denguesense_seirv_simulation_baseline.csv"),
      expect.any(Array),
      expect.any(Array)
    );
    expect(successSpy).toHaveBeenCalledWith("Xuất dữ liệu mô phỏng thành công", expect.any(String));
  });

  it("dynamically recalculates metrics when slider values change", () => {
    render(<SeirvSimulationPlayground />);

    const tempSlider = screen.getByLabelText(/Nhiệt độ môi trường/i);
    fireEvent.change(tempSlider, { target: { value: "32" } });

    expect(screen.getByText("32.0°C")).toBeInTheDocument();
  });
});
