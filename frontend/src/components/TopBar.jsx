import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function TopBar({ title, children }) {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="font-bold text-brand-700 whitespace-nowrap">
            Dostawa Napojów
          </Link>
          {title && (
            <span className="text-slate-400">/</span>
          )}
          {title && (
            <span className="text-slate-700 font-medium truncate">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {children}
          {user && (
            <>
              <span className="hidden sm:inline text-slate-500">
                {user.email} · <span className="uppercase text-xs tracking-wider">{user.role}</span>
              </span>
              <button className="btn-secondary" onClick={logout}>
                Wyloguj
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
