export const DEMO_USERS = [
  { email: "admin@daiga.vn", password: "123456", role: "manager", name: "Quốc Anh", position: "Quản lý cửa hàng" },
  { email: "nhanvien@daiga.vn", password: "123456", role: "employee", name: "Trần Thảo Linh", position: "Nhân viên thu ngân" },
];

export function getSession() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user")); } catch { user = null; }
  return { token, role, user, isAuthenticated: Boolean(token && user && role) };
}

export function createSession(account) {
  const user = { email: account.email, role: account.role, name: account.name, position: account.position };
  localStorage.setItem("token", `demo-${account.role}-${Date.now()}`);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", account.role);
  return user;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

export function homeForRole(role) {
  return role === "manager" ? "/manager/dashboard" : role === "employee" ? "/employee/home" : "/login";
}
