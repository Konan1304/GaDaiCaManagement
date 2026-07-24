import axiosClient from "./axiosClient";

export const authApi = { login: (credentials) => axiosClient.post("/auth/login", credentials).then(r=>r.data) };
export const profileApi = { get: () => axiosClient.get("/profile").then(r=>r.data) };
export const shiftApi = { today: () => axiosClient.get("/shifts/today").then(r=>r.data) };
export const orderApi = {
  list: (params) => axiosClient.get("/orders", { params }).then(r=>r.data),
  create: (payload) => axiosClient.post("/orders", payload).then(r=>r.data),
  updateStatus: (id,status) => axiosClient.put(`/orders/${id}/status`, { status }).then(r=>r.data),
};
export const productApi = {
  list: (params) => axiosClient.get("/products", { params }).then(r=>r.data),
  create: (payload) => axiosClient.post("/products", payload).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/products/${id}`, payload).then(r=>r.data),
  remove: (id) => axiosClient.delete(`/products/${id}`).then(r=>r.data),
};
export const dashboardApi = { get: () => axiosClient.get("/dashboard").then(r=>r.data) };
export const managerScheduleApi = { list: params => axiosClient.get("/manager/schedules",{params}).then(r=>r.data) };
export const managerEmployeeApi = {
  list: (params) => axiosClient.get("/manager/employees", { params }).then(r=>r.data),
  get: (id) => axiosClient.get(`/manager/employees/${id}`).then(r=>r.data),
  create: (payload) => axiosClient.post("/manager/employees", payload).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/manager/employees/${id}`, payload).then(r=>r.data),
  accountStatus: (id,status) => axiosClient.patch(`/manager/employees/${id}/account-status`, {status}).then(r=>r.data),
  resetPassword: (id,newPassword) => axiosClient.patch(`/manager/employees/${id}/reset-password`, {newPassword}).then(r=>r.data),
  resign: (id,note) => axiosClient.patch(`/manager/employees/${id}/resign`, {note}).then(r=>r.data),
  branches: () => axiosClient.get("/manager/branches").then(r=>r.data),
  positions: () => axiosClient.get("/manager/positions").then(r=>r.data),
  createBranch: payload => axiosClient.post("/manager/branches",payload).then(r=>r.data),
  employeeBranches: params => axiosClient.get("/manager/employee-branches",{params}).then(r=>r.data),
  remove: id => axiosClient.delete(`/manager/employees/${id}`).then(r=>r.data),
};
export const employeeApi = {
  schedules: (from, to) => axiosClient.get("/employee/schedules", { params:{ from, to } }).then(r=>r.data),
  attendance: () => axiosClient.get("/employee/attendance").then(r=>r.data),
  shiftSession: () => axiosClient.get("/employee/shift-session").then(r=>r.data),
  openShift: (payload) => axiosClient.post("/employee/shift-session/open", payload).then(r=>r.data),
  closeShift: (payload) => axiosClient.post("/employee/shift-session/close", payload).then(r=>r.data),
  shiftReports: () => axiosClient.get("/employee/shift-reports").then(r=>r.data),
  expenses: (date) => axiosClient.get("/employee/expenses", { params:{ date } }).then(r=>r.data),
  createExpense: (payload) => axiosClient.post("/employee/expenses", payload).then(r=>r.data),
  leaveRequests: () => axiosClient.get("/employee/leave-requests").then(r=>r.data),
  createLeaveRequest: (payload) => axiosClient.post("/employee/leave-requests", payload).then(r=>r.data),
  notifications: () => axiosClient.get("/employee/notifications").then(r=>r.data),
  readNotification: (id) => axiosClient.put(`/employee/notifications/${id}/read`).then(r=>r.data),
  currentShiftRegistration: () => axiosClient.get("/employee/shift-registration/current").then(r=>r.data),
  saveShiftRegistration: (periodId,payload) => axiosClient.put(`/employee/shift-registration/${periodId}`,payload).then(r=>r.data),
};
export const scheduleRegistrationApi = {
  periods: () => axiosClient.get("/manager/schedule-registration-periods").then(r=>r.data),
  create: payload => axiosClient.post("/manager/schedule-registration-periods",payload).then(r=>r.data),
  detail: id => axiosClient.get(`/manager/schedule-registration-periods/${id}`).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/manager/schedule-registration-periods/${id}`,payload).then(r=>r.data),
  remove: id => axiosClient.delete(`/manager/schedule-registration-periods/${id}`).then(r=>r.data),
  action: (id,action) => axiosClient.patch(`/manager/schedule-registration-periods/${id}/${action}`).then(r=>r.data),
    builder: id => axiosClient.get(`/manager/schedule-builder/${id}`).then(r=>r.data),
    saveBuilder: (id,schedules) => axiosClient.put(`/manager/schedule-builder/${id}/draft`,{schedules}).then(r=>r.data),
    publishBuilder: (id,schedules) => axiosClient.post(`/manager/schedule-builder/${id}/publish`,{schedules}).then(r=>r.data),
    publish: id => axiosClient.patch(`/manager/schedule-registration-periods/${id}/publish`).then(r=>r.data),
  };
