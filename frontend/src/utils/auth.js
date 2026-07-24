export function getSession() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user")); } catch { user = null; }
  return { token, role, user, isAuthenticated: Boolean(token && user && role) };
}

export function createSession(payload) {
  const user = { id:payload.userId, name:payload.fullName, role:payload.role };
  localStorage.setItem("token", payload.token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", payload.role);
  return user;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

export function homeForRole(role) {
  return role === "admin" || role === "manager" ? "/manager/dashboard" : role === "employee" ? "/employee/home" : "/login";
}
