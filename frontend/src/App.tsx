import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { ThemeProvider } from "./context/ThemeContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const FocusSessionsPage = lazy(() => import("./pages/FocusSessionsPage"));
const WorkoutsPage = lazy(() => import("./pages/WorkoutsPage"));
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const HabitsPage = lazy(() => import("./pages/HabitsPage"));

export function RouteLoadingFallback() {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite">
      <p className="text-slate-500 dark:text-slate-400">Cargando contenido…</p>
    </div>
  );
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CategoriesProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedPage>
                  <DashboardPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/focus"
              element={
                <ProtectedPage>
                  <FocusSessionsPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/workouts"
              element={
                <ProtectedPage>
                  <WorkoutsPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/kanban"
              element={
                <ProtectedPage>
                  <KanbanPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/habits"
              element={
                <ProtectedPage>
                  <HabitsPage />
                </ProtectedPage>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CategoriesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
