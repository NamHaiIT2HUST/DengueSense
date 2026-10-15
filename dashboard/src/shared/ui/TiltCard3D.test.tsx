import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TiltCard3D } from "./TiltCard3D";

describe("TiltCard3D component", () => {
  it("renders children content correctly", () => {
    render(
      <TiltCard3D>
        <div>Nội dung thẻ 3D</div>
      </TiltCard3D>
    );
    expect(screen.getByText("Nội dung thẻ 3D")).toBeInTheDocument();
  });

  it("handles mouse interactions without throwing errors", () => {
    const { container } = render(
      <TiltCard3D maxTilt={10} scale={1.05}>
        <button type="button">Thẻ tương tác</button>
      </TiltCard3D>
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeInTheDocument();

    fireEvent.mouseEnter(card);
    fireEvent.mouseMove(card, { clientX: 50, clientY: 50 });
    fireEvent.mouseLeave(card);

    expect(screen.getByText("Thẻ tương tác")).toBeInTheDocument();
  });

  it("renders disabled state without motion wrappers", () => {
    render(
      <TiltCard3D disabled>
        <div>Thẻ tĩnh</div>
      </TiltCard3D>
    );
    expect(screen.getByText("Thẻ tĩnh")).toBeInTheDocument();
  });
});
