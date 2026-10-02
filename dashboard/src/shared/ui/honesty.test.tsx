import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Meta } from "@/shared/api";
import { renderWithRouter } from "@/test/router";

import { ForecastFlags } from "./ForecastFlags";
import { InputSources } from "./InputSources";
import { ProbabilityWithBaseRate } from "./ProbabilityWithBaseRate";
import { ProvenanceBar } from "./ProvenanceBar";
import { ReliabilityNote } from "./ReliabilityNote";

describe("ProbabilityWithBaseRate (luật T1, T7)", () => {
  it("luôn hiện mức nền cạnh xác suất, làm tròn phần trăm nguyên", () => {
    render(<ProbabilityWithBaseRate probability={0.4123456} baseRate={0.2209302} />);
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("22%")).toBeInTheDocument();
    expect(screen.getByText(/Mức nền/)).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAccessibleName("Xác suất vượt ngưỡng 41%, mức nền 22%");
    // T7: không lộ số lẻ dài
    expect(document.body.textContent).not.toMatch(/0[.,]4123/);
  });

  it("nêu bội số so với mức nền, dấu phẩy kiểu Việt", () => {
    render(<ProbabilityWithBaseRate probability={0.88} baseRate={0.22} />);
    expect(screen.getByText(/≈ 4,0 lần mức nền/)).toBeInTheDocument();
  });

  it("mức nền bằng 0 không chia cho 0 và không hiện bội số", () => {
    render(<ProbabilityWithBaseRate probability={0.5} baseRate={0} />);
    expect(screen.queryByText(/lần mức nền/)).not.toBeInTheDocument();
    expect(screen.getByText(/Mức nền/)).toBeInTheDocument();
  });

  it("KHÔNG thể dựng thiếu mức nền (bắt buộc ở kiểu)", () => {
    // @ts-expect-error — thiếu baseRate phải là lỗi biên dịch: đây chính là cách luật T1 được ép.
    const bad = <ProbabilityWithBaseRate probability={0.5} />;
    expect(bad).toBeTruthy();
  });

  it("xác suất ngoài [0,1] bị chặn để không hiện 120%", () => {
    render(<ProbabilityWithBaseRate probability={1.2} baseRate={0.2} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

describe("ProvenanceBar (luật T3, T4)", () => {
  const base: Meta = {
    run_id: "0f6bac6d-b0cc-5177-83a7-ab3e02ae3fe4",
    run_mode: "backtest",
    model_version: "m4-r2@1.0.0",
    data_version: "v0.2.0",
    origin_month: "2010-03",
    generated_at: "2026-09-24T23:26:56Z",
    limitations_ref: "/api/v1/model-card/limitations",
  };

  it("backtest: banner 'Tái hiện lịch sử' + đủ nguồn gốc số liệu + liên kết giới hạn", async () => {
    await renderWithRouter(<ProvenanceBar meta={base} />);
    const region = screen.getByRole("region", { name: "Nguồn gốc số liệu" });
    expect(within(region).getByRole("status")).toHaveTextContent(
      /Tái hiện lịch sử: dự báo từ tháng neo 03\/2010/
    );
    expect(within(region).getByText("m4-r2@1.0.0")).toBeInTheDocument();
    expect(within(region).getByText("v0.2.0")).toBeInTheDocument();
    expect(within(region).getByText("25/09/2026 06:26")).toBeInTheDocument(); // giờ Việt Nam
    expect(within(region).getByRole("link", { name: "Giới hạn của mô hình" })).toHaveAttribute(
      "href",
      "/app/mo-hinh"
    );
  });

  it("live_experimental: banner cảnh báo, KHÔNG được trông như dự báo chính thức", async () => {
    await renderWithRouter(<ProvenanceBar meta={{ ...base, run_mode: "live_experimental" }} />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/Thử nghiệm trực tiếp/);
    expect(banner).toHaveTextContent(/Không dùng làm dự báo chính thức/);
    expect(banner).not.toHaveTextContent(/Tái hiện lịch sử/);
  });
});

describe("ForecastFlags (luật T6)", () => {
  it("cờ dự báo thấp hơn thực tế có câu giải thích đầy đủ (ở chế độ notes)", () => {
    render(<ForecastFlags flags={["outbreak_underprediction_risk"]} notes />);
    expect(screen.getByText("Có thể dự báo thấp hơn thực tế")).toBeInTheDocument();
    expect(
      screen.getByText("Mô hình có xu hướng dự báo thấp khi bùng dịch — cần chuyên môn xem xét.")
    ).toBeInTheDocument();
  });

  it("không có cờ → không render gì (không hiện khối rỗng)", () => {
    const { container } = render(<ForecastFlags flags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mọi cờ của hợp đồng đều có nhãn tiếng Việt", () => {
    const all = [
      "outbreak_underprediction_risk",
      "estimated_inputs",
      "stale_data",
      "out_of_validated_period",
    ] as const;
    render(<ForecastFlags flags={all} notes />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/outbreak_underprediction_risk|estimated_inputs/);
  });
});

describe("ReliabilityNote (luật T5)", () => {
  it("miền Nam: chỉ ngang dự báo theo mùa — không được ghi là 'cao'", () => {
    render(
      <ReliabilityNote
        region="Nam"
        reliability={{
          region_level: "equal_to_seasonal_baseline",
          note_code: "nam_equals_baseline",
        }}
      />
    );
    expect(screen.getByText("Ngang dự báo theo mùa")).toBeInTheDocument();
    expect(screen.queryByText("Cao")).not.toBeInTheDocument();
  });

  it("miền Bắc: nêu cả điểm mạnh lẫn giới hạn", () => {
    render(
      <ReliabilityNote
        region="Bắc"
        reliability={{ region_level: "low_in_outbreak_years", note_code: "bac_outbreak_years" }}
      />
    );
    expect(screen.getByText("Thấp ở năm dịch bất thường")).toBeInTheDocument();
    expect(screen.getByText(/thất bại ở năm dịch bất thường/)).toBeInTheDocument();
  });

  it("mã ghi chú lạ → câu chung, không hiện mã thô", () => {
    render(
      <ReliabilityNote
        region="Trung"
        reliability={{ region_level: "high", note_code: "moi_chua_biet" }}
      />
    );
    expect(screen.getByText(/Chưa có ghi chú/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/moi_chua_biet/);
  });
});

describe("InputSources (luật T2)", () => {
  it("nêu tỉ trọng đo thật và ước lượng bằng chữ", () => {
    render(<InputSources sources={{ real: 0.75, estimated: 0.25, imputed: 0 }} />);
    expect(screen.getByText("75% đo thật · 25% ước lượng")).toBeInTheDocument();
  });

  it("toàn bộ đo thật chỉ nêu một phần", () => {
    render(<InputSources sources={{ real: 1, estimated: 0, imputed: 0 }} />);
    expect(screen.getByText("100% đo thật")).toBeInTheDocument();
  });
});
