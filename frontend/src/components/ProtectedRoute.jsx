import { Navigate, Outlet } from "react-router-dom";
import { getSession } from "../utils/auth";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = getSession();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children || <Outlet />;
}
