import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatCard from "./StatCard";

describe("StatCard", () => {
  it("renders the label, value and optional hint", () => {
    render(<StatCard label="Minutos" value="120" hint="últimos 7 días" />);

    expect(screen.getByText("Minutos")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("últimos 7 días")).toBeInTheDocument();
  });

  it("omits the hint when not provided", () => {
    render(<StatCard label="Entrenamientos" value="3" />);

    expect(screen.getByText("Entrenamientos")).toBeInTheDocument();
    expect(screen.queryByText("últimos 7 días")).not.toBeInTheDocument();
  });
});
