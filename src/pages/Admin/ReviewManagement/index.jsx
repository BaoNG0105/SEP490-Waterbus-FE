import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";

import { FormSelect } from "../../../components/FormSelect";
import { fetchAdminReviews, changeReviewStatus, removeAdminReview } from "../../../services/reviewService";
import { StarRatingDisplay } from "../../../components/TripReview";
import { notify } from "../../../utils/swalToast";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const REVIEW_STATUS = { PUBLISHED: "Published", HIDDEN: "Hidden" };

const normalizeReview = (item) => ({
  id: pick(item, ["reviewId", "id"], ""),
  rating: Number(pick(item, ["rating"], 0)),
  comment: pick(item, ["comment"], ""),
  status: pick(item, ["status"], ""),
  createdAt: pick(item, ["createdAt"], ""),
  customerName: pick(item, ["customerName"], "--"),
  customerEmail: pick(item, ["customerEmail"], ""),
  bookingCode: pick(item, ["bookingCode"], ""),
  tripCode: pick(item, ["tripCode"], ""),
  routeName: pick(item, ["routeName"], ""),
  departureTime: pick(item, ["departureTime"], ""),
});

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

export function ReviewManagement() {
  const { lang } = useApp();

  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const params = { page: 1, pageSize: 100 };
      if (statusFilter !== "All") params.status = statusFilter;
      if (ratingFilter !== "All") params.rating = Number(ratingFilter);
      const data = await fetchAdminReviews(params);
      const list = Array.isArray(data) ? data : (data?.items || []);
      setReviews(list.map(normalizeReview));
    } catch (error) {
      console.error("Lỗi khi tải danh sách đánh giá:", error);
      setErrorMsg(
        error.response?.data?.message ||
        (lang === "VN" ? "Không thể tải danh sách đánh giá." : "Failed to load reviews.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, ratingFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, ratingFilter]);

  const stats = useMemo(() => ({
    total: reviews.length,
    published: reviews.filter((r) => r.status === REVIEW_STATUS.PUBLISHED).length,
    hidden: reviews.filter((r) => r.status === REVIEW_STATUS.HIDDEN).length,
    avgRating: reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "--",
  }), [reviews]);

  const filteredReviews = reviews.filter((review) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      review.bookingCode.toLowerCase().includes(term) ||
      review.tripCode.toLowerCase().includes(term) ||
      review.customerName.toLowerCase().includes(term) ||
      review.customerEmail.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE);
  const currentReviews = filteredReviews.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startIndex = filteredReviews.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredReviews.length);

  const getPaginationGroup = () => {
    let pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages = [1, 2, 3, 4, "...", totalPages];
    } else if (currentPage >= totalPages - 2) {
      pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
    }
    return pages;
  };

  const handleChangeStatus = async (review, nextStatus) => {
    const previousStatus = review.status;
    setProcessingId(review.id);
    setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: nextStatus } : r)));

    try {
      await changeReviewStatus(review.id, nextStatus);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: nextStatus === REVIEW_STATUS.PUBLISHED
          ? (lang === "VN" ? "Đã duyệt đánh giá" : "Review published")
          : (lang === "VN" ? "Đã ẩn đánh giá" : "Review hidden"),
        showConfirmButton: false,
        timer: 1600,
      });
    } catch (error) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: previousStatus } : r)));
      notify({
        icon: "error",
        title: lang === "VN" ? "Thất bại" : "Failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái đánh giá." : "Could not update review status."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReview = async (review) => {
    const result = await notify({
      icon: "warning",
      title: lang === "VN" ? "Xóa đánh giá này?" : "Delete this review?",
      text: lang === "VN"
        ? "Đánh giá sẽ bị xóa vĩnh viễn và không thể khôi phục."
        : "This review will be permanently deleted and cannot be restored.",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Xóa đánh giá" : "Delete review",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#124757",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    try {
      setProcessingId(review.id);
      await removeAdminReview(review.id);
      setReviews((prev) => prev.filter((item) => item.id !== review.id));
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã xóa đánh giá" : "Review deleted",
        showConfirmButton: false,
        timer: 1600,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Xóa thất bại" : "Delete failed",
        text: error.response?.status === 404
          ? (lang === "VN" ? "Không tìm thấy đánh giá này." : "Review was not found.")
          : (error.response?.data?.message || (lang === "VN" ? "Không thể xóa đánh giá." : "Could not delete review.")),
        confirmButtonColor: "#124757",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Quản lý đánh giá" : "Review Management"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Các đánh giá của khách hàng về các chuyến đã hoàn thành."
              : "Customer reviews for completed trips."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
          <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã duyệt" : "Published"}</span>
          <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.published}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Chờ duyệt" : "Hidden"}</span>
          <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{stats.hidden}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Điểm trung bình" : "Avg. rating"}</span>
          <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.avgRating}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
        <div className="w-full xl:flex-1 relative flex items-center min-w-0">
          <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            placeholder={lang === "VN" ? "Tìm theo khách hàng, mã booking, mã chuyến..." : "Search by customer, booking code, trip code..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end overflow-visible shrink-0">
          <div className="relative z-20 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Số sao:" : "Rating:"}</span>
            <FormSelect
              value={ratingFilter}
              onChange={setRatingFilter}
              options={[
                { value: "All", label: lang === "VN" ? "Tất cả số sao" : "All ratings" },
                ...[5, 4, 3, 2, 1].map((star) => ({
                  value: String(star),
                  label: lang === "VN" ? `${star} sao` : `${star} star${star > 1 ? "s" : ""}`,
                })),
              ]}
              className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
            <FormSelect
              value={statusFilter}
              onChange={setStatusFilter}
              menuAlign="right"
              options={[
                { value: "All", label: lang === "VN" ? "Tất cả" : "All" },
                { value: REVIEW_STATUS.HIDDEN, label: lang === "VN" ? "Chờ duyệt" : "Hidden" },
                { value: REVIEW_STATUS.PUBLISHED, label: lang === "VN" ? "Đã duyệt" : "Published" },
              ]}
              className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Khách hàng" : "Customer"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Booking / Chuyến" : "Booking / Trip"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Đánh giá" : "Review"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {currentReviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    {lang === "VN" ? "Không có đánh giá nào." : "No reviews found."}
                  </td>
                </tr>
              ) : (
                currentReviews.map((review) => (
                  <tr key={review.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                    <td className="px-6 py-4 align-top">
                      <p className="font-bold text-slate-800 dark:text-white text-sm">{review.customerName}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(review.createdAt)}</p>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200 inline-block">
                        {review.bookingCode}
                      </span>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 mt-1.5">{review.routeName || review.tripCode}</p>
                      <p className="text-[10px] text-slate-400">{formatDateTime(review.departureTime)}</p>
                    </td>

                    <td className="max-w-xs px-4 py-4 align-top">
                      <StarRatingDisplay rating={review.rating} size="text-sm" />
                      {review.comment ? (
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap wrap-break-words">
                          {review.comment}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-center align-middle">
                      <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${review.status === REVIEW_STATUS.PUBLISHED
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                        }`}>
                        {review.status === REVIEW_STATUS.PUBLISHED
                          ? (lang === "VN" ? "Đã duyệt" : "Published")
                          : (lang === "VN" ? "Chờ duyệt" : "Hidden")}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        {review.status !== REVIEW_STATUS.PUBLISHED && (
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(review, REVIEW_STATUS.PUBLISHED)}
                            disabled={processingId === review.id}
                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                            title={lang === "VN" ? "Duyệt (hiện công khai)" : "Publish"}
                          >
                            {processingId === review.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            )}
                          </button>
                        )}
                        {review.status !== REVIEW_STATUS.HIDDEN && (
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(review, REVIEW_STATUS.HIDDEN)}
                            disabled={processingId === review.id}
                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-500 hover:text-white flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                            title={lang === "VN" ? "Ẩn khỏi danh sách công khai" : "Hide"}
                          >
                            {processingId === review.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review)}
                          disabled={processingId === review.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-500 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
                          title={lang === "VN" ? "Xóa đánh giá" : "Delete review"}
                        >
                          {processingId === review.id ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 0 && (
        <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
          <span className="text-xs font-bold text-slate-400">
            {lang === "VN"
              ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredReviews.length} kết quả`
              : `Showing ${startIndex}-${endIndex} of ${filteredReviews.length} entries`}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>

            {getPaginationGroup().map((item, index) => {
              if (item === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${currentPage === item
                    ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {item}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === totalPages
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
