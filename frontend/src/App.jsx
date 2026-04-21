import { Navigate, Route, Routes } from "react-router-dom";

import { RequireRole, useAuth, defaultRouteFor } from "./lib/auth.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import DriverDashboard from "./pages/DriverDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading
            ? <div className="p-8 text-slate-500">Ładowanie…</div>
            : <Navigate to={user ? defaultRouteFor(user.role) : "/login"} replace />
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/client/*"
        element={
          <RequireRole roles={["client"]}>
            <ClientDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/driver/*"
        element={
          <RequireRole roles={["driver", "admin"]}>
            <DriverDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireRole roles={["admin"]}>
            <AdminDashboard />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
