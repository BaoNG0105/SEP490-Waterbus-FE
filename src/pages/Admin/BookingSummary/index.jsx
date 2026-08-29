import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getBookingsReport, getWaterbusStationRevenue } from "../../../api/reportApi";
import { WaterbusStationSummaryTable } from "../../../components/WaterbusStationSummaryTable";
import { hasRole } from "../../../utils/roleHelpers";
import { FormSelect } from "../../../components/FormSelect";
import {
  bookingStatusOptions,
  paymentStatusOptions,
  serviceTypeOptions,
  paymentMethodOptions,
  getVisibleStatusOptions,
  getBookingStatusLabel,
  getPaymentStatusLabel,
  getServiceTypeLabel,
  getBookingStatusClass,
  getPaymentStatusClass,
  formatCurrency,
  formatDateTime,
} from "../../../utils/bookingReport";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Tổng hợp Booking — danh sách booking chi tiết, lọc theo trạng thái/dịch vụ/thời gian. */
export const BookingSummary = () => {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = hasRole(user, "ADMIN", "MANAGER");

  const [keywordInput, setKeywordInput] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    bookingStatus: "All",
    paymentStatus: "All",
    serviceType: "All",
    paymentMethod: "All",
    createdFrom: "",
    createdTo: "",
    departureFrom: "",
    departureTo: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("bookings");

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [waterbusData, setWaterbusData] = useState(null);
  const [waterbusLoading, setWaterbusLoading] = useState(true);

  // Debounce ô tìm kiếm để tránh gọi API liên tục khi đang gõ.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.keyword === keywordInput.trim() ? prev : { ...prev, keyword: keywordInput.trim() }));
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const loadReport = useCallback(async () => {
    if (!canAccess) return;
    try {
      setIsLoading(true);
      setErrorMsg("");
      const params = { page, pageSize };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.bookingStatus !== "All") params.bookingStatus = filters.bookingStatus;
      if (filters.paymentStatus !== "All") params.paymentStatus = filters.paymentStatus;
      if (filters.serviceType !== "All") params.serviceType = filters.serviceType;
      if (filters.paymentMethod !== "All") params.paymentMethod = filters.paymentMethod;
      if (filters.createdFrom) params.createdFrom = filters.createdFrom;
      if (filters.createdTo) params.createdTo = filters.createdTo;
      if (filters.departureFrom) params.departureFrom = filters.departureFrom;
      if (filters.departureTo) params.departureTo = filters.departureTo;

      const result = await getBookingsReport(params);
      setData(result);
    } catch (error) {
      console.error("Lỗi tải tổng hợp booking:", error);
      setErrorMsg(
        lang === "VN"
          ? "Không thể tải dữ liệu tổng hợp booking."
          : "Failed to load the booking summary."
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, page, pageSize, filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadWaterbusSummary = useCallback(async () => {
    if (!canAccess) return;
    try {
      setWaterbusLoading(true);
      const params = {};
      const fromDate = filters.departureFrom || filters.createdFrom;
      const toDate = filters.departureTo || filters.createdTo;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (filters.serviceType !== "All") params.serviceType = filters.serviceType;
      setWaterbusData(await getWaterbusStationRevenue(params));
    } catch (error) {
      console.error("Lỗi tải tổng hợp Waterbus theo bến:", error);
      setWaterbusData(null);
    } finally {
      setWaterbusLoading(false);
    }
  }, [canAccess, filters.createdFrom, filters.createdTo, filters.departureFrom, filters.departureTo, filters.serviceType]);

  useEffect(() => {
    loadWaterbusSummary();
  }, [loadWaterbusSummary]);

  const updateFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Đổi dịch vụ sang 1 dịch vụ cụ thể khác "Charter" -> các trạng thái chỉ thuộc Charter
      // (chờ báo giá/đã đặt cọc/hoàn tiền...) không còn hợp lệ, reset về "Tất cả" để tránh lọc sai.
      if (key === "serviceType" && value !== "All" && value !== "Charter") {
        const bookingStatusOpt = bookingStatusOptions.find((o) => o.value === prev.bookingStatus);
        if (bookingStatusOpt?.requestOnly) next.bookingStatus = "All";
        const paymentStatusOpt = paymentStatusOptions.find((o) => o.value === prev.paymentStatus);
        if (paymentStatusOpt?.requestOnly) next.paymentStatus = "All";
      }
      return next;
    });
    setPage(1);
  };

  const visibleBookingStatusOptions = useMemo(
    () => getVisibleStatusOptions(bookingStatusOptions, filters.serviceType),
    [filters.serviceType]
  );
  const visiblePaymentStatusOptions = useMemo(
    () => getVisibleStatusOptions(paymentStatusOptions, filters.serviceType),
    [filters.serviceType]
  );

  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300">lock</span>
        <p className="text-sm font-bold text-slate-400">
          {lang === "VN" ? "Bạn không có quyền truy cập trang này." : "You do not have permission to access this page."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body pb-10 px-1.5 md:px-4 animate-fade-in">

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
          {lang === "VN" ? "Tổng hợp Booking" : "Booking Summary"}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {lang === "VN"
            ? "Tra cứu danh sách booking chi tiết, lọc theo trạng thái, dịch vụ và thời gian."
            : "Browse detailed bookings, filtered by status, service and date range."}
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      {/* BỘ LỌC */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder={lang === "VN" ? "Tìm theo mã booking, tên/SĐT/email khách..." : "Search booking code, contact name/phone/email..."}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Trạng thái booking" : "Booking Status"}</span>
            <FormSelect
              value={filters.bookingStatus}
              onChange={(v) => updateFilter("bookingStatus", v)}
              options={visibleBookingStatusOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Trạng thái thanh toán" : "Payment Status"}</span>
            <FormSelect
              value={filters.paymentStatus}
              onChange={(v) => updateFilter("paymentStatus", v)}
              options={visiblePaymentStatusOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Dịch vụ" : "Service Type"}</span>
            <FormSelect
              value={filters.serviceType}
              onChange={(v) => updateFilter("serviceType", v)}
              options={serviceTypeOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Phương thức TT" : "Payment Method"}</span>
            <FormSelect
              value={filters.paymentMethod}
              onChange={(v) => updateFilter("paymentMethod", v)}
              options={paymentMethodOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Đặt từ ngày" : "Created From"}</span>
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(e) => updateFilter("createdFrom", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Đặt đến ngày" : "Created To"}</span>
            <input
              type="date"
              value={filters.createdTo}
              onChange={(e) => updateFilter("createdTo", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Khởi hành từ" : "Departure From"}</span>
            <input
              type="date"
              value={filters.departureFrom}
              onChange={(e) => updateFilter("departureFrom", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Khởi hành đến" : "Departure To"}</span>
            <input
              type="date"
              value={filters.departureTo}
              onChange={(e) => updateFilter("departureTo", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-sm">
        <button type="button" onClick={() => setActiveTab("bookings")} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-headline font-black uppercase tracking-wide transition-colors ${activeTab === "bookings" ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900" : "text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
          {lang === "VN" ? "Booking" : "Bookings"}
        </button>
        <button type="button" onClick={() => setActiveTab("stations")} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-headline font-black uppercase tracking-wide transition-colors ${activeTab === "stations" ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900" : "text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
          {lang === "VN" ? "Theo bến" : "By station"}
        </button>
      </div>

      {activeTab === "bookings" && <>
        {/* BẢNG DANH SÁCH BOOKING */}
        <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-275">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-6">{lang === "VN" ? "Booking" : "Booking"}</th>
                  <th className="py-4 px-4">{lang === "VN" ? "Khách hàng" : "Customer"}</th>
                  <th className="py-4 px-4">{lang === "VN" ? "Dịch vụ" : "Service"}</th>
                  <th className="py-4 px-4">{lang === "VN" ? "Khởi hành" : "Departure"}</th>
                  <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                  <th className="py-4 px-4 text-right">{lang === "VN" ? "Tổng tiền" : "Total"}</th>
                  <th className="py-4 px-4 text-right">{lang === "VN" ? "Đã thu / Còn lại" : "Paid / Remaining"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-14">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                      {lang === "VN" ? "Không có booking nào." : "No bookings found."}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.bookingId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-slate-800 dark:text-white text-xs tracking-tight">{item.bookingCode}</h4>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{formatDateTime(item.bookedAt)}</span>
                          {item.soldByStaffName && (
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold block">
                              {lang === "VN" ? "Quầy: " : "Counter: "}{item.soldByStaffName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.contactName || "--"}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.contactPhone || "--"}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-45">{item.contactEmail || "--"}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{getServiceTypeLabel(item.serviceType, lang)}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatDateTime(item.departureAt)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-headline font-black uppercase tracking-wide ${getBookingStatusClass(item.bookingStatus)}`}>
                            {getBookingStatusLabel(item.bookingStatus, lang)}
                          </span>
                          <span className={`text-[10px] font-headline font-black uppercase tracking-wide ${getPaymentStatusClass(item.paymentStatus)}`}>
                            {getPaymentStatusLabel(item.paymentStatus, lang)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-white">{formatCurrency(item.totalAmount)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.paidAmount)}</p>
                        <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400">{formatCurrency(item.remainingAmount)}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PHÂN TRANG */}
        <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">
              {lang === "VN"
                ? `Hiển thị ${startIndex}-${endIndex} trong số ${totalCount} kết quả`
                : `Showing ${startIndex}-${endIndex} of ${totalCount} entries`}
            </span>
            <FormSelect
              value={pageSize}
              onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              fullWidth={false}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: `${n}/${lang === "VN" ? "trang" : "page"}` }))}
              className="min-w-35 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${page === 1
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <span className="text-xs font-black font-headline text-[#124757] dark:text-yellow-400 px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${page >= totalPages
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </>}

      {activeTab === "stations" && (
        <WaterbusStationSummaryTable data={waterbusData} isLoading={waterbusLoading} lang={lang} />
      )}

    </div>
  );
};
