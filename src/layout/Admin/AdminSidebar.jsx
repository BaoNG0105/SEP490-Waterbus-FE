import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Lấy trạng thái ngôn ngữ từ Context
  const { lang } = useApp();

  // Cấu hình danh sách menu có hỗ trợ đa ngôn ngữ
  const menuItems = [
    {
      path: "/admin",
      icon: "dashboard",
      label: lang === "VN" ? "Dashboard" : "Dashboard",
    },
    {
      path: "/admin/staff",
      icon: "badge",
      label: lang === "VN" ? "Nhân viên" : "Staff",
    },
    {
      path: "/admin/orders",
      icon: "receipt_long",
      label: lang === "VN" ? "Đơn hàng" : "Orders",
    },
    {
      path: "/admin/boats",
      icon: "directions_boat",
      label: lang === "VN" ? "Tàu" : "Boats",
    },
    {
      path: "/admin/customers",
      icon: "groups",
      label: lang === "VN" ? "Khách hàng" : "Customers",
    },
    {
      path: "/admin/revenue",
      icon: "payments",
      label: lang === "VN" ? "Doanh thu" : "Revenue",
    },
    {
      path: "/admin/schedules",
      icon: "calendar_month",
      label: lang === "VN" ? "Lịch trình" : "Schedules",
    },
    {
      path: "/admin/reports",
      icon: "analytics",
      label: lang === "VN" ? "Báo cáo" : "Reports",
    },
    {
      path: "/admin/settings",
      icon: "settings",
      label: lang === "VN" ? "Cài đặt" : "Settings",
    },
  ];

  return (
    <>
      {/* Overlay mờ */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={onClose}
      ></div>

      {/* Drawer trượt */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 w-72 transform transition-transform duration-300 ease-in-out shadow-2xl overflow-y-auto ${isOpen ? "translate-x-0" : "-translate-x-full"} border-r border-transparent dark:border-slate-800`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container dark:bg-yellow-400/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary dark:text-yellow-400">
                admin_panel_settings
              </span>
            </div>
            <div>
              <h2 className="text-base font-headline font-bold text-slate-900 dark:text-white leading-tight">
                {lang === "VN" ? "Quản trị viên" : "Administrator"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-label">
                Manager Role
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-4">
          {menuItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose} // Bấm xong tự đóng menu trên mobile
                className={`flex items-center gap-3 p-3 rounded-xl transition-all font-headline font-bold ${
                  isActive
                    ? "bg-primary-container/20 dark:bg-yellow-400/10 text-primary dark:text-yellow-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-yellow-400"
                }`}
              >
                <span
                  className={`material-symbols-outlined ${isActive ? "" : "text-slate-400 dark:text-slate-500"}`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800">
          <Link
            to="/login"
            className="flex items-center gap-3 p-3 w-full text-error dark:text-red-400 hover:bg-error-container/50 dark:hover:bg-red-500/20 rounded-xl transition-all font-headline font-bold"
          >
            <span className="material-symbols-outlined">logout</span>
            {lang === "VN" ? "Đăng xuất" : "Logout"}
          </Link>
        </div>
      </aside>
    </>
  );
};
