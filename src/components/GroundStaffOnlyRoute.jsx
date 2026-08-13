import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { isStaffOnlyUser, isOnBoardStaffUser } from "../utils/roleHelpers";

/**
 * Chặn truy cập trực tiếp bằng URL — dùng cho các trang chỉ dành cho
 * staff mặt đất (staffType = Ground), ví dụ quầy bán vé (Booking POS).
 * Admin/Manager không bị ảnh hưởng bởi rule này; chỉ áp dụng cho staff "thuần"
 * (có role STAFF, không kiêm Admin/Manager) đang là OnBoard.
 */
export const GroundStaffOnlyRoute = () => {
  const { user } = useSelector((state) => state.auth);

  if (isStaffOnlyUser(user) && isOnBoardStaffUser(user)) {
    return <Navigate to="/admin/staff/my-trips" replace />;
  }

  return <Outlet />;
};
