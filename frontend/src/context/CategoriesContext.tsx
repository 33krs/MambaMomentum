import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "focusCategories";
const DEFAULT_CATEGORIES = ["Trabajo", "Estudio", "Proyecto Personal", "Lectura", "General"];

interface CategoriesContextValue {
  categories: string[];
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  removeCategory: (name: string) => void;
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);

function loadInitial(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignorar y usar valores por defecto
  }
  return DEFAULT_CATEGORIES;
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<string[]>(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories((prev) => [...prev, trimmed]);
  }

  function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setCategories((prev) => prev.map((c) => (c === oldName ? trimmed : c)));
  }

  function removeCategory(name: string) {
    setCategories((prev) => (prev.length > 1 ? prev.filter((c) => c !== name) : prev));
  }

  return (
    <CategoriesContext.Provider value={{ categories, addCategory, renameCategory, removeCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together by convention
export function useCategories(): CategoriesContextValue {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories debe usarse dentro de un CategoriesProvider");
  }
  return context;
}
