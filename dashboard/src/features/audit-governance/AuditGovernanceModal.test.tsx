import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditGovernanceModal } from "./AuditGovernanceModal";

describe("AuditGovernanceModal", () => {
  it("renders nothing when closed", () => {
    render(<AuditGovernanceModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders audit records and stats when opened", () => {
    render(<AuditGovernanceModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Nhật Ký Giám Sát & Hồ Sơ Tuân Thủ AI (Audit Trail)")
    ).toBeInTheDocument();
    expect(screen.getByText("AUD-2026-0942")).toBeInTheDocument();
    expect(screen.getByText("Phê duyệt Công điện B2G (Quy tắc 4 mắt)")).toBeInTheDocument();
  });

  it("filters audit records by search keyword", () => {
    render(<AuditGovernanceModal open={true} onClose={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(
      "Tìm theo người thực hiện, mã thực thể, mã băm..."
    );

    fireEvent.change(searchInput, { target: { value: "OR-Tools" } });

    expect(screen.getByText("Tối ưu hóa nguồn lực toán học (MILP)")).toBeInTheDocument();
    expect(screen.queryByText("Phê duyệt Công điện B2G (Quy tắc 4 mắt)")).not.toBeInTheDocument();
  });

  it("filters audit records by category tab", () => {
    render(<AuditGovernanceModal open={true} onClose={vi.fn()} />);

    const milpTab = screen.getByRole("button", { name: "Phân bổ MILP" });
    fireEvent.click(milpTab);

    expect(screen.getByText("Tối ưu hóa nguồn lực toán học (MILP)")).toBeInTheDocument();
    expect(screen.queryByText("Phê duyệt Công điện B2G (Quy tắc 4 mắt)")).not.toBeInTheDocument();
  });

  it("calls onClose when clicking close button", () => {
    const handleClose = vi.fn();
    render(<AuditGovernanceModal open={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole("button", { name: "Đóng bảng nhật ký" });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
