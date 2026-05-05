import { useApp } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import Swal from "sweetalert2";

export const Profile = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);

  // Gán giá trị hiển thị với dữ liệu mặc định
  const defaultAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCJgEa1CJ6nEykaMCLialWDQWttf8sV3FmrwfpNsqm6OO9JzpZ8RcUQ1TWOwuutMrcEIMzEMozSlrOI28PIho2BdBNTFUC6OzHhjFH6UfeVhwuWTTTw3dFZtDn4rSlgsCXg6TGY88SStie6-CNRXxbboKK4EiEwhyYik6ZU2tM5ytXTRHz2M_OPltBXE3K4LGi2qWZoUw6EDd5-C-Uqc-tBO_-Tgj9zqYcTicR6MYKwEvvgdWXOqHahk_6FCxc0FkAqulS6IJiVBEJc";
  const displayAvatar = user?.avatarUrl || defaultAvatar;
  const displayName = user?.fullName || (lang === "VN" ? "Người dùng" : "User");
  const displayRole = user?.roleName || "Customer";

  // Hàm Logout
  const handleLogout = () => {
    Swal.fire({
      title: lang === "VN" ? "Xác nhận đăng xuất?" : "Confirm Logout?",
      text:
        lang === "VN"
          ? "Bạn sẽ cần đăng nhập lại để xem vé."
          : "You will need to log in again to view tickets.",
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

  // Hàm xóa tài khoản
  // const handleDeleteAccount = () => {
  //   Swal.fire({
  //     title: lang === "VN" ? "Bạn có chắc chắn muốn xóa?" : "Are you absolutely sure?",
  //     text: lang === "VN"
  //           ? "Hành động này KHÔNG THỂ hoàn tác. Toàn bộ dữ liệu, điểm thưởng và vé của bạn sẽ bị xóa vĩnh viễn."
  //           : "This action CANNOT be undone. All your data, loyalty points, and tickets will be permanently deleted.",
  //     icon: "error", // Icon cảnh báo lỗi (đỏ)
  //     showCancelButton: true,
  //     confirmButtonColor: "#d33", // Nút Confirm màu đỏ nổi bật tính nguy hiểm
  //     cancelButtonColor: isDarkMode ? "#334155" : "#94a3b8", // Màu xám cho nút Cancel
  //     confirmButtonText: lang === "VN" ? "XÓA TÀI KHOẢN" : "DELETE ACCOUNT",
  //     cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
  //     background: isDarkMode ? '#1e293b' : '#ffffff',
  //     color: isDarkMode ? '#ffffff' : '#0f172a',
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       // Tương lai: Thêm logic gọi API xóa tài khoản ở đây
  //       // ... await api.delete('/user/...')

  //       Swal.fire({
  //          title: "Deleted!",
  //          text: lang === "VN" ? "Tài khoản của bạn đã được đưa vào danh sách chờ xóa." : "Your account has been queued for deletion.",
  //          icon: "success",
  //          background: isDarkMode ? '#1e293b' : '#ffffff',
  //          color: isDarkMode ? '#ffffff' : '#0f172a',
  //       }).then(() => {
  //          // Sau khi báo xóa thành công thì đăng xuất luôn
  //          dispatch(logout());
  //          navigate("/login");
  //       });
  //     }
  //   });
  // };

  return (
    <main className="pt-32 pb-24 px-6 md:px-12 max-w-screen-2xl mx-auto min-h-screen bg-surface dark:bg-slate-900 transition-colors duration-300">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* CỘT TRÁI: Tổng quan hồ sơ (Profile Overview) */}
        <aside className="md:col-span-4 space-y-8">
          {/* Thẻ định danh người dùng */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-surface-variant dark:border-slate-700 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden shadow-xl ring-4 ring-primary-container/20 dark:ring-yellow-400/20 bg-slate-100">
                  {/* ẢNH ĐẠI DIỆN DYNAMIC TỪ REDUX */}
                  <img
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                    src={displayAvatar}
                  />
                </div>
                <button className="absolute bottom-1 right-1 bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-sm">
                    edit
                  </span>
                </button>
              </div>

              {/* TÊN DYNAMIC TỪ REDUX */}
              <h1 className="text-3xl font-bold tracking-tight mb-1 font-headline text-slate-900 dark:text-white">
                {displayName}
              </h1>

              {/* ROLE DYNAMIC TỪ REDUX */}
              <p className="text-on-surface-variant dark:text-white/60 font-label text-sm uppercase tracking-widest mb-6 font-bold">
                {displayRole}
              </p>

              {/* Thanh tiến trình XP */}
              <div className="w-full bg-surface-container dark:bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
                <div className="liquid-gradient dark:bg-yellow-400 h-2 rounded-full w-[75%]"></div>
              </div>
              <div className="flex justify-between w-full text-[10px] font-label font-bold text-on-surface-variant dark:text-white/50 uppercase tracking-tighter">
                <span>
                  {lang === "VN"
                    ? "2,450 / 3,000 XP đến hạng Bạch Kim"
                    : "2,450 / 3,000 XP to Platinum"}
                </span>
              </div>
            </div>
          </div>

          {/* Điểm thưởng & Thành tựu (Loyalty Points / Rewards) */}
          <div className="bg-surface-container-highest/50 dark:bg-slate-800 backdrop-blur-md rounded-3xl p-8 border border-outline-variant/15 dark:border-slate-700 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/60 mb-1">
                  {lang === "VN" ? "Điểm tích lũy" : "Available Points"}
                </p>
                <h3 className="text-4xl font-bold font-headline text-primary dark:text-yellow-400">
                  12,840
                </h3>
              </div>
              <div className="p-3 bg-primary-container dark:bg-yellow-400/20 rounded-xl text-on-primary-container dark:text-yellow-400">
                <span className="material-symbols-outlined">stars</span>
              </div>
            </div>

            <button className="w-full py-4 bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 rounded-full font-label font-bold text-sm tracking-wide hover:scale-105 transition-transform shadow-md">
              {lang === "VN" ? "ĐỔI VÉ MIỄN PHÍ" : "REDEEM FOR TICKETS"}
            </button>

            <div className="mt-6 pt-6 border-t border-outline-variant/20 dark:border-slate-700">
              <div className="flex items-center gap-4 group cursor-pointer">
                <div className="p-2 bg-green-500/20 rounded-lg text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined">eco</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-headline">
                    {lang === "VN"
                      ? "Huy hiệu Du khách Xanh"
                      : "Eco-Traveler Badge"}
                  </p>
                  <p className="text-xs text-on-surface-variant dark:text-white/60 font-body">
                    {lang === "VN"
                      ? "Tiết kiệm 45kg CO2 tháng này"
                      : "Saved 45kg CO2 this month"}
                  </p>
                </div>
                <span className="material-symbols-outlined ml-auto text-on-surface-variant dark:text-white/50 group-hover:translate-x-1 transition-transform">
                  chevron_right
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* CỘT PHẢI: Nội dung chính (Main Content Area) */}
        <div className="md:col-span-8 space-y-12">
          {/* Chuyến đi sắp tới (Upcoming Trips) */}
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
              {/* Ticket Card 1 */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 flex flex-col lg:flex-row gap-6 items-center shadow-md border border-surface-variant dark:border-slate-700 group hover:shadow-xl transition-all duration-300">
                <div className="w-32 h-32 bg-slate-100 dark:bg-white p-2 rounded-2xl shadow-inner flex shrink-0 items-center justify-center">
                  <img
                    alt="QR Code Ticket"
                    className="w-full h-full opacity-80 mix-blend-multiply"
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TICKET-12345"
                  />
                </div>
                <div className="flex-grow text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-primary dark:text-yellow-400 mb-2">
                    <span className="material-symbols-outlined text-sm">
                      sailing
                    </span>
                    <span className="text-xs font-label font-bold uppercase tracking-widest">
                      {lang === "VN"
                        ? "Tuyến Cao Tốc • Tàu #42"
                        : "Express Route • Boat #42"}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-headline text-slate-900 dark:text-white">
                    {lang === "VN"
                      ? "Bến Bạch Đằng → Đảo Thanh Đa"
                      : "Bach Dang Wharf → Thanh Da Island"}
                  </h3>
                  <div className="flex justify-center lg:justify-start gap-6 text-sm text-on-surface-variant dark:text-white/70 font-label font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        calendar_today
                      </span>{" "}
                      Oct 24, 2026
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        schedule
                      </span>{" "}
                      08:45 AM
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center lg:items-end gap-3 w-full lg:w-auto mt-4 lg:mt-0 border-t lg:border-t-0 lg:border-l border-surface-variant dark:border-slate-700 pt-4 lg:pt-0 lg:pl-6">
                  <span className="bg-primary-container dark:bg-yellow-400/20 text-on-primary-container dark:text-yellow-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-center w-full lg:w-auto">
                    {lang === "VN" ? "Ghế Thương Gia" : "Premium Seat"}
                  </span>
                  <button className="hidden lg:block p-2 hover:bg-surface-container dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              </div>

              {/* Ticket Card 2 */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 flex flex-col lg:flex-row gap-6 items-center shadow-md border border-surface-variant dark:border-slate-700 group hover:shadow-xl transition-all duration-300">
                <div className="w-32 h-32 bg-slate-100 dark:bg-white p-2 rounded-2xl shadow-inner flex shrink-0 items-center justify-center">
                  <img
                    alt="QR Code Ticket"
                    className="w-full h-full opacity-80 mix-blend-multiply"
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TICKET-67890"
                  />
                </div>
                <div className="flex-grow text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-blue-500 dark:text-blue-400 mb-2">
                    <span className="material-symbols-outlined text-sm">
                      sailing
                    </span>
                    <span className="text-xs font-label font-bold uppercase tracking-widest">
                      {lang === "VN"
                        ? "Tuyến Ngắm Cảnh • Tàu #09"
                        : "Sunset Cruise • Boat #09"}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-headline text-slate-900 dark:text-white">
                    {lang === "VN"
                      ? "Bến Thủ Thiêm → Bến Bạch Đằng"
                      : "Thu Thiem Terminal → Bach Dang Wharf"}
                  </h3>
                  <div className="flex justify-center lg:justify-start gap-6 text-sm text-on-surface-variant dark:text-white/70 font-label font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        calendar_today
                      </span>{" "}
                      Oct 28, 2026
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        schedule
                      </span>{" "}
                      05:30 PM
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center lg:items-end gap-3 w-full lg:w-auto mt-4 lg:mt-0 border-t lg:border-t-0 lg:border-l border-surface-variant dark:border-slate-700 pt-4 lg:pt-0 lg:pl-6">
                  <span className="bg-surface-container-high dark:bg-slate-700 text-on-surface-variant dark:text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-center w-full lg:w-auto">
                    {lang === "VN" ? "Ghế Phổ Thông" : "Standard"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Lịch sử đặt vé (Booking History) */}
          <section>
            <h2 className="text-3xl font-bold tracking-tight mb-8 px-2 font-headline text-slate-900 dark:text-white">
              {lang === "VN" ? "Lịch sử đặt vé" : "Booking History"}
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-outline-variant/20 dark:border-slate-700 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-600px">
                  <thead className="bg-surface-container-low dark:bg-slate-900/50 border-b border-outline-variant/20 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50">
                        {lang === "VN" ? "Ngày" : "Date"}
                      </th>
                      <th className="px-6 py-5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant dark:text-white/50">
                        {lang === "VN" ? "Điểm đến" : "Destination"}
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
                    <tr className="hover:bg-surface-container-lowest dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-label text-sm text-slate-600 dark:text-white/80">
                        Oct 12, 2026
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-bold text-slate-900 dark:text-white">
                        Bến Bình An
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-medium text-slate-900 dark:text-white">
                        15,000đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[10px] font-bold px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg uppercase tracking-wider">
                          {lang === "VN" ? "Thành công" : "Completed"}
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-lowest dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-label text-sm text-slate-600 dark:text-white/80">
                        Oct 05, 2026
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-bold text-slate-900 dark:text-white">
                        Bến Thanh Đa
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-medium text-slate-900 dark:text-white">
                        15,000đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[10px] font-bold px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg uppercase tracking-wider">
                          {lang === "VN" ? "Thành công" : "Completed"}
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-lowest dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-label text-sm text-slate-600 dark:text-white/80">
                        Sep 28, 2026
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-bold text-slate-900 dark:text-white">
                        Bến Linh Đông
                      </td>
                      <td className="px-6 py-4 font-label text-sm font-medium text-slate-900 dark:text-white">
                        15,000đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[10px] font-bold px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg uppercase tracking-wider">
                          {lang === "VN" ? "Đã hoàn tiền" : "Refunded"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Cài đặt tài khoản (Account Settings) */}
          <section>
            <h2 className="text-3xl font-bold tracking-tight mb-8 px-2 font-headline text-slate-900 dark:text-white">
              {lang === "VN" ? "Cài đặt tài khoản" : "Account Settings"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cập nhật mật khẩu / Thông tin */}
              <div className="space-y-6 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 shadow-md">
                <div>
                  <label className="block text-xs font-label font-bold text-on-surface-variant dark:text-white/60 uppercase tracking-widest mb-3">
                    {lang === "VN" ? "Địa chỉ Email" : "Email Address"}
                  </label>
                  <input
                    className="w-full bg-surface-container-low dark:bg-slate-700 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 text-slate-900 dark:text-white font-body outline-none transition-shadow"
                    type="email"
                    defaultValue="khoa.nguyen@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-label font-bold text-on-surface-variant dark:text-white/60 uppercase tracking-widest mb-3">
                    {lang === "VN" ? "Mật khẩu mới" : "New Password"}
                  </label>
                  <input
                    className="w-full bg-surface-container-low dark:bg-slate-700 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 text-slate-900 dark:text-white font-body outline-none transition-shadow"
                    type="password"
                    placeholder="••••••••••••"
                  />
                </div>
                <button className="w-full bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 px-6 py-4 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-md">
                  {lang === "VN" ? "Lưu thay đổi" : "Save Profile Changes"}
                </button>
              </div>

              {/* Danger Zone (Đăng xuất & Xóa tài khoản) */}
              <div className="space-y-6 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">
                      manage_accounts
                    </span>
                  </div>
                  <h4 className="text-xl font-bold mb-3 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Quản lý truy cập" : "Access Management"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70 mb-6 font-body">
                    {lang === "VN"
                      ? "Bạn có thể đăng xuất khỏi thiết bị này hoặc yêu cầu xóa vĩnh viễn tài khoản và dữ liệu cá nhân."
                      : "You can securely sign out of this device or permanently delete your account and data."}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Nút Đăng xuất */}
                  <button
                    onClick={handleLogout} // Đã liên kết hàm mới
                    className="w-full flex justify-center items-center gap-2 border-2 border-slate-900 dark:border-white text-slate-900 dark:text-white px-6 py-3.5 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      logout
                    </span>
                    {lang === "VN" ? "Đăng xuất" : "Sign Out"}
                  </button>

                  {/* Nút Xóa tài khoản */}
                  {/* <button 
                    onClick={handleDeleteAccount} // Gắn hàm xác nhận xóa
                    className="w-full flex justify-center items-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 px-6 py-3.5 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white dark:hover:bg-red-500 dark:hover:text-slate-900 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete_forever
                    </span>
                    {lang === "VN" ? "Xóa tài khoản" : "Delete Account"}
                  </button> */}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
