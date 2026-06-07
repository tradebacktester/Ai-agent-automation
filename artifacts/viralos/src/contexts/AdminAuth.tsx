import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY = "viralos_admin_session";

interface AdminAuthContextType {
  isLoggedIn: boolean;
  login: (id: string, password: string) => boolean;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const ADMIN_ID = import.meta.env.VITE_ADMIN_ID ?? "admin";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "Viralos@2024!";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  function login(id: string, password: string): boolean {
    if (id === ADMIN_ID && password === ADMIN_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setIsLoggedIn(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setIsLoggedIn(false);
  }

  return (
    <AdminAuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
