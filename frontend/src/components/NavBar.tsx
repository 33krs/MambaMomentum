import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Panel" },
  { to: "/focus", label: "Concentración" },
  { to: "/workouts", label: "Entrenamientos" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold text-brand-700">MambaMomentum</span>
          <nav className="flex gap-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
