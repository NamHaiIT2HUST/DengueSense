import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HealthEconomicsEvaluation } from "./HealthEconomicsEvaluation";

describe("HealthEconomicsEvaluation", () => {
  it("renders nothing when casesPrevented is 0 or negative", () => {
    const { container } = render(
      <HealthEconomicsEvaluation casesPrevented={0} interventionCost={100_000_000} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders health economics metrics correctly when casesPrevented > 0", () => {
    // 100 ca ngăn chặn, chi phí 200 triệu
    render(<HealthEconomicsEvaluation casesPrevented={100} interventionCost={200_000_000} />);

    expect(screen.getByText(/Đánh Giá Hiệu Quả Kinh Tế Y Tế & DALYs/i)).toBeInTheDocument();
    expect(screen.getByText(/Viện phí & Điều trị tránh được/i)).toBeInTheDocument();
    expect(screen.getByText(/Chi phí xã hội & Ngày công/i)).toBeInTheDocument();
    expect(screen.getByText(/Lợi ích kinh tế ròng \(Net\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Gánh nặng bệnh tật tránh được/i)).toBeInTheDocument();

    // 100 * 5.2M = 520M, 100 * 3.8M = 380M. Tổng = 900M. ROI = 900M / 200M = 4.5
    expect(screen.getByText(/ROI: 1 đồng đầu tư tiết kiệm 4.5 đồng/i)).toBeInTheDocument();
  });
});
