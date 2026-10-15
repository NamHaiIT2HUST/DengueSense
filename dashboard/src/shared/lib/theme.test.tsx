import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "./theme";

function TestConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        Toggle Theme
      </button>
      <button type="button" onClick={() => setTheme("light")}>
        Set Light
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
    </div>
  );
}

describe("Theme system", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark mode and applies attributes to DOM", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggles between dark and light modes", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByRole("button", { name: "Toggle Theme" });
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("theme-val").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("denguesense-theme")).toBe("light");

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets specific theme directly", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const setLightBtn = screen.getByRole("button", { name: "Set Light" });
    fireEvent.click(setLightBtn);
    expect(screen.getByTestId("theme-val").textContent).toBe("light");

    const setDarkBtn = screen.getByRole("button", { name: "Set Dark" });
    fireEvent.click(setDarkBtn);
    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
  });
});
