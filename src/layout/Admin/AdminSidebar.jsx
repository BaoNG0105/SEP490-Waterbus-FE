import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useApp } from "../../context/AppContext";
import { fetchCurrentUserProfile } from "../../services/authService";
import { hasRole } from "../../utils/roleHelpers";
import { logout, updateUserProfile } from "../../redux/authSlice";

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
        }));
      } catch (error) {
        console.error("Lỗi tải thông tin admin sidebar:", error);
      }
    };

    loadCurrentUser();
  }, [dispatch, isAuthenticated]);

  // MẢNG DỮ LIỆU ĐỊNH NGHĨA 16 DANH MỤC QUẢN TRỊ NGHIỆP VỤ
  const menuItems = [
    { path: "/admin", icon: "dashboard", labelVn: "Dashboard", labelEn: "Dashboard", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/admin/revenue", icon: "payments", labelVn: "Doanh thu", labelEn: "Revenue", roles: ["ADMIN"] },
    { path: "/admin/staff-management", icon: "badge", labelVn: "Quản lý nhân viên", labelEn: "Staff Management", roles: ["ADMIN"] },
    { path: "/admin/customers-management", icon: "groups", labelVn: "Quản lý KH", labelEn: "Customer Management", roles: ["ADMIN"] },
    { path: "/admin/ticketing", icon: "local_activity", labelVn: "Bán vé", labelEn: "Ticket Sales", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/admin/charter-bookings-management", icon: "directions_boat", labelVn: "Quản lý thuê tàu", labelEn: "Charter Booking Management", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/admin/orders", icon: "receipt_long", labelVn: "Quản lý order", labelEn: "Order Management", roles: ["ADMIN"] },
    { path: "/admin/stations-management", icon: "storefront", labelVn: "Quản lý nhà ga", labelEn: "Wharf Station", roles: ["ADMIN", "MANAGER"] },
    { path: "/admin/boats-management", icon: "directions_boat", labelVn: "Quản lý tàu", labelEn: "Boat Fleet", roles: ["ADMIN", "MANAGER"] },
    { path: "/admin/schedules", icon: "calendar_month", labelVn: "Quản lý lịch trình", labelEn: "Trip Schedules", roles: ["ADMIN"] },
    { path: "/admin/routes", icon: "alt_route", labelVn: "Quản lý tuyển", labelEn: "Route Networks", roles: ["ADMIN"] },
    { path: "/admin/promotions", icon: "local_offer", labelVn: "Quản lý khuyến mãi", labelEn: "Promotions & Deals", roles: ["ADMIN"] },
    { path: "/admin/news", icon: "feed", labelVn: "Quản lý Blog/News", labelEn: "Blog & Articles", roles: ["ADMIN"] },
    { path: "/admin/cskh", icon: "support_agent", labelVn: "CSKH", labelEn: "Customer Support", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/admin/ai-data", icon: "database", labelVn: "Quản lý AI data", labelEn: "AI Data Context", roles: ["ADMIN"] },
  ];
  const visibleMenuItems = menuItems.filter((item) => !item.roles || hasRole(user, ...item.roles));

  return (
    <>
      {/* Lớp nền mờ khi mở sidebar trên thiết bị di động */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-all"
        ></div>
      )}

      {/* KHỐI SIDEBAR CHÍNH - LIGHT MODE NỀN XANH #124757 */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col w-64 bg-[#124757] dark:bg-slate-900 border-r border-white/10 dark:border-slate-800 pt-16 transform lg:transform-none lg:opacity-100 transition-all duration-300 ${
          isOpen ? "translate-x-0 opacity-100" : "translate-x-0 max-lg:-translate-x-full max-lg:opacity-0"
        }`}
      >
        
        {/* --- KHỐI THÔNG TIN USER TÀI KHOẢN --- */}
        <div className="p-5 border-b border-white/10 dark:border-slate-800 flex flex-col items-center text-center space-y-3 shrink-0 bg-white/5 select-none">
          {/* Vòng tròn Avatar chứa Icon Người dùng */}
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
            {/* Chấm xanh lá nhấp nháy báo hiệu trạng thái Live */}
            <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#124757] dark:border-slate-900"></span>
            </span>
          </div>

          {/* Tên và role */}
          <div className="space-y-0.5">
            <h4 className="font-headline font-black text-sm uppercase tracking-wider text-white">
              {displayName}
            </h4>
            <div className="bg-[#FFD100]/10 border border-[#FFD100]/20 rounded-full px-2.5 py-0.5 w-max mx-auto">
              <span className="text-[10px] font-headline font-black text-[#FFD100] uppercase tracking-widest">
                {displayRole}
              </span>
            </div>
          </div>
        </div>

        {/* Khối Danh mục menu */}
        <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto no-scrollbar custom-scrollbar">
          {visibleMenuItems.map((item) => {
            const isActive = currentPath === item.path;
            const label = lang === "VN" ? item.labelVn : item.labelEn;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-headline text-sm font-bold ${
                  isActive
                    ? "bg-white/10 text-yellow-400 dark:bg-yellow-400/10 dark:text-yellow-400 shadow-sm"
                    : "text-white/80 hover:bg-white/5 hover:text-white dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-yellow-400"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] transition-colors ${
                    isActive ? "text-yellow-400" : "text-white/40 dark:text-slate-500"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Chân Sidebar: Nút Đăng xuất tài khoản */}
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
