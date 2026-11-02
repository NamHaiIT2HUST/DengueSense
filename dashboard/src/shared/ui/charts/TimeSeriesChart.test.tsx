import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeSeriesChart } from "./TimeSeriesChart";

const props = {
  ariaLabel: "Ca bệnh theo tháng",
  originMonth: "2010-03",
  afterOriginIsComparison: true,
  observed: [
    { month: "1994-02", value: 70, source: "real" as const },
    { month: "2008-04", value: 100, source: "real" as const },
    { month: "2008-05", value: null, source: null },
    { month: "2010-03", value: 120, source: "real" as const },
    { month: "2025-03", value: 300, source: "estimated" as const },
  ],
  forecast: [1, 2, 3, 6].map((horizon) => ({
    month: `2010-${String(3 + horizon).padStart(2, "0")}`,
    value: 150,
    horizon,
  })),
  threshold: [{ month: "2010-09", value: 200 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("TimeSeriesChart", () => {
  it("opens around the origin, exposes full history and keeps the complete data table", async () => {
    const user = userEvent.setup();
    const { container } = render(<TimeSeriesChart {...props} />);
    expect(screen.getByText("Đang xem: 04/2008 – 09/2010")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-forecast-horizon]")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Quanh tháng neo" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Toàn bộ dữ liệu" }));
    expect(screen.getByText("Đang xem: 02/1994 – 03/2025")).toBeInTheDocument();
    const ticks = container.querySelectorAll("[data-chart-axis='time'] text");
    expect(ticks[0]).toHaveTextContent("02/1994");
    expect(ticks[ticks.length - 1]).toHaveTextContent("03/2025");
    expect(screen.getByText("Số ca ước lượng")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quanh tháng neo" }));
    await user.click(screen.getByText("Bảng dữ liệu của biểu đồ"));
    const table = screen.getByRole("table");
    expect(within(table).getByText("02/1994")).toBeVisible();
    expect(within(table).getByText("03/2025")).toBeVisible();
    expect(within(table).getByText("05/2008")).toBeVisible();
    expect(within(table).getAllByRole("row")).toHaveLength(10);
  });

  it("recalculates time labels when the chart shrinks and disconnects its observer", async () => {
    let onResize: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          onResize = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const { container, unmount } = render(<TimeSeriesChart {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Toàn bộ dữ liệu" }));
    const before = container.querySelectorAll("[data-chart-axis='time'] text").length;
    const svg = screen.getByRole("img");
    vi.spyOn(svg.parentElement!, "getBoundingClientRect").mockReturnValue({
      width: 320,
    } as DOMRect);
    act(() => onResize?.([], {} as ResizeObserver));
    expect(container.querySelectorAll("[data-chart-axis='time'] text").length).toBeLessThan(before);
    expect(svg).toHaveAttribute("viewBox", "0 0 320 360");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("renders no empty chart and can receive data after an empty response", () => {
    const { container, rerender } = render(
      <TimeSeriesChart {...props} observed={[]} forecast={[]} threshold={[]} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<TimeSeriesChart {...props} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
