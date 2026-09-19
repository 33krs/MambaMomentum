import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App, { RouteLoadingFallback } from "./App";

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: { id: 1, email: "user@example.com", full_name: null, is_active: true, created_at: "" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("./pages/DashboardPage", () => ({
  default: () => <h1>Panel cargado</h1>,
}));

describe("App", () => {
  it("announces a route loading state while a lazy page resolves", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando contenido");
    expect(await screen.findByRole("heading", { name: "Panel cargado" })).toBeInTheDocument();
  });

  it("renders an accessible fallback", () => {
    render(<RouteLoadingFallback />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
