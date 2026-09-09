import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h2>}
      {children}
    </section>
  );
}
