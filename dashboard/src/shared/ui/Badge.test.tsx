import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataSource } from "@/shared/api";

import { DataSourceBadge } from "./Badge";

describe("DataSourceBadge (luật T2: dữ liệu không thật không được trông như thật)", () => {
  it("dữ liệu đo thật có nhãn riêng", () => {
    render(<DataSourceBadge source="real" />);
    expect(screen.getByText(/dữ liệu thật/i)).toBeInTheDocument();
  });

  it.each<DataSource>(["estimated", "imputed", "simulated"])(
    "nguồn %s KHÔNG được hiển thị như dữ liệu đo thật",
    (source) => {
      const { container } = render(<DataSourceBadge source={source} />);
      expect(screen.queryByText(/dữ liệu thật/i)).not.toBeInTheDocument();
      expect(container.textContent?.trim()).not.toBe("");
    }
  );
});
