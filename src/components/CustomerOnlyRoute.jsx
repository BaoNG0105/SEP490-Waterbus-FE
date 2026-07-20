import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { isOperationsUser } from "../utils/roleHelpers";

// Chặn tài khoản Admin/Staff/Manager truy cập các trang đặt vé dành cho Khách hàng
export const CustomerOnlyRoute = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (isAuthenticated && isOperationsUser(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
