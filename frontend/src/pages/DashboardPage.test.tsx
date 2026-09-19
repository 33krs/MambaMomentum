import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartLoadingFallback } from "./DashboardPage";

describe("ChartLoadingFallback", () => {
  it("reserves the chart height and announces loading", () => {
    render(<ChartLoadingFallback />);

    const loadingStatus = screen.getByRole("status");

    expect(loadingStatus).toHaveClass("h-[280px]");
    expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    expect(loadingStatus).toHaveTextContent("Cargando gráfico");
  });
});
