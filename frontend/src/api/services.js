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
export const unitApi = {
  list: (params) => axiosClient.get("/units", { params }).then(r=>r.data),
};
export const categoryApi = {
  list: params => axiosClient.get("/categories",{params}).then(r=>r.data),
  detail: id => axiosClient.get(`/categories/${id}`).then(r=>r.data),
  create: payload => axiosClient.post("/categories",payload).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/categories/${id}`,payload).then(r=>r.data),
  remove: id => axiosClient.delete(`/categories/${id}`).then(r=>r.data),
};
export const supplierApi = {
  list: params => axiosClient.get("/suppliers",{params}).then(r=>r.data),
  detail: id => axiosClient.get(`/suppliers/${id}`).then(r=>r.data),
  create: payload => axiosClient.post("/suppliers",payload).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/suppliers/${id}`,payload).then(r=>r.data),
  remove: id => axiosClient.delete(`/suppliers/${id}`).then(r=>r.data),
};
export const importApi = {
  list: params => axiosClient.get("/imports",{params}).then(r=>r.data),
  detail: id => axiosClient.get(`/imports/${id}`).then(r=>r.data),
  create: payload => axiosClient.post("/imports",payload).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/imports/${id}`,payload).then(r=>r.data),
  remove: id => axiosClient.delete(`/imports/${id}`).then(r=>r.data),
  confirm: id => axiosClient.post(`/imports/${id}/confirm`).then(r=>r.data),
  adjust: (id,payload) => axiosClient.post(`/imports/${id}/adjustments`,payload).then(r=>r.data),
};
export const dashboardApi = { get: () => axiosClient.get("/dashboard").then(r=>r.data) };
export const inventoryOverviewApi = {
  list: params => axiosClient.get("/inventory-overview", { params }).then(r=>r.data),
  detail: (productId,params) => axiosClient.get(`/inventory-overview/${productId}/history`,{params}).then(r=>r.data),
  transactions: params => axiosClient.get("/inventory-overview/transactions",{params}).then(r=>r.data),
  createExport: payload => axiosClient.post("/inventory-overview/exports",payload).then(r=>r.data),
};
export const payrollApi = {
  list: params => axiosClient.get("/manager/payrolls",{params}).then(r=>r.data),
  detail: (employeeId,month) => axiosClient.get(`/manager/payrolls/${employeeId}`,{params:{month}}).then(r=>r.data),
  calculate: params => axiosClient.post("/manager/payrolls/calculate",null,{params}).then(r=>r.data),
  save: (employeeId,month,payload) => axiosClient.put(`/manager/payrolls/${employeeId}`,payload,{params:{month}}).then(r=>r.data),
  transition: (employeeId,month,action) => axiosClient.patch(`/manager/payrolls/${employeeId}/${action}`,null,{params:{month}}).then(r=>r.data),
  mine: month => axiosClient.get("/employee/payroll",{params:{month}}).then(r=>r.data),
};

export const environmentApi = {
  get: () => axiosClient.get("/environment").then(r=>r.data)
};
export const managerScheduleApi = { list: params => axiosClient.get("/manager/schedules",{params}).then(r=>r.data) };
export const managerAttendanceApi = {
  list: params => axiosClient.get("/manager/attendance",{params}).then(r=>r.data),
  options: () => axiosClient.get("/manager/attendance/options").then(r=>r.data),
  detail: id => axiosClient.get(`/manager/attendance/${id}`).then(r=>r.data),
  update: (id,payload) => axiosClient.put(`/manager/attendance/${id}`,payload).then(r=>r.data),
  manual: payload => axiosClient.post("/manager/attendance/manual",payload).then(r=>r.data),
};
export const sandboxAttendanceApi = {
  options: () => axiosClient.get("/sandbox/attendance-test/options").then(r=>r.data),
  schedules: params => axiosClient.get("/sandbox/attendance-test/schedules",{params}).then(r=>r.data),
  generate: payload => axiosClient.post("/sandbox/attendance-test/generate",payload).then(r=>r.data),
};
export const operationApi={current:(date,scheduleId)=>axiosClient.get("/operations/shifts/current",{params:{...(date?{date}:{}),...(scheduleId?{scheduleId}:{})}}).then(r=>r.data),open:payload=>axiosClient.post("/operations/shifts/open",payload).then(r=>r.data),list:params=>axiosClient.get("/operations/shifts",{params}).then(r=>r.data),detail:id=>axiosClient.get(`/operations/shifts/${id}`).then(r=>r.data),eligibility:id=>axiosClient.get(`/operations/shifts/${id}/eligibility`).then(r=>r.data),report:id=>axiosClient.get(`/operations/shifts/${id}/report`).then(r=>r.data),saveReport:(id,payload)=>axiosClient.put(`/operations/shifts/${id}/report`,payload).then(r=>r.data),submitReport:(id,payload)=>axiosClient.post(`/operations/shifts/${id}/submit-report`,payload).then(r=>r.data),cashCount:id=>axiosClient.get(`/operations/shifts/${id}/cash-count`).then(r=>r.data),saveCashCount:(id,denominations)=>axiosClient.put(`/operations/shifts/${id}/cash-count`,{denominations}).then(r=>r.data),attachments:id=>axiosClient.get(`/operations/shifts/${id}/attachments`).then(r=>r.data),uploadAttachment:(id,file,attachmentType)=>{const form=new FormData();form.append("image",file);form.append("attachmentType",attachmentType);return axiosClient.post(`/operations/shifts/${id}/attachments`,form,{headers:{"Content-Type":"multipart/form-data"}}).then(r=>r.data)},removeAttachment:(id,attachmentId)=>axiosClient.delete(`/operations/shifts/${id}/attachments/${attachmentId}`).then(r=>r.data),handover:id=>axiosClient.get(`/operations/shifts/${id}/handover`).then(r=>r.data),receiveHandover:(id,payload)=>axiosClient.post(`/operations/shifts/${id}/receive-handover`,payload).then(r=>r.data),history:params=>axiosClient.get('/operations/reports/history',{params}).then(r=>r.data)};
export const managerOperationApi={mappings:()=>axiosClient.get("/manager/operations/mappings").then(r=>r.data),saveMapping:payload=>axiosClient.put("/manager/operations/mappings",payload).then(r=>r.data),assignments:params=>axiosClient.get("/manager/operations/assignments",{params}).then(r=>r.data),assign:payload=>axiosClient.post("/manager/operations/assignments",payload).then(r=>r.data),overview:params=>axiosClient.get("/manager/operations/overview",{params}).then(r=>r.data),clock:()=>axiosClient.get("/manager/operations/clock").then(r=>r.data),updateClock:businessDateTime=>axiosClient.put("/manager/operations/clock",{businessDateTime}).then(r=>r.data),unlock:(id,reason)=>axiosClient.post(`/manager/operations/shifts/${id}/unlock`,{reason}).then(r=>r.data),lock:id=>axiosClient.post(`/manager/operations/shifts/${id}/lock`).then(r=>r.data),dashboard:params=>axiosClient.get('/manager/operations/dashboard',{params}).then(r=>r.data),timeline:params=>axiosClient.get('/manager/operations/timeline',{params}).then(r=>r.data),report:(period,params)=>axiosClient.get(`/manager/operations/reports/${period}`,{params}).then(r=>r.data),audit:id=>axiosClient.get(`/manager/operations/shifts/${id}/audit`).then(r=>r.data),exportUrl:(type,params)=>axiosClient.get(`/manager/operations/export/${type}`,{params,responseType:'blob'}).then(r=>r.data)};
export const chatApi={channels:()=>axiosClient.get('/chat/channels').then(r=>r.data),messages:(id,params)=>axiosClient.get(`/chat/channels/${id}/messages`,{params}).then(r=>r.data),send:(id,payload)=>axiosClient.post(`/chat/channels/${id}/messages`,payload).then(r=>r.data),read:id=>axiosClient.put(`/chat/channels/${id}/read`).then(r=>r.data),remove:id=>axiosClient.delete(`/chat/messages/${id}`).then(r=>r.data)};
export const notificationCenterApi={list:()=>axiosClient.get('/notifications').then(r=>r.data),read:id=>axiosClient.put(`/notifications/${id}/read`).then(r=>r.data),readAll:()=>axiosClient.put('/notifications/read-all').then(r=>r.data)};
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
  updateBranchName: (id,branchName) => axiosClient.patch(`/manager/branches/${id}/name`,{branchName}).then(r=>r.data),
  employeeBranches: params => axiosClient.get("/manager/employee-branches",{params}).then(r=>r.data),
  remove: id => axiosClient.delete(`/manager/employees/${id}`).then(r=>r.data),
};
export const employeeApi = {
  schedules: (from, to) => axiosClient.get("/employee/schedules", { params:{ from, to } }).then(r=>r.data),
  attendance: () => axiosClient.get("/employee/attendance").then(r=>r.data),
  attendanceToday: (date,scheduleId) => axiosClient.get("/employee/attendance/today",{params:{...(date?{date}:{}),...(scheduleId?{scheduleId}:{})}}).then(r=>r.data),
  attendanceTestSchedules: () => axiosClient.get("/employee/attendance/test-schedules").then(r=>r.data),
  attendanceCheckIn: payload => axiosClient.post("/employee/attendance/check-in",payload).then(r=>r.data),
  attendanceCheckOut: payload => axiosClient.post("/employee/attendance/check-out",payload).then(r=>r.data),
  attendanceHistory: month => axiosClient.get("/employee/attendance/history",{params:{month}}).then(r=>r.data),
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
export const shiftInventoryApi={
  current:params=>axiosClient.get('/shift-inventory/current',{params}).then(r=>r.data),
  start:payload=>axiosClient.post('/shift-inventory/current/start',payload).then(r=>r.data),
  detail:id=>axiosClient.get(`/shift-inventory/${id}`).then(r=>r.data),
  movements:id=>axiosClient.get(`/shift-inventory/${id}/movements`).then(r=>r.data),
  recordUsage:(id,payload)=>axiosClient.post(`/shift-inventory/${id}/usage`,payload).then(r=>r.data),
  receive:(id,items)=>axiosClient.post(`/shift-inventory/${id}/receive`,{items}).then(r=>r.data),
  close:(id,payload)=>axiosClient.post(`/shift-inventory/${id}/close`,payload).then(r=>r.data),
  uploadImage:(id,file)=>{const body=new FormData();body.append('image',file);return axiosClient.post(`/shift-inventory/${id}/images`,body,{headers:{'Content-Type':'multipart/form-data'}}).then(r=>r.data)},
  imageUrl:id=>`${axiosClient.defaults.baseURL}/shift-inventory/images/${id}/file`,
  options:()=>axiosClient.get('/shift-inventory/admin/options').then(r=>r.data),
  baseline:payload=>axiosClient.post('/shift-inventory/admin/baseline',payload).then(r=>r.data),
  sessions:params=>axiosClient.get('/shift-inventory/admin/sessions',{params}).then(r=>r.data),
  discrepancies:()=>axiosClient.get('/shift-inventory/admin/discrepancies').then(r=>r.data),
  resolve:(id,payload)=>axiosClient.post(`/shift-inventory/admin/discrepancies/${id}/resolve`,payload).then(r=>r.data)
};
