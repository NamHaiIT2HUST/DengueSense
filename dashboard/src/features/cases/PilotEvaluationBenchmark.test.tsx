import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as exportCsvModule from "@/shared/lib/exportCsv";
import * as notifyModule from "@/shared/lib/notify";
import { PilotEvaluationBenchmark } from "./PilotEvaluationBenchmark";

describe("PilotEvaluationBenchmark Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders benchmark summary with efficiency metrics", () => {
    render(
      <PilotEvaluationBenchmark
        casesPrevented={350}
        interventionCost={800_000_000}
        provinceCount={4}
      />
    );

    expect(
      screen.getByText("Thẩm Định Đối Sánh Thí Điểm CDC (Shadow Run Benchmarking)")
    ).toBeInTheDocument();
    expect(screen.getByText("Chứng nhận thực nghiệm")).toBeInTheDocument();
    expect(screen.getByText("160x")).toBeInTheDocument();
    expect(screen.getByText("94.2%")).toBeInTheDocument();
  });

  it("toggles the expandable comparison table on click", () => {
    render(<PilotEvaluationBenchmark casesPrevented={350} interventionCost={800_000_000} />);

    const toggleBtn = screen.getByRole("button", { name: /Chi tiết đối sánh/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Hạng mục kiểm chứng thí điểm")).toBeInTheDocument();
    expect(screen.getByText("Phương án truyền thống CDC (Manual)")).toBeInTheDocument();
    expect(screen.getByText("DengueSense MILP Proactive")).toBeInTheDocument();
  });

  it("triggers CSV report download when export button is clicked", () => {
    const exportSpy = vi.spyOn(exportCsvModule, "exportCsv").mockImplementation(() => {});
    const notifySpy = vi.spyOn(notifyModule.notify, "success");

    render(<PilotEvaluationBenchmark casesPrevented={350} interventionCost={800_000_000} />);

    const exportBtn = screen.getByRole("button", { name: /Xuất biên bản đối sánh/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith(
      expect.stringContaining("DengueSense_Bien_Ban_Tham_Dinh_Thi_Diem"),
      expect.any(Array),
      expect.any(Array)
    );
    expect(notifySpy).toHaveBeenCalledWith(
      "Xuất biên bản thẩm định đối sánh thành công",
      expect.any(String)
    );
  });
});
