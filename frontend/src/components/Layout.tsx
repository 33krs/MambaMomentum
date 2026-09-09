import type { ReactNode } from "react";

import NavBar from "./NavBar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-brand-200 dark:bg-slate-950 dark:selection:bg-brand-800">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  );
}
