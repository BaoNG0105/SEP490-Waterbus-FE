import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import Swal from "sweetalert2";

// DATA MẪU
const mockUserStats = {
  points: 12840,
};

const mockUpcomingTrips = [
  {
    id: "TICKET-12345",
    boatNumber: "#420",
    from: { vn: "Bến Bạch Đằng", en: "Bach Dang Wharf" },
    to: { vn: "Đảo Thanh Đa", en: "Thanh Da Island" },
    date: "Oct 24, 2026",
    time: "08:45 AM",
    iconColor: "text-primary dark:text-yellow-400",
  },
  {
    id: "TICKET-67890",
    boatNumber: "#246",
    from: { vn: "Bến Thủ Thiêm", en: "Thu Thiem Terminal" },
    to: { vn: "Bến Bạch Đằng", en: "Bach Dang Wharf" },
    date: "Oct 28, 2026",
    time: "05:30 PM",
    iconColor: "text-primary dark:text-yellow-400",
  }
];

// Thêm dữ liệu để test phân trang
const mockBookingHistory = [
  { id: "BK01", date: "Oct 12, 2026", from: "Bạch Đằng", to: "Bình An", amount: "15,000đ", status: "COMPLETED" },
  { id: "BK02", date: "Oct 05, 2026", from: "Thủ Thiêm", to: "Thanh Đa", amount: "30,000đ", status: "COMPLETED" },
  { id: "BK04", date: "Sep 20, 2026", from: "Thanh Đa", to: "Bình An", amount: "15,000đ", status: "CANCELLED" },
  { id: "BK05", date: "Sep 15, 2026", from: "Linh Đông", to: "Bạch Đằng", amount: "15,000đ", status: "COMPLETED" },
  { id: "BK06", date: "Sep 10, 2026", from: "Bình An", to: "Thủ Thiêm", amount: "15,000đ", status: "COMPLETED" },
  { id: "BK08", date: "Aug 25, 2026", from: "Thủ Thiêm", to: "Linh Đông", amount: "15,000đ", status: "COMPLETED" },
];

const STATUS_CONFIG = {
  COMPLETED: { vn: "Thành công", en: "Completed", classes: "bg-green-500/10 text-green-600 dark:text-green-400" },
  CANCELLED: { vn: "Đã hủy", en: "Cancelled", classes: "bg-red-500/10 text-red-600 dark:text-red-400" }
};

