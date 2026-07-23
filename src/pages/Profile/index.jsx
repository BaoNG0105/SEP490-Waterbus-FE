import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../redux/authSlice";
import { fetchCurrentUserProfile } from "../../services/authService";
import { fetchMyPoints, getPointTransactionLabel } from "../../services/pointService";
import { notify } from "../../utils/swalToast";

export const Profile = () => {
  const { lang } = useApp();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [pointsData, setPointsData] = useState({ pointBalance: 0, totalCount: 0, page: 1, pageSize: 20, transactions: [] });
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    dob: "",
    gender: "Male",
    nationality: "Vietnam",
    avatarUrl: "",
    roleName: "Khách hàng"
  });

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoadingProfile(true);
        const data = await fetchCurrentUserProfile();
        setProfileData({
          fullName: data.fullName || "Chưa cập nhật",
          email: data.email || "",
          phoneNumber: data.phoneNumber || "",
          dob: data.dateOfBirth || "",
          gender: data.gender === "Male" ? "Nam" : (data.gender === "Female" ? "Nữ" : "Khác"),
          nationality: data.nationality || "Vietnam",
          avatarUrl: data.avatarUrl || "https://res.cloudinary.com/dygipvoal/image/upload/v1782985383/piwocu1i25ijlua88bn0.webp",
          roleName: data.roles?.[0]?.displayName || "Khách hàng"
        });
      } catch (error) {
        console.error("Lỗi tải Profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    loadProfileData();
  }, []);

  const loadPoints = async (page = 1) => {
    try {
      setIsLoadingPoints(true);
      const data = await fetchMyPoints({ page, pageSize: 20 });
      setPointsData({
        pointBalance: data.pointBalance || 0,
        totalCount: data.totalCount || 0,
        page: data.page || page,
        pageSize: data.pageSize || 20,
        transactions: data.transactions || [],
      });
    } catch (error) {
      console.error("Lỗi tải điểm tích lũy:", error);
    } finally {
      setIsLoadingPoints(false);
    }
  };

  useEffect(() => {
    loadPoints(1);
  }, []);

  const transactionTypeMeta = {
    Earn: { color: "emerald" },
    Redeem: { color: "rose" },
    RedeemCancelled: { color: "amber" },
    RedeemReturned: { color: "sky" },
    EarnRevoked: { color: "slate" },
  };

  const totalPointsPages = Math.max(1, Math.ceil(pointsData.totalCount / pointsData.pageSize));

  const badgeClassMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200",
    rose: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200",
    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200",
    sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200",
    slate: "bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 border-slate-200",
  };

  const handleLogout = () => {
    notify({
      title: lang === "VN" ? "Bạn có chắc chắn muốn đăng xuất?" : "Are you sure you want to log out?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#124757",
      cancelButtonColor: "#d33",
      confirmButtonText: lang === "VN" ? "Đăng xuất" : "Log out",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(logout());
        navigate("/");
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại" : "Back"}
        </button>
      </div>

      {isLoadingProfile ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-4xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700/50 mb-8 animate-fade-in-up">
            <div className="h-40 sm:h-48 bg-[#124757] dark:bg-slate-900 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20 z-10"></div>
              <img src="https://res.cloudinary.com/dygipvoal/image/upload/v1776188850/vpool5lgwmjfocldit1q.png" alt="Cover" className="w-full h-full object-cover opacity-80" />
            </div>

            <div className="px-6 sm:px-10 pb-8 relative">
              <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-16 sm:-mt-20 relative z-20">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                  <div className="w-32 h-32 rounded-4xl border-4 border-white dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-700 shadow-lg shrink-0">
                    <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="pb-2">
                    <h1 className="text-2xl sm:text-3xl font-black font-headline text-white leading-tight">
                      {profileData.fullName}
                    </h1>
                    <p className="text-white  font-medium text-sm mt-1">
                      {profileData.phoneNumber} {profileData.email ? `• ${profileData.email}` : ""}
                    </p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        {lang === "VN" ? "Đã xác thực" : "Verified"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200">
                        {profileData.roleName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto pb-2">
                  <button
                    onClick={() => navigate("/profile/edit")}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-yellow-400 text-slate-900 font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    {lang === "VN" ? "Chỉnh sửa" : "Edit Profile"}
                  </button>
                </div>
              </div>

              {/* Phần Khối Points & Stats giữ nguyên không đổi... */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowPointsModal(true)}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border shadow-inner hover:border-[#124757] dark:hover:border-yellow-400 hover:shadow-md transition-all cursor-pointer"
                >
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{lang === "VN" ? "Điểm tích lũy" : "Reward Points"}</p>
                  <h3 className="text-2xl font-black text-[#124757] dark:text-yellow-400">{pointsData.pointBalance.toLocaleString()}</h3>
                </button>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border shadow-inner">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{lang === "VN" ? "Chuyến đi" : "Total Trips"}</p>
                  <h3 className="text-2xl font-black text-[#124757] dark:text-yellow-400">0</h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border shadow-inner">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{lang === "VN" ? "Voucher hiện có" : "Available Vouchers"}</p>
                  <h3 className="text-2xl font-black text-[#124757] dark:text-yellow-400">0</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-4xl p-6 sm:p-8 shadow-xl border border-slate-100">
                <h2 className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest mb-6">{lang === "VN" ? "Vé & Dịch vụ của tôi" : "My Tickets & Services"}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => navigate("/profile/my-waterbus-booking")} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-[#124757] dark:hover:border-yellow-400 hover:shadow-md transition-all text-left group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Vé Waterbus của tôi" : "My Waterbus Booking"}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                  </button>
                  <button onClick={() => navigate("/profile/my-sightseeing-booking")} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-[#124757] dark:hover:border-yellow-400 hover:shadow-md transition-all text-left group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Vé Sightseeing của tôi" : "My Sightseeing Booking"}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                  </button>
                  <button onClick={() => navigate("/profile/my-charter-booking")} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-[#124757] dark:hover:border-yellow-400 hover:shadow-md transition-all text-left group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Yêu cầu thuê tàu" : "Charter Requests"}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-4xl p-6 sm:p-8 shadow-xl border border-slate-100">
                <h2 className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest mb-6">{lang === "VN" ? "Cài đặt tài khoản" : "Account Settings"}</h2>
                <div className="space-y-3">
                  <button onClick={() => navigate("/profile/change-password")} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Đổi mật khẩu" : "Change Password"}</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-100 transition-all border border-rose-200">
                    <span className="material-symbols-outlined">logout</span>
                    {lang === "VN" ? "Đăng xuất" : "Log out"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showPointsModal && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-4xl overflow-hidden shadow-2xl animate-[fadeIn_0.4s_ease-out]">
            <div className="flex items-center justify-between px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div>
                <h2 className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest">
                  {lang === "VN" ? "Lịch sử điểm tích lũy" : "Points History"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {lang === "VN" ? "Số dư hiện tại: " : "Current balance: "}
                  <span className="font-bold text-[#124757] dark:text-yellow-400">{pointsData.pointBalance.toLocaleString()}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPointsModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-4">
              {isLoadingPoints ? (
                <div className="flex justify-center items-center h-40">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
                </div>
              ) : pointsData.transactions.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-2xl text-slate-400">
                  <p className="text-sm font-bold">{lang === "VN" ? "Chưa có giao dịch điểm nào." : "No point transactions yet."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pointsData.transactions.map((tx) => {
                    const meta = transactionTypeMeta[tx.transactionType] || { color: "slate" };
                    const typeLabel = getPointTransactionLabel(tx.transactionType, lang);
                    return (
                      <div key={tx.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeClassMap[meta.color]}`}>
                              {typeLabel}
                            </span>
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium mt-2">{tx.description}</p>
                            {tx.bookingCode && (
                              <p className="text-xs text-slate-400 mt-1">
                                {lang === "VN" ? "Mã đặt chỗ" : "Booking"}: {tx.bookingCode}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(tx.createdAt).toLocaleString(lang === "VN" ? "vi-VN" : "en-US")}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-lg font-black ${tx.points > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {lang === "VN" ? "Số dư" : "Balance"}: {tx.balanceAfter.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {totalPointsPages > 1 && (
              <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  disabled={pointsData.page <= 1 || isLoadingPoints}
                  onClick={() => loadPoints(pointsData.page - 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  {lang === "VN" ? "Trước" : "Prev"}
                </button>
                <span className="text-xs font-bold text-slate-400">{pointsData.page} / {totalPointsPages}</span>
                <button
                  type="button"
                  disabled={pointsData.page >= totalPointsPages || isLoadingPoints}
                  onClick={() => loadPoints(pointsData.page + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {lang === "VN" ? "Sau" : "Next"}
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
