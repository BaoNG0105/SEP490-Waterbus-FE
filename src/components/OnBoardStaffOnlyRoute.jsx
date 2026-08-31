import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { isOnBoardStaffUser, isStaffOnlyUser } from "../utils/roleHelpers";

/**
 * Scanner pages are available to OnBoard staff. Admin/Manager keep their
 * existing access; the staff-type restriction only applies to staff-only users.
 */
export const OnBoardStaffOnlyRoute = () => {
  const { user } = useSelector((state) => state.auth);

  if (isStaffOnlyUser(user) && !isOnBoardStaffUser(user)) {
    return <Navigate to="/admin/staff/my-trips" replace />;
  }

  return <Outlet />;
};
