import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { GuidedTourModal } from "./GuidedTourModal";
import { GUIDED_TOUR_STEPS } from "@/shared/config/guidedTour";

describe("GuidedTourModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <GuidedTourModal open={false} onClose={vi.fn()} onNavigateStep={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders first step correctly when open is true", () => {
    render(<GuidedTourModal open={true} onClose={vi.fn()} onNavigateStep={vi.fn()} />);

    expect(screen.getByText("Lộ Trình Trải Nghiệm Đa Vai Trò DengueSense")).toBeInTheDocument();
    expect(screen.getByText(GUIDED_TOUR_STEPS[0]!.title)).toBeInTheDocument();
    expect(screen.getByText(/Bước 1 \/ 5/i)).toBeInTheDocument();
  });

  it("navigates through steps using next and prev buttons", () => {
    render(<GuidedTourModal open={true} onClose={vi.fn()} onNavigateStep={vi.fn()} />);

    // Click next
    const nextBtn = screen.getByRole("button", { name: /Tiếp theo/i });
    fireEvent.click(nextBtn);

    // Now on step 2
    expect(screen.getByText(GUIDED_TOUR_STEPS[1]!.title)).toBeInTheDocument();
    expect(screen.getByText(/Bước 2 \/ 5/i)).toBeInTheDocument();

    // Click prev
    const prevBtn = screen.getByRole("button", { name: /Trước/i });
    fireEvent.click(prevBtn);

    // Back to step 1
    expect(screen.getByText(GUIDED_TOUR_STEPS[0]!.title)).toBeInTheDocument();
  });

  it("triggers onNavigateStep when clicking the feature action button", () => {
    const onNavigateSpy = vi.fn();
    render(<GuidedTourModal open={true} onClose={vi.fn()} onNavigateStep={onNavigateSpy} />);

    const actionBtn = screen.getByRole("button", {
      name: new RegExp(GUIDED_TOUR_STEPS[0]!.actionPrompt, "i"),
    });
    fireEvent.click(actionBtn);

    expect(onNavigateSpy).toHaveBeenCalledTimes(1);
    expect(onNavigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: GUIDED_TOUR_STEPS[0]!.id })
    );
  });

  it("triggers onClose when clicking close or skip", () => {
    const onCloseSpy = vi.fn();
    render(<GuidedTourModal open={true} onClose={onCloseSpy} onNavigateStep={vi.fn()} />);

    const skipBtn = screen.getByRole("button", { name: /Bỏ qua hướng dẫn/i });
    fireEvent.click(skipBtn);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});
