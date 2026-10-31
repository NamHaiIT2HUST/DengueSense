import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { notify } from "@/shared/lib/notify";
import { NotificationCenter } from "./NotificationCenter";

describe("NotificationCenter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders notification bell with unread badge count", () => {
    render(<NotificationCenter />);
    const bellButton = screen.getByRole("button", { name: "Thông báo hệ thống" });
    expect(bellButton).toBeInTheDocument();
    // Default has 3 unread notifications
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens popover when bell button is clicked", () => {
    render(<NotificationCenter />);
    const bellButton = screen.getByRole("button", { name: "Thông báo hệ thống" });
    fireEvent.click(bellButton);

    expect(screen.getByText("Trung tâm thông báo")).toBeInTheDocument();
    expect(screen.getByText("Cảnh báo vượt ngưỡng P75")).toBeInTheDocument();
  });

  it("marks all notifications as read when clicking mark all button", () => {
    render(<NotificationCenter />);
    const bellButton = screen.getByRole("button", { name: "Thông báo hệ thống" });
    fireEvent.click(bellButton);

    const markAllButton = screen.getByRole("button", { name: /Đọc tất cả/i });
    fireEvent.click(markAllButton);

    // After marking all as read, mark all button disappears and unread badge disappears
    expect(screen.queryByText("3 mới")).not.toBeInTheDocument();
  });

  it("receives live notifications via event bus and updates unread badge", () => {
    render(<NotificationCenter />);
    expect(screen.getByText("3")).toBeInTheDocument();

    act(() => {
      notify.critical("Báo động mới", "TP. Hồ Chí Minh nguy cơ cao");
    });

    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