export const Profile = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);

  const defaultAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuCJgEa1CJ6nEykaMCLialWDQWttf8sV3FmrwfpNsqm6OO9JzpZ8RcUQ1TWOwuutMrcEIMzEMozSlrOI28PIho2BdBNTFUC6OzHhjFH6UfeVhwuWTTTw3dFZtDn4rSlgsCXg6TGY88SStie6-CNRXxbboKK4EiEwhyYik6ZU2tM5ytXTRHz2M_OPltBXE3K4LGi2qWZoUw6EDd5-C-Uqc-tBO_-Tgj9zqYcTicR6MYKwEvvgdWXOqHahk_6FCxc0FkAqulS6IJiVBEJc";
  const displayAvatar = user?.avatarUrl || defaultAvatar;
  const displayName = user?.fullName || (lang === "VN" ? "Người dùng" : "User");
  const displayRole = user?.roleName || "Customer";

  // STATE: MODAL CẬP NHẬT THÔNG TIN
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    gender: "male",
    dateOfBirth: "",
    address: "",
    phone: user?.phone || "",
    email: user?.email || "",
  });

  const handleOpenEditProfile = () => {
    setIsEditProfileOpen(true);
  };

  const handleProfileDataChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    Swal.fire({
      icon: 'success',
      title: lang === "VN" ? 'Cập nhật thành công!' : 'Profile Updated!',
      background: isDarkMode ? '#1e293b' : '#ffffff',
      color: isDarkMode ? '#ffffff' : '#0f172a',
      timer: 2000,
      showConfirmButton: false
    });
    setIsEditProfileOpen(false);
  };

  // STATE: FORM CẬP NHẬT MẬT KHẨU
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // LOGOUT
  const handleLogout = () => {
    Swal.fire({
      title: lang === "VN" ? "Xác nhận đăng xuất?" : "Confirm Logout?",
      text: lang === "VN" ? "Bạn sẽ cần đăng nhập lại để xem vé." : "You will need to log in again to view tickets.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: lang === "VN" ? "Vâng, Đăng xuất" : "Yes, Sign Out",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      background: isDarkMode ? "#1e293b" : "#ffffff",
      color: isDarkMode ? "#ffffff" : "#0f172a",
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(logout());
        navigate("/login");
      }
    });
  };

  // LOGIC PHÂN TRANG & LỌC DỮ LIỆU
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4; // Số lượng hiển thị mỗi trang

  // Lọc dữ liệu
  const filteredHistory = mockBookingHistory.filter(
    item => filterStatus === "ALL" || item.status === filterStatus
  );

  // Tính toán phân trang
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const inputClasses = "w-full bg-surface-container-low dark:bg-slate-700 border-0 rounded-xl py-3.5 px-5 focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 text-slate-900 dark:text-white font-body outline-none transition-shadow";
  const labelClasses = "block text-xs font-label font-bold text-on-surface-variant dark:text-white/60 uppercase tracking-widest mb-2.5";

  return (
    <main className="pt-32 pb-24 px-6 md:px-12 max-w-screen-2xl mx-auto min-h-screen bg-surface dark:bg-slate-900 transition-colors duration-300 relative">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* CỘT TRÁI: Tổng quan hồ sơ */}
        <aside className="md:col-span-4 space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-surface-variant dark:border-slate-700 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden shadow-xl ring-4 ring-primary-container/20 dark:ring-yellow-400/20 bg-slate-100">
                  <img alt="User Avatar" className="w-full h-full object-cover" src={displayAvatar} />
                </div>
                <button
                  onClick={handleOpenEditProfile}
                  className="absolute bottom-1 right-1 bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-1 font-headline text-slate-900 dark:text-white">{displayName}</h1>
              <p className="text-on-surface-variant dark:text-white/60 font-label text-sm uppercase tracking-widest mb-6 font-bold">{displayRole}</p>
            </div>
          </div>

          <div className="bg-surface-container-highest/50 dark:bg-slate-800 backdrop-blur-md rounded-3xl p-8 border border-outline-variant/15 dark:border-slate-700 shadow-lg">
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/60 mb-2">
                  {lang === "VN" ? "Điểm tích lũy" : "Available Points"}
                </p>
                <h3 className="text-5xl md:text-6xl font-black font-headline bg-gradient-to-br from-primary to-orange-400 dark:from-yellow-300 dark:to-yellow-500 bg-clip-text text-transparent drop-shadow-sm">
                  {mockUserStats.points.toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        </aside>

        {/* CỘT PHẢI: Nội dung chính */}
        <div className="md:col-span-8 space-y-12">

          {/* CHUYẾN ĐI SẮP TỚI */}
          <section>
            <div className="flex items-end justify-between mb-8 px-2">
              <h2 className="text-3xl font-bold tracking-tight font-headline text-slate-900 dark:text-white">
                {lang === "VN" ? "Chuyến đi sắp tới" : "Upcoming Trips"}
              </h2>
              <a className="text-sm font-bold text-primary dark:text-yellow-400 hover:underline cursor-pointer">
                {lang === "VN" ? "Xem tất cả" : "View All"}
              </a>
            </div>

            <div className="space-y-4">
              {mockUpcomingTrips.map((trip) => (
                <div key={trip.id} className="bg-white dark:bg-slate-800 rounded-3xl p-6 flex flex-col lg:flex-row gap-6 items-center shadow-md border border-surface-variant dark:border-slate-700 group hover:shadow-xl transition-all duration-300">
                  <div className="w-32 h-32 bg-slate-100 dark:bg-white p-2 rounded-2xl shadow-inner flex shrink-0 items-center justify-center">
                    <img
                      alt="QR Code Ticket"
                      className="w-full h-full opacity-80 mix-blend-multiply"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${trip.id}`}
                    />
                  </div>
                  <div className="flex-grow text-center lg:text-left">
                    <div className={`flex items-center justify-center lg:justify-start gap-2 mb-2 ${trip.iconColor}`}>
                      <span className="material-symbols-outlined text-sm">sailing</span>
                      <span className="text-xs font-label font-bold uppercase tracking-widest">
                        {lang === "VN" ? `Tàu ${trip.boatNumber}` : `Boat ${trip.boatNumber}`}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 font-headline text-slate-900 dark:text-white">
                      {lang === "VN" ? `${trip.from.vn} → ${trip.to.vn}` : `${trip.from.en} → ${trip.to.en}`}
                    </h3>
                    <div className="flex justify-center lg:justify-start gap-6 text-sm text-on-surface-variant dark:text-white/70 font-label font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">calendar_today</span> {trip.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span> {trip.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* LỊCH SỬ ĐẶT VÉ */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 px-2 gap-4">
              <h2 className="text-3xl font-bold tracking-tight font-headline text-slate-900 dark:text-white">
                {lang === "VN" ? "Lịch sử đặt vé" : "Booking History"}
              </h2>

              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1); // Reset page trực tiếp ngay khi chọn filter mới
                  }} className="appearance-none w-full sm:w-auto bg-surface-container-low dark:bg-slate-700 text-sm font-label font-bold text-slate-700 dark:text-white border-0 rounded-xl px-5 py-3 pr-10 outline-none focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 cursor-pointer transition-shadow"
                >
                  <option value="ALL">{lang === "VN" ? "Tất cả trạng thái" : "All Status"}</option>
                  <option value="COMPLETED">{lang === "VN" ? "Thành công" : "Completed"}</option>
                  <option value="CANCELLED">{lang === "VN" ? "Đã hủy" : "Cancelled"}</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-white/50">
                  expand_more
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-outline-variant/20 dark:border-slate-700 shadow-lg">
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-surface-container-low dark:bg-slate-900/50 border-b border-outline-variant/20 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50">
                        {lang === "VN" ? "Ngày" : "Date"}
                      </th>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50">
                        {lang === "VN" ? "Tuyến đi" : "Route"}
                      </th>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50">
                        {lang === "VN" ? "Số tiền" : "Amount"}
                      </th>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50 text-right">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 dark:divide-slate-700">
                    {currentItems.length > 0 ? (
                      currentItems.map((history) => (
                        <tr key={history.id} className="hover:bg-surface-container-lowest dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 font-label text-sm text-slate-600 dark:text-white/80 whitespace-nowrap">
                            {history.date}
                          </td>
                          <td className="px-6 py-4 font-label text-sm font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              {history.from}
                              <span className="material-symbols-outlined text-[16px] text-slate-400">arrow_forward</span>
                              {history.to}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-label text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                            {history.amount}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider ${STATUS_CONFIG[history.status].classes}`}>
                              {lang === "VN" ? STATUS_CONFIG[history.status].vn : STATUS_CONFIG[history.status].en}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500 dark:text-white/50 font-body">
                          {lang === "VN" ? "Không có dữ liệu phù hợp." : "No records found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PHÂN TRANG (PAGINATION) */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-outline-variant/20 dark:border-slate-700 bg-surface-container-lowest/50 dark:bg-slate-800 flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-white/60 font-body">
                    {lang === "VN" ? `Hiển thị ${indexOfFirstItem + 1} - ${Math.min(indexOfLastItem, filteredHistory.length)} trên tổng số ${filteredHistory.length}` : `Showing ${indexOfFirstItem + 1} to ${Math.min(indexOfLastItem, filteredHistory.length)} of ${filteredHistory.length}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>

                    {[...Array(totalPages)].map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(index + 1)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${currentPage === index + 1
                          ? "bg-primary dark:bg-yellow-400 text-white dark:text-slate-900"
                          : "border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                      >
                        {index + 1}
                      </button>
                    ))}

                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Cài đặt tài khoản */}
          <section>
            <h2 className="text-3xl font-bold tracking-tight mb-8 px-2 font-headline text-slate-900 dark:text-white">
              {lang === "VN" ? "Cài đặt tài khoản" : "Account Settings"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 shadow-md flex flex-col h-full">
                <div className="space-y-5 flex-grow">
                  <div className="relative">
                    <label className={labelClasses}>
                      {lang === "VN" ? "Mật khẩu cũ" : "Current Password"}
                    </label>
                    <div className="relative">
                      <input
                        name="oldPassword"
                        type={showPasswords.old ? "text" : "password"}
                        value={passwords.oldPassword}
                        onChange={handlePasswordChange}
                        className={inputClasses}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("old")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-primary dark:hover:text-yellow-400 transition-colors flex"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPasswords.old ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className={labelClasses}>
                      {lang === "VN" ? "Mật khẩu mới" : "New Password"}
                    </label>
                    <div className="relative">
                      <input
                        name="newPassword"
                        type={showPasswords.new ? "text" : "password"}
                        value={passwords.newPassword}
                        onChange={handlePasswordChange}
                        className={inputClasses}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("new")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-primary dark:hover:text-yellow-400 transition-colors flex"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPasswords.new ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="relative pb-2">
                    <label className={labelClasses}>
                      {lang === "VN" ? "Xác nhận mật khẩu mới" : "Confirm New Password"}
                    </label>
                    <div className="relative">
                      <input
                        name="confirmPassword"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwords.confirmPassword}
                        onChange={handlePasswordChange}
                        className={inputClasses}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("confirm")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-primary dark:hover:text-yellow-400 transition-colors flex"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPasswords.confirm ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <button className="w-full bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 px-6 py-4 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-md mt-6">
                  {lang === "VN" ? "Lưu thay đổi" : "Save Profile Changes"}
                </button>
              </div>

              {/* Đăng xuất */}
              <div className="space-y-6 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 shadow-md flex flex-col justify-between">
                <div>
                  <h4 className="text-xl font-bold mb-3 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Quản lý truy cập" : "Access Management"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70 mb-6 font-body">
                    {lang === "VN" ? "Bạn có thể đăng xuất khỏi thiết bị này hoặc yêu cầu xóa vĩnh viễn tài khoản." : "You can securely sign out or permanently delete your account."}
                  </p>
                </div>
                <div className="space-y-4">
                  <button onClick={handleLogout} className="w-full flex justify-center items-center gap-2 border-2 border-slate-900 dark:border-white text-slate-900 dark:text-white px-6 py-3.5 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    {lang === "VN" ? "Đăng xuất" : "Sign Out"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* MODAL CẬP NHẬT THÔNG TIN */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl animate-[fadeIn_0.3s_ease-out] flex flex-col max-h-[90vh]">

            <div className="px-6 md:px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-xl font-bold font-headline text-slate-900 dark:text-white">
                {lang === "VN" ? "Cập nhật thông tin" : "Update Profile"}
              </h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto no-scrollbar">
              <form id="profileForm" onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Họ và tên */}
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClasses}>{lang === "VN" ? "Họ và tên" : "Full Name"}</label>
                    <input
                      name="fullName"
                      value={profileData.fullName}
                      onChange={handleProfileDataChange}
                      className={inputClasses}
                      required
                    />
                  </div>

                  {/* Giới tính */}
                  <div className="space-y-2">
                    <label className={labelClasses}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
                    <select
                      name="gender"
                      value={profileData.gender}
                      onChange={handleProfileDataChange}
                      className={`${inputClasses} appearance-none cursor-pointer`}
                    >
                      <option value="male">{lang === "VN" ? "Nam" : "Male"}</option>
                      <option value="female">{lang === "VN" ? "Nữ" : "Female"}</option>
                      <option value="other">{lang === "VN" ? "Khác" : "Other"}</option>
                    </select>
                  </div>

                  {/* Ngày sinh */}
                  <div className="space-y-2">
                    <label className={labelClasses}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
                    <input
                      name="dateOfBirth"
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={handleProfileDataChange}
                      className={`${inputClasses} [&::-webkit-calendar-picker-indicator]:dark:invert cursor-pointer`}
                    />
                  </div>

                  {/* Số điện thoại */}
                  <div className="space-y-2">
                    <label className={labelClasses}>{lang === "VN" ? "Số điện thoại" : "Phone Number"}</label>
                    <input
                      name="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={handleProfileDataChange}
                      className={inputClasses}
                      placeholder="+84..."
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className={labelClasses}>Email</label>
                    <input
                      name="email"
                      type="email"
                      value={profileData.email}
                      onChange={handleProfileDataChange}
                      className={inputClasses}
                    />
                  </div>

                  {/* Địa chỉ */}
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClasses}>{lang === "VN" ? "Địa chỉ" : "Address"}</label>
                    <input
                      name="address"
                      type="text"
                      value={profileData.address}
                      onChange={handleProfileDataChange}
                      className={inputClasses}
                    />
                  </div>

                </div>
              </form>
            </div>

            <div className="px-6 md:px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-label"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                form="profileForm"
                type="submit"
                className="px-8 py-2.5 rounded-xl font-bold bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 hover:brightness-110 transition-all shadow-md font-label uppercase tracking-widest text-xs"
              >
                {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
};