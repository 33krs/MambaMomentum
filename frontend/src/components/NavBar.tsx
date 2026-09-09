import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const links = [
  { to: "/", label: "Panel" },
  { to: "/focus", label: "Concentración" },
  { to: "/workouts", label: "Entrenamientos" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <span className="shrink-0 text-lg font-extrabold tracking-tight text-brand-700 dark:text-brand-400">MambaMomentum</span>
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Navegación principal">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}`}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={toggleTheme} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span><span className="sr-only">Cambiar tema</span>
          </button>
          <span className="hidden max-w-48 truncate text-slate-500 dark:text-slate-400 md:inline">{user?.email}</span>
          <button type="button" onClick={handleLogout} className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cerrar sesión</button>
        </div>
      </div>
    </header>
  );
}
