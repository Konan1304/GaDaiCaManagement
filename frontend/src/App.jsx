import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "./pages/Auth/LoginPage";
import ManagerLayout from "./layouts/ManagerLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagerRoute from "./components/ManagerRoute";
import EmployeeRoute from "./components/EmployeeRoute";
import RoleHome from "./components/RoleHome";
import DashboardPage from "./pages/Manager/DashboardPage";
import EmployeesPage from "./pages/Manager/EmployeesPage";
import EmployeeBranchesPage from "./pages/Manager/EmployeeBranchesPage";
import SchedulePage from "./pages/Manager/SchedulePage";
import ManagerUtilityPage from "./pages/Manager/ManagerUtilityPage";
import InventoryPage from "./pages/Inventory/InventoryPage";
import ReportsPage from "./pages/Manager/ShiftsPage";
import EmployeeHomePage from "./pages/Employee/EmployeeHomePage";
import AttendancePage from "./pages/Employee/AttendancePage";
import ExpensesPage from "./pages/Employee/ExpensesPage";
import MySchedulePage from "./pages/Employee/MySchedulePage";
import ProfilePage from "./pages/Employee/ProfilePage";
import LeaveRequestPage from "./pages/Employee/LeaveRequestPage";
import NotificationsPage from "./pages/Employee/NotificationsPage";
import ShiftRegistrationPage from "./pages/Employee/ShiftRegistrationPage";
import ManagerShiftRegistrationPage from "./pages/Manager/ShiftRegistrationPage";
import ShiftRegistrationDetailPage from "./pages/Manager/ShiftRegistrationDetailPage";
import ScheduleBuilderPage from "./pages/Manager/ScheduleBuilderPage";
import PayrollPage from "./pages/Manager/PayrollPage";
import PayrollDetailPage from "./pages/Manager/PayrollDetailPage";
import EmployeePayrollPage from "./pages/Employee/PayrollPage";
import ManagerAttendancePage from "./pages/Manager/ManagerAttendancePage";
import CategoriesPage from "./pages/Manager/CategoriesPage";
import SuppliersPage from "./pages/Manager/SuppliersPage";
import AttendanceTestPage from "./pages/Manager/AttendanceTestPage";
import OperationShiftPage from "./pages/Employee/OperationShiftPage";
import OperationDashboardPage from "./pages/Manager/OperationDashboardPage";
import InternalChatPage from "./pages/Shared/InternalChatPage";
import NotificationCenterPage from "./pages/Shared/NotificationCenterPage";
import ShiftInventoryPage from "./pages/Employee/ShiftInventoryPage";
import ShiftInventoryAdminPage from "./pages/Manager/ShiftInventoryAdminPage";
import ReceiveGoodsPage from "./pages/Employee/ReceiveGoodsPage";
import EmployeeOperationalReportsPage from "./pages/Employee/OperationalReportsPage";

const isSandbox=import.meta.env.VITE_APP_ENV==="sandbox";

export default function App() {
  useEffect(() => {
    const isPicker = target => target instanceof HTMLInputElement && ["date", "month", "datetime-local"].includes(target.type);
    const open = event => {
      if (isPicker(event.target)) event.target.showPicker?.();
    };
    const blockTyping = event => {
      if (isPicker(event.target) && !["Tab", "Escape"].includes(event.key)) event.preventDefault();
    };
    const blockInsert = event => {
      if (isPicker(event.target)) event.preventDefault();
    };
    document.addEventListener("click", open, true);
    document.addEventListener("keydown", blockTyping, true);
    document.addEventListener("paste", blockInsert, true);
    document.addEventListener("drop", blockInsert, true);
    return () => {
      document.removeEventListener("click", open, true);
      document.removeEventListener("keydown", blockTyping, true);
      document.removeEventListener("paste", blockInsert, true);
      document.removeEventListener("drop", blockInsert, true);
    };
  }, []);
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<RoleHome />} />
    </Route>
    <Route element={<ManagerRoute />}>
      <Route path="/manager" element={<ManagerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="employees" element={<EmployeeBranchesPage />} />
        <Route path="employees/branch/:branchId" element={<EmployeesPage />} />
        <Route path="shift-registration" element={<ManagerShiftRegistrationPage />} />
        <Route path="shift-registration/:periodId" element={<ShiftRegistrationDetailPage />} />
        <Route path="schedules/builder/:periodId" element={<ScheduleBuilderPage />} />
        <Route path="schedules" element={<SchedulePage />} />
        <Route path="attendance" element={<ManagerAttendancePage />} />
        {isSandbox&&<Route path="attendance/test" element={<AttendanceTestPage />} />}
        <Route path="operations" element={<Navigate to="/manager/operations/dashboard" replace />} />
        <Route path="operations/dashboard" element={<OperationDashboardPage />} />
        <Route path="chat" element={<InternalChatPage />} />
        <Route path="notification-center" element={<NotificationCenterPage />} />
        <Route path="shift-inventory" element={<ShiftInventoryAdminPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="imports" element={<Navigate to="/manager/inventory?tab=transactions" replace />} />
        <Route path="exports" element={<Navigate to="/manager/inventory?tab=transactions" replace />} />
        <Route path="products" element={<Navigate to="/manager/inventory?tab=products" replace />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="payrolls" element={<PayrollPage />} />
        <Route path="payrolls/:employeeId" element={<PayrollDetailPage />} />
        <Route path="notifications" element={<Navigate to="/manager/notification-center" replace />} />
        <Route path="settings" element={<ManagerUtilityPage type="settings" />} />
      </Route>
    </Route>
    <Route element={<EmployeeRoute />}>
      <Route path="/employee" element={<EmployeeLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<EmployeeHomePage />} />
        <Route path="pos" element={<Navigate to="/employee/home" replace />} />
        <Route path="orders" element={<Navigate to="/employee/home" replace />} />
        <Route path="shift" element={<OperationShiftPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="shift-closing" element={<Navigate to="/employee/shift" replace />} />
        <Route path="shift-report" element={<Navigate to="/employee/shift" replace />} />
        <Route path="shift-registration" element={<ShiftRegistrationPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="schedule" element={<MySchedulePage />} />
        <Route path="leave-request" element={<LeaveRequestPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="payroll" element={<EmployeePayrollPage />} />
        <Route path="chat" element={<InternalChatPage />} />
        <Route path="reports" element={<EmployeeOperationalReportsPage />} />
        <Route path="shift-inventory" element={<ShiftInventoryPage />} />
        <Route path="receive-goods" element={<ReceiveGoodsPage />} />
        <Route path="notification-center" element={<NotificationCenterPage />} />
      </Route>
    </Route>
    <Route path="*" element={<RoleHome />} />
  </Routes></BrowserRouter>;
}
