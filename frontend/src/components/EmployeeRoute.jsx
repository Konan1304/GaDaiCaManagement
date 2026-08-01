import { Navigate, Outlet } from "react-router-dom";
import { getSession } from "../utils/auth";

export default function EmployeeRoute({ children }) {
  const { isAuthenticated, role } = getSession();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!["employee", "manager", "admin"].includes(role)) return <Navigate to="/login" replace />;
  return children || <Outlet />;
}
