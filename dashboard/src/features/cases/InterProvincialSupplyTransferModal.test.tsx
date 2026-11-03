import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as exportCsvModule from "@/shared/lib/exportCsv";
import * as notifyModule from "@/shared/lib/notify";
import { InterProvincialSupplyTransferModal } from "./InterProvincialSupplyTransferModal";

describe("InterProvincialSupplyTransferModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<InterProvincialSupplyTransferModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText("Điều Phối & Chi Viện Kho Vật Tư Liên Tỉnh")).not.toBeInTheDocument();
  });

  it("renders modal with donor and target selectors and initial metrics", () => {
    render(
      <InterProvincialSupplyTransferModal
        isOpen={true}
        onClose={() => {}}
        initialTargetProvinceId="angiang"
      />
    );

    expect(screen.getByText("Điều Phối & Chi Viện Kho Vật Tư Liên Tỉnh")).toBeInTheDocument();
    expect(screen.getByText("Mô phỏng, không kết nối kho CDC")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn đơn vị xuất cấp chi viện")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn địa bàn tâm dịch tiếp nhận")).toBeInTheDocument();
  });

  it("triggers CSV manifest download when clicking export button", () => {
    const exportSpy = vi.spyOn(exportCsvModule, "exportCsv").mockImplementation(() => {});
    const notifySpy = vi.spyOn(notifyModule.notify, "success");

    render(
      <InterProvincialSupplyTransferModal
        isOpen={true}
        onClose={() => {}}
        initialTargetProvinceId="angiang"
      />
    );

    const exportBtn = screen.getByRole("button", { name: /Xuất kịch bản mô phỏng/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith(
      expect.stringContaining("DengueSense_Mo_Phong_Chi_Vien"),
      expect.any(Array),
      expect.any(Array)
    );
    expect(notifySpy).toHaveBeenCalledWith("Đã xuất kịch bản mô phỏng", expect.any(String));
  });

  it("triggers dispatch order and closes modal on confirm", () => {
    const notifySpy = vi.spyOn(notifyModule.notify, "success");
    const closeMock = vi.fn();

    render(
      <InterProvincialSupplyTransferModal
        isOpen={true}
        onClose={closeMock}
        initialTargetProvinceId="angiang"
      />
    );

    const dispatchBtn = screen.getByRole("button", { name: /Đóng kịch bản mô phỏng/i });
    fireEvent.click(dispatchBtn);

    expect(notifySpy).toHaveBeenCalledWith("Đã xem xong kịch bản chi viện", expect.any(String));
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
