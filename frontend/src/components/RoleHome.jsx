import { Navigate } from "react-router-dom";
import { getSession, homeForRole } from "../utils/auth";
export default function RoleHome() { return <Navigate to={homeForRole(getSession().role)} replace />; }
