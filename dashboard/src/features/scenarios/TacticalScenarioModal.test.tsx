import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TacticalScenarioModal } from "./TacticalScenarioModal";

describe("TacticalScenarioModal", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <TacticalScenarioModal open={false} onClose={vi.fn()} onSelectScenario={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all 3 tactical scenarios when open is true", () => {
    render(<TacticalScenarioModal open={true} onClose={vi.fn()} onSelectScenario={vi.fn()} />);
    expect(screen.getByText("Bảng Điều Khiển Diễn Tập Tình Huống Mẫu")).toBeInTheDocument();
    expect(screen.getByText(/Kịch bản 1: Bùng phát dịch El Niño phía Nam/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Kịch bản 2: Nguy cơ bất thường Duyên hải Miền Trung/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Kịch bản 3: Tối ưu hoá nguồn lực ngặt nghèo/i)).toBeInTheDocument();
  });

  it("triggers onSelectScenario when clicking action button", () => {
    const onSelectSpy = vi.fn();
    render(<TacticalScenarioModal open={true} onClose={vi.fn()} onSelectScenario={onSelectSpy} />);
    const actionButtons = screen.getAllByRole("button", { name: /Tác chiến ngay/i });
    expect(actionButtons.length).toBe(3);

    const firstButton = actionButtons[0];
    expect(firstButton).toBeDefined();
    if (!firstButton) throw new Error("Button not found");
    fireEvent.click(firstButton);
    expect(onSelectSpy).toHaveBeenCalledTimes(1);
    expect(onSelectSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "scenario-south-el-nino" })
    );
  });

  it("triggers onClose when clicking close button", () => {
    const onCloseSpy = vi.fn();
    render(<TacticalScenarioModal open={true} onClose={onCloseSpy} onSelectScenario={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: "Đóng cửa sổ" });
    fireEvent.click(closeBtn);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});
