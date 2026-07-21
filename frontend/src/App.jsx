import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/Auth/LoginPage";
import ManagerLayout from "./layouts/ManagerLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagerRoute from "./components/ManagerRoute";
import EmployeeRoute from "./components/EmployeeRoute";
import RoleHome from "./components/RoleHome";
import DashboardPage from "./pages/Manager/DashboardPage";
import EmployeesPage from "./pages/Manager/EmployeesPage";
import SchedulePage from "./pages/Manager/SchedulePage";
import ManagerUtilityPage from "./pages/Manager/ManagerUtilityPage";
import InventoryPage from "./pages/Inventory/InventoryPage";
import ImportInventoryPage from "./pages/Inventory/ImportInventoryPage";
import ProductsPage from "./pages/Inventory/InventoryHistoryPage";
import ReportsPage from "./pages/Manager/ShiftsPage";
import EmployeeHomePage from "./pages/Employee/EmployeeHomePage";
import PosPage from "./pages/Employee/PosPage";
import OrdersPage from "./pages/Employee/OrdersPage";
import ShiftPage from "./pages/Employee/ShiftPage";
import AttendancePage from "./pages/Employee/AttendancePage";
import ShiftClosingPage from "./pages/Employee/ShiftClosingPage";
import ExpensesPage from "./pages/Employee/ExpensesPage";
import MySchedulePage from "./pages/Employee/MySchedulePage";
import ProfilePage from "./pages/Employee/ProfilePage";

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<RoleHome />} />
    </Route>
    <Route element={<ManagerRoute />}>
      <Route path="/manager" element={<ManagerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="schedules" element={<SchedulePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="imports" element={<ImportInventoryPage />} />
        <Route path="exports" element={<ManagerUtilityPage type="exports" />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<ManagerUtilityPage type="categories" />} />
        <Route path="suppliers" element={<ManagerUtilityPage type="suppliers" />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<ManagerUtilityPage type="notifications" />} />
        <Route path="settings" element={<ManagerUtilityPage type="settings" />} />
      </Route>
    </Route>
    <Route element={<EmployeeRoute />}>
      <Route path="/employee" element={<EmployeeLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<EmployeeHomePage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="shift" element={<ShiftPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="shift-closing" element={<ShiftClosingPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="schedule" element={<MySchedulePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<RoleHome />} />
  </Routes></BrowserRouter>;
}
