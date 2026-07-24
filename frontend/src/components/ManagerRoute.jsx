import { Navigate, Outlet } from "react-router-dom";
import { getSession } from "../utils/auth";

export default function ManagerRoute({ children }) {
  const { isAuthenticated, role } = getSession();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== "manager" && role !== "admin") return <Navigate to="/employee/home" replace />;
  return children || <Outlet />;
}
