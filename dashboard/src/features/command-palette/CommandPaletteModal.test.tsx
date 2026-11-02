import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CommandPaletteModal } from "./CommandPaletteModal";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CommandPaletteModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = renderWithClient(
      <CommandPaletteModal
        open={false}
        onClose={vi.fn()}
        onOpenScenarios={vi.fn()}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders search input and core actions when open is true", () => {
    renderWithClient(
      <CommandPaletteModal
        open={true}
        onClose={vi.fn()}
        onOpenScenarios={vi.fn()}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );

    expect(
      screen.getByPlaceholderText(/Tìm kiếm tỉnh thành, kịch bản, lệnh tác chiến/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Diễn tập Tình huống Mẫu/i)).toBeInTheDocument();
    expect(screen.getByText(/Lộ trình Trải nghiệm 5 Bước/i)).toBeInTheDocument();
    expect(screen.getByText(/Bản đồ phân vùng dịch tễ 34 tỉnh/i)).toBeInTheDocument();
  });

  it("ẩn kịch bản và điều hướng không đủ quyền trong console thật", () => {
    renderWithClient(
      <CommandPaletteModal
        open={true}
        demoMode={false}
        role="viewer"
        onClose={vi.fn()}
        onOpenScenarios={vi.fn()}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );

    expect(screen.getByText(/Bản đồ phân vùng dịch tễ 34 tỉnh/i)).toBeInTheDocument();
    expect(screen.queryByText(/Diễn tập Tình huống Mẫu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chuyển vai trò:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Danh sách hồ sơ can thiệp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lượt chạy dự báo/i)).not.toBeInTheDocument();
  });

  it("filters actions by query input", () => {
    renderWithClient(
      <CommandPaletteModal
        open={true}
        onClose={vi.fn()}
        onOpenScenarios={vi.fn()}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Tìm kiếm tỉnh thành/i);
    fireEvent.change(input, { target: { value: "Tour" } });

    expect(screen.getByText(/Lộ trình Trải nghiệm 5 Bước/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bản đồ phân vùng dịch tễ 34 tỉnh/i)).not.toBeInTheDocument();
  });

  it("triggers onOpenScenarios when clicking the scenarios action", () => {
    const onOpenScenariosSpy = vi.fn();
    renderWithClient(
      <CommandPaletteModal
        open={true}
        onClose={vi.fn()}
        onOpenScenarios={onOpenScenariosSpy}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );

    const scenariosBtn = screen.getByText(/Diễn tập Tình huống Mẫu/i);
    fireEvent.click(scenariosBtn);

    expect(onOpenScenariosSpy).toHaveBeenCalledTimes(1);
  });

  it("triggers onClose when clicking backdrop or pressing Escape", () => {
    const onCloseSpy = vi.fn();
    renderWithClient(
      <CommandPaletteModal
        open={true}
        onClose={onCloseSpy}
        onOpenScenarios={vi.fn()}
        onOpenTour={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchRole={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});
