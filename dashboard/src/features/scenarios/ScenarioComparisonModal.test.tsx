import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScenarioComparisonModal } from "./ScenarioComparisonModal";

describe("ScenarioComparisonModal", () => {
  it("không hiển thị khi open là false", () => {
    const { container } = render(<ScenarioComparisonModal open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hiển thị đúng tiêu đề và các chỉ số độ nhạy ngân sách mặc định khi mở", () => {
    render(
      <ScenarioComparisonModal
        open={true}
        onClose={() => {}}
        initialBudget={1_000_000_000}
        initialCasesPrevented={420}
      />
    );

    expect(
      screen.getByText(/Đối Sánh Đa Kịch Bản & Phân Tích Độ Nhạy Ngân Sách/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Phương án Đề xuất Chuẩn \(100%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/-20% Ngân sách Thắt chặt/i)).toBeInTheDocument();
    expect(screen.getByText(/\+20% Phản ứng Tăng cường/i)).toBeInTheDocument();
    expect(screen.getByText(/14.3 DALYs/i)).toBeInTheDocument();
  });

  it("chuyển sang tư thế ngân sách thắt chặt -20% khi bấm preset", () => {
    render(
      <ScenarioComparisonModal
        open={true}
        onClose={() => {}}
        initialBudget={1_000_000_000}
        initialCasesPrevented={420}
      />
    );

    const austerityBtn = screen.getByText(/-20% Ngân sách Thắt chặt/i).closest("button");
    expect(austerityBtn).not.toBeNull();
    if (austerityBtn) {
      fireEvent.click(austerityBtn);
    }

    // Ngân sách 800 triệu
    expect(screen.getAllByText(/800\.000\.000/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cảnh báo rủi ro bùng phát/i)).toBeInTheDocument();
  });

  it("chuyển sang tab đối so sánh song song 3 kịch bản diễn tập", () => {
    const handleSelectScenario = vi.fn();
    render(
      <ScenarioComparisonModal
        open={true}
        onClose={() => {}}
        onSelectScenario={handleSelectScenario}
      />
    );

    const tabBtn = screen.getByRole("button", {
      name: /Đối So Sánh Song Song 3 Kịch Bản Diễn Tập/i,
    });
    fireEvent.click(tabBtn);

    expect(screen.getByText(/Kịch bản 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Kịch bản 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Kịch bản 3/i)).toBeInTheDocument();

    const selectButtons = screen.getAllByRole("button", { name: /Chọn kịch bản/i });
    expect(selectButtons.length).toBe(3);
    fireEvent.click(selectButtons[0]!);
    expect(handleSelectScenario).toHaveBeenCalledTimes(1);
  });
});
