import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConformalPredictionCard } from "./ConformalPredictionCard";

describe("ConformalPredictionCard Component", () => {
  it("renders with default 95% coverage level and displays formula", () => {
    render(<ConformalPredictionCard />);

    expect(screen.getByText("Khoảng Dự Báo Bất Định Conformal Prediction")).toBeInTheDocument();
    expect(screen.getByText("Distribution-Free Guarantees")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("95.8%")).toBeInTheDocument();
    expect(screen.getByText("±36.8")).toBeInTheDocument();
  });

  it("switches to 90% coverage level when clicking tab", () => {
    render(<ConformalPredictionCard />);

    const tab90 = screen.getByRole("tab", { name: "Bao phủ 90%" });
    fireEvent.click(tab90);

    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("91.4%")).toBeInTheDocument();
    expect(screen.getByText("±24.6")).toBeInTheDocument();
    expect(screen.getByText("+22,4% độ hẹp dải an toàn")).toBeInTheDocument();
  });
});
