import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export const AdminProtectedRoute = () => {
  // Lấy trạng thái đăng nhập và thông tin user từ Redux
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Danh sách các quyền được phép truy cập Admin
  const allowedRoles = ["ADMIN", "STAFF", "MANAGER"];

  // 1. Chưa đăng nhập -> Đá về trang Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Kiểm tra xem user có chứa role hợp lệ không
  // Dựa vào cấu trúc: user.roles = [{ systemName: "CUSTOMER" }, ...]
  const hasRequiredRole = user?.roles?.some((role) =>
    allowedRoles.includes(role.systemName)
  );

  // 3. Đã đăng nhập nhưng KHÔNG phải Admin/Staff/Manager -> Đá về trang chủ (Khách)
  if (!hasRequiredRole) {
    return <Navigate to="/" replace />;
  }

  // 4. Hợp lệ -> Cho phép đi tiếp vào các trang con (Outlet)
  return <Outlet />;
};