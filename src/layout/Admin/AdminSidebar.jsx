import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useApp } from "../../context/AppContext";
import { fetchCurrentUserProfile } from "../../services/authService";
import { hasRole, isAdminUser, isManagerUser, isStaffUser } from "../../utils/roleHelpers";
import { logout, updateUserProfile } from "../../redux/authSlice";

// Nhóm sidebar theo nghiệp vụ — header chỉ là nhãn, luôn hiện mục con.
const MENU_GROUPS = [
  {
    id: "overview",
    labelVn: "Tổng quan",
    labelEn: "Overview",
    items: [
      { path: "/admin", labelVn: "Dashboard", labelEn: "Dashboard", roles: ["ADMIN", "MANAGER", "STAFF"] },
      { path: "/admin/revenue", labelVn: "Doanh thu", labelEn: "Revenue", roles: ["ADMIN"] },
    ],
  },
  {
    id: "people",
    labelVn: "Nhân sự",
    labelEn: "People",
    items: [
      { path: "/admin/users-management",labelVn: "Khách hàng", labelEn: "Customers", roles: ["ADMIN"] },
      { path: "/admin/managers-management", labelVn: "Quản lí", labelEn: "Managers", roles: ["ADMIN"] },
      {
        path: "/admin/staffs-management",
        labelVn: "Nhân viên",
        labelEn: "Staff",
        labelVnStaff: "Lịch của tôi",
        labelEnStaff: "My schedule",
        roles: ["ADMIN", "MANAGER", "STAFF"],
      },
    ],
  },
  {
    id: "ops",
    labelVn: "Vận hành",
    labelEn: "Operations",
    items: [
      { path: "/admin/trips-management", labelVn: "Chuyến tàu", labelEn: "Trips", roles: ["ADMIN","MANAGER"] },
      { path: "/admin/operations-schedule", labelVn: "Lịch vận hành", labelEn: "Ops schedule", roles: ["ADMIN", "MANAGER", "STAFF"] },
      { path: "/admin/routes-management", labelVn: "Tuyến", labelEn: "Routes", roles: ["ADMIN"] },
      { path: "/admin/stations-management",labelVn: "Nhà ga", labelEn: "Stations", roles: ["ADMIN", "MANAGER"] },
      { path: "/admin/landmarks-management",labelVn: "Landmark thuyết minh", labelEn: "Landmarks", roles: ["ADMIN"] },
      { path: "/admin/boats-management",labelVn: "Tàu", labelEn: "Boats", roles: ["ADMIN"] },
      { path: "/admin/seat-types",labelVn: "Chính sách giá", labelEn: "Fare Policy", roles: ["ADMIN"] },
      { path: "/admin/live-tracking",labelVn: "Theo dõi / Sự cố", labelEn: "Tracking / Incidents", labelVnStaff: "Theo dõi GPS / Sự cố", labelEnStaff: "GPS / Incidents", roles: ["ADMIN", "MANAGER", "STAFF"] },
      { path: "/admin/staff/my-trips",labelVn: "Chuyến của tôi", labelEn: "My trips", roles: ["STAFF"] },
      { path: "/admin/staff/ticket-scan",labelVn: "Quét vé", labelEn: "Ticket scan", roles: ["STAFF"] },
      { path: "/admin/staff/scan-history",labelVn: "Lịch sử quét", labelEn: "Scan history", roles: ["STAFF"] },
    ],
  },
  {
    id: "bookings",
    labelVn: "Đặt chỗ & BH",
    labelEn: "Bookings & Insurance",
    items: [
      { path: "/admin/bookings", labelVn: "Booking vé", labelEn: "Seat bookings", roles: ["ADMIN"] },
      { path: "/admin/charter-bookings-management", labelVn: "Thuê tàu", labelEn: "Request Booking", roles: ["ADMIN"] },
      { path: "/admin/insurance-management", labelVn: "Bảo hiểm", labelEn: "Insurance", roles: ["ADMIN"] },
      { path: "/admin/reviews-management", labelVn: "Đánh giá", labelEn: "Reviews", roles: ["ADMIN"] },
    ],
  },
  {
    id: "content",
    labelVn: "Marketing",
    labelEn: "Marketing",
    items: [
      { path: "/admin/promotions", labelVn: "Khuyến mãi", labelEn: "Promotions", roles: ["ADMIN"] },
      {
        path: "/admin/news",
        labelVn: "Blog / News",
        labelEn: "Blog & Articles",
        labelVnStaff: "Blog / Tin tức",
        labelEnStaff: "Blog / News",
        roles: ["ADMIN"],
      },
      { path: "/admin/ai-data", labelVn: "AI data", labelEn: "AI Data", roles: ["ADMIN"] },
    ],
  },
];

const STAFF_MENU_PATHS = new Set([
  "/admin",
  "/admin/live-tracking",
  "/admin/operations-schedule",
  "/admin/staffs-management",
  "/admin/staff/my-trips",
  "/admin/staff/ticket-scan",
  "/admin/staff/scan-history",
]);

const isPathActive = (currentPath, itemPath) => {
  if (itemPath === "/admin") return currentPath === "/admin";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
};

export const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { lang } = useApp();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const defaultAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin";
  const displayName = user?.fullName || (lang === "VN" ? "Quản trị viên" : "Admin");
  const displayAvatar = user?.avatarUrl || "";
  const primaryRole = user?.roles?.find((role) =>
    ["ADMIN", "MANAGER", "STAFF"].includes(role?.systemName)
  ) || user?.roles?.[0];
  const displayRole = primaryRole?.displayName || primaryRole?.name || (
    lang === "VN" ? "Quản trị viên" : "Admin"
  );
  const stationAssignments = user?.stationAssignments || [];
  const primaryStation = stationAssignments.find((s) => s?.isPrimary) || stationAssignments[0];
  const displayStationName = primaryStation?.stationName || "";
  const extraStationCount = stationAssignments.length > 1 ? stationAssignments.length - 1 : 0;

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadCurrentUser = async () => {
      try {
        const data = await fetchCurrentUserProfile();
        dispatch(updateUserProfile({
          id: String(data.id || data.userId || ""),
          fullName: data.fullName || "",
          avatarUrl: data.avatarUrl || "",
          roles: data.roles || [],
          stationAssignments: data.stationAssignments || [],
        }));
      } catch (error) {
        console.error("Lỗi tải thông tin admin sidebar:", error);
      }
    };

    loadCurrentUser();
  }, [dispatch, isAuthenticated]);

  const staffOnly = isStaffUser(user) && !isAdminUser(user) && !isManagerUser(user);

  const visibleGroups = useMemo(() => (
    MENU_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (staffOnly) return STAFF_MENU_PATHS.has(item.path);
          return !item.roles || hasRole(user, ...item.roles);
        }),
      }))
      .filter((group) => group.items.length > 0)
  ), [staffOnly, user]);

  const getItemLabel = (item) => {
    if (staffOnly && (item.labelVnStaff || item.labelEnStaff)) {
      return lang === "VN"
        ? item.labelVnStaff || item.labelVn
        : item.labelEnStaff || item.labelEn;
    }
    return lang === "VN" ? item.labelVn : item.labelEn;
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-all"
        ></div>
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col w-64 bg-[#124757] dark:bg-slate-900 border-r border-white/10 dark:border-slate-800 pt-16 transform lg:transform-none lg:opacity-100 transition-all duration-300 ${
          isOpen ? "translate-x-0 opacity-100" : "translate-x-0 max-lg:-translate-x-full max-lg:opacity-0"
        }`}
      >
        <div className="p-5 border-b border-white/10 dark:border-slate-800 flex flex-col items-center text-center space-y-3 shrink-0 bg-white/5 select-none">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-dashed border-[#FFD100] flex items-center justify-center text-white shadow-md overflow-hidden transition-transform duration-500 group-hover:rotate-45">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = defaultAvatar;
                  }}
                />
              ) : (
                <span className="material-symbols-outlined text-[32px] fill-1 text-white">account_circle</span>
              )}
            </div>
            <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#124757] dark:border-slate-900"></span>
            </span>
          </div>

          <div className="space-y-0.5">
            <h4 className="font-headline font-black text-sm uppercase tracking-wider text-white">
              {displayName}
            </h4>
            <div className="bg-[#FFD100]/10 border border-[#FFD100]/20 rounded-full px-2.5 py-0.5 w-max mx-auto">
              <span className="text-[10px] font-headline font-black text-[#FFD100] uppercase tracking-widest">
                {displayRole}
              </span>
            </div>
            {displayStationName ? (
              <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-white/60">
                <span className="truncate max-w-44">{displayStationName}</span>
                {extraStationCount > 0 ? ` +${extraStationCount}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-4 p-3 overflow-y-auto no-scrollbar custom-scrollbar">
          {visibleGroups.map((group) => {
            const groupLabel = lang === "VN" ? group.labelVn : group.labelEn;

            return (
              <div key={group.id} className="space-y-1">
                <p className="px-3.5 pb-0.5 text-[10px] font-headline font-black uppercase tracking-[0.14em] text-white/35">
                  {groupLabel}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive = isPathActive(currentPath, item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-headline text-sm font-bold transition-all ${
                          isActive
                            ? "bg-white/10 text-yellow-400 shadow-sm dark:bg-yellow-400/10 dark:text-yellow-400"
                            : "text-white/80 hover:bg-white/5 hover:text-white dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-yellow-400"
                        }`}
                      >
                        <span className="truncate">{getItemLabel(item)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 dark:border-slate-800 shrink-0 bg-white/5 lg:bg-transparent">
          <Link
            to="/login"
            onClick={() => {
              dispatch(logout());
              onClose?.();
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-red-300 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all font-headline text-sm font-bold"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            {lang === "VN" ? "Đăng xuất" : "Sign Out"}
          </Link>
        </div>
      </aside>
    </>
  );
};
