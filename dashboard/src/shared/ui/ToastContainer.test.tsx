import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notify } from "@/shared/lib/notify";
import { ToastContainer } from "./ToastContainer";

describe("ToastContainer", () => {
  it("renders nothing initially", () => {
    render(<ToastContainer />);
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

  it("renders toast when a notification is emitted", () => {
    render(<ToastContainer />);

    act(() => {
      notify.success("Thành công", "Dữ liệu đã được lưu trữ");
    });

    expect(screen.getByText("Thành công")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu đã được lưu trữ")).toBeInTheDocument();
  });

  it("dismisses toast when clicking close button", async () => {
    render(<ToastContainer />);

    act(() => {
      notify.warning("Cảnh báo", "Dịch bùng phát");
    });

    expect(screen.getByText("Cảnh báo")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Đóng thông báo" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Cảnh báo")).not.toBeInTheDocument();
    });
  });

  it("renders action link when link is provided", () => {
    render(<ToastContainer />);

    act(() => {
      notify.critical("Báo động", "Kiểm tra khẩn cấp", { link: "/app/canh-bao" });
    });

    const link = screen.getByRole("link", { name: /Xem chi tiết/i });
    expect(link).toHaveAttribute("href", "/app/canh-bao");
  });
});
