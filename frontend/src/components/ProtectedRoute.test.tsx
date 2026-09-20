import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as AuthContext from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

function renderWithRoute() {
  return render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Contenido protegido</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while auth is resolving", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRoute();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("redirects to /login when there is no authenticated user", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRoute();
    expect(screen.getByText("Página de login")).toBeInTheDocument();
  });

  it("renders children when the user is authenticated", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: 1, email: "a@b.com", full_name: null, is_active: true, created_at: "" },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRoute();
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });
});
