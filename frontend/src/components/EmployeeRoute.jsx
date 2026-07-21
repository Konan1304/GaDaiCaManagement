import { Navigate, Outlet } from "react-router-dom";
import { getSession } from "../utils/auth";

export default function EmployeeRoute({ children }) {
  const { isAuthenticated, role } = getSession();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== "employee") return <Navigate to="/manager/dashboard" replace />;
  return children || <Outlet />;
}
