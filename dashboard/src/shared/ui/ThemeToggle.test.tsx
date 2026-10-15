import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/shared/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light", "dark");
  });

  it("renders with dark mode default and toggles to light mode on click", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleButton = screen.getByRole("button", { name: /Chuyển sang giao diện Sáng/i });
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);

    const toggledButton = screen.getByRole("button", { name: /Chuyển sang giao diện Tối/i });
    expect(toggledButton).toBeInTheDocument();
  });

  it("renders with label when showLabel is true", () => {
    render(
      <ThemeProvider>
        <ThemeToggle showLabel />
      </ThemeProvider>
    );

    expect(screen.getByText(/Giao diện Sáng/i)).toBeInTheDocument();
  });
});
