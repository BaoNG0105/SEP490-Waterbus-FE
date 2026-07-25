import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchSeatTypes, isDistanceFareSeatType, saveSeatTypeBasePrice } from "../../../services/seatTypeService";
import {
  fetchEffectiveFareAdjustment,
  fetchFareAdjustments,
  fetchFarePolicy,
  saveCalendarDayAdjustment,
  saveFarePolicy,
  saveWeekendAdjustment,
} from "../../../services/farePolicyService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getTodayDateString } from "../../../utils/dateOnly";
import { notify } from "../../../utils/swalToast";

const TABS = [
  { id: "seats", vn: "Giá loại ghế", en: "Seat types" },
  { id: "distance", vn: "Giá theo km", en: "Distance fare" },
  { id: "surcharge", vn: "Phụ thu", en: "Surcharges" },
];

const ROUNDING_DISPLAY = 1000;

const formatVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
};

const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white";
const labelStyle = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400";

function SeatTypesTab({ lang, onGoToDistanceTab }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      setRows(await fetchSeatTypes());
    } catch (error) {
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được danh sách loại ghế." : "Failed to load seat types.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) => row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const startEdit = (row) => {
    if (isDistanceFareSeatType(row) || row.priceEditable === false) {
      notify({
        icon: "info",
        title: lang === "VN" ? "STANDARD theo km" : "STANDARD is distance-based",
        text: lang === "VN"
          ? "STANDARD dùng pricingMode=DistanceFareForRegular. Chỉnh ở tab Giá theo km (/api/fare-policy)."
          : "STANDARD uses DistanceFareForRegular. Edit the Distance fare tab (/api/fare-policy).",
      });
      return;
    }
    setEditingCode(row.code);
    setDraftPrice(String(row.basePrice ?? 0));
  };

  const cancelEdit = () => {
    setEditingCode("");
    setDraftPrice("");
  };

  const handleSave = async (code) => {
    const price = Number(draftPrice);
    if (!Number.isFinite(price) || price <= 0) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giá không hợp lệ" : "Invalid price",
        text: lang === "VN" ? "basePrice phải > 0." : "basePrice must be > 0.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await saveSeatTypeBasePrice(code, price);
      setRows((prev) =>
        prev.map((row) => (row.code === code
          ? { ...row, basePrice: updated.basePrice ?? price, name: updated.name || row.name }
          : row)),
      );
      cancelEdit();
      notify({
        icon: "success",
        title: lang === "VN" ? "Đã lưu giá gốc" : "Base price saved",
        text: `${code}: ${formatVnd(price)}`,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không lưu được" : "Save failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Thử lại sau." : "Please try again."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700 sm:px-5">
          <div className="relative min-w-48 flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "VN" ? "Tìm loại ghế…" : "Search seat type…"}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>refresh</span>
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757]" />
            <p className="text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-xs font-medium text-slate-400">
            {lang === "VN" ? "Không có loại ghế." : "No seat types found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                  <th className="px-5 py-3">{lang === "VN" ? "Mã" : "Code"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Tên" : "Name"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Giá gốc" : "Base price"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Hành động" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-700/60">
                {filtered.map((row) => {
                  const editing = editingCode === row.code;
                  const locked = isDistanceFareSeatType(row) || row.priceEditable === false;
                  return (
                    <tr key={row.code} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30">
                      <td className="px-5 py-3.5">
                        <span className="rounded-lg bg-[#124757]/8 px-2 py-1 font-headline text-[11px] font-black text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-200">{row.name}</td>
                      <td className="px-4 py-3.5">
                        {editing ? (
                          <input
                            type="number"
                            min={1}
                            step={1000}
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(e.target.value)}
                            className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black tabular-nums outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            autoFocus
                          />
                        ) : locked ? (
                          <span className="text-[11px] font-bold text-slate-400">
                            {lang === "VN" ? "Theo km" : "Per km"}
                          </span>
                        ) : (
                          <span className="font-black tabular-nums text-slate-800 dark:text-slate-100">
                            {formatVnd(row.basePrice)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {editing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSave(row.code)}
                              className="rounded-lg bg-[#124757] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
                            >
                              {lang === "VN" ? "Lưu" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={cancelEdit}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-600"
                            >
                              {lang === "VN" ? "Hủy" : "Cancel"}
                            </button>
                          </div>
                        ) : locked ? (
                          <button
                            type="button"
                            onClick={onGoToDistanceTab}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:border-[#124757]/30 hover:text-[#124757] dark:border-slate-600 dark:hover:text-yellow-400"
                            title={lang === "VN" ? "Chỉnh ở tab Giá theo km" : "Edit in Distance fare tab"}
                          >
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            {lang === "VN" ? "Chỉnh giá theo km" : "Edit distance fare"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-[#124757]/30 hover:text-[#124757] dark:border-slate-600"
                            title={lang === "VN" ? "Sửa giá gốc" : "Edit base price"}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DistanceFareTab({ lang }) {
  const [form, setForm] = useState({
    baseFare: 5000,
    pricePerKm: 1500,
    minFare: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const policy = await fetchFarePolicy();
      setForm({
        baseFare: policy.baseFare,
        pricePerKm: policy.pricePerKm,
        minFare: policy.minFare == null ? "" : policy.minFare,
      });
    } catch (error) {
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được công thức giá." : "Failed to load fare policy.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const saved = await saveFarePolicy(form);
      setForm({
        baseFare: saved.baseFare,
        pricePerKm: saved.pricePerKm,
        minFare: saved.minFare == null ? "" : saved.minFare,
      });
      notify({
        icon: "success",
        title: lang === "VN" ? "Đã lưu công thức giá" : "Fare policy saved",
        text: lang === "VN"
          ? "Áp dụng cho booking Regular tạo sau khi chỉnh."
          : "Applies to Regular bookings created after this change.",
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không lưu được" : "Save failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Thử lại sau." : "Please try again."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {lang === "VN"
          ? "Giá ghế STANDARD: Giá cơ bản + Giá theo km/km, làm tròn lên 1.000đ, giá tối thiểu nếu có."
          : "Seat price of STANDARD: Base fare + Price per Km/km, round up to 1,000 VND, at least minimum fare if set."}
      </p>

      {errorMsg ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6"
      >
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giá cơ bản" : "Base fare"}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={form.baseFare}
                  onChange={(e) => setForm((prev) => ({ ...prev, baseFare: e.target.value }))}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giá / km" : "Price per km"}</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  required
                  value={form.pricePerKm}
                  onChange={(e) => setForm((prev) => ({ ...prev, pricePerKm: e.target.value }))}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giá tối thiểu" : "Minimum fare"}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={form.minFare}
                  onChange={(e) => setForm((prev) => ({ ...prev, minFare: e.target.value }))}
                  placeholder={lang === "VN" ? "Để trống = không bắt buộc" : "Blank = no minimum"}
                  className={inputStyle}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
              >
                {isSaving
                  ? (lang === "VN" ? "Đang lưu…" : "Saving…")
                  : (lang === "VN" ? "Lưu công thức" : "Save policy")}
              </button>
              <button
                type="button"
                onClick={load}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-600"
              >
                {lang === "VN" ? "Tải lại" : "Refresh"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function SurchargeTab({ lang }) {
  const [adjustments, setAdjustments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiMissing, setApiMissing] = useState(false);

  const [weekend, setWeekend] = useState({
    surchargePercent: 20,
    isActive: true,
  });
  const [holiday, setHoliday] = useState({
    date: "",
    scope: "Holiday",
    name: "",
    surchargePercent: 50,
    isActive: true,
  });
  const [effectiveDate, setEffectiveDate] = useState(getTodayDateString());
  const [effective, setEffective] = useState(null);
  const [savingWeekend, setSavingWeekend] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [checkingEffective, setCheckingEffective] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const list = await fetchFareAdjustments();
      setAdjustments(list);
      setApiMissing(false);
      const weekendRow = list.find((row) => String(row.scope).toLowerCase() === "weekend" && !row.date);
      if (weekendRow) {
        setWeekend({
          surchargePercent: weekendRow.surchargePercent,
          isActive: weekendRow.isActive !== false,
        });
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        setApiMissing(true);
        setAdjustments([]);
        setErrorMsg("");
      } else {
        setErrorMsg(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được danh sách phụ thu." : "Failed to load surcharges.",
          ),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleSaveWeekend = async (e) => {
    e.preventDefault();
    setSavingWeekend(true);
    try {
      await saveWeekendAdjustment(weekend);
      notify({
        icon: "success",
        title: lang === "VN" ? "Đã lưu phụ thu cuối tuần" : "Weekend surcharge saved",
      });
      await load();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không lưu được" : "Save failed",
        text: getApiErrorMessage(
          error,
          error?.response?.status === 404
            ? (lang === "VN" ? "BE chưa mở API phụ thu cuối tuần." : "Weekend surcharge API is not available yet.")
            : (lang === "VN" ? "Thử lại sau." : "Please try again."),
        ),
      });
    } finally {
      setSavingWeekend(false);
    }
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holiday.date) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu ngày" : "Missing date",
      });
      return;
    }
    setSavingHoliday(true);
    try {
      await saveCalendarDayAdjustment(holiday);
      notify({
        icon: "success",
        title: lang === "VN" ? "Đã lưu ngày đặc biệt" : "Special day saved",
        text: holiday.name || holiday.date,
      });
      setHoliday((prev) => ({ ...prev, date: "", name: "" }));
      await load();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không lưu được" : "Save failed",
        text: getApiErrorMessage(
          error,
          error?.response?.status === 404
            ? (lang === "VN" ? "BE chưa mở API ngày đặc biệt." : "Calendar-day API is not available yet.")
            : (lang === "VN" ? "Thử lại sau." : "Please try again."),
        ),
      });
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleCheckEffective = async () => {
    if (!effectiveDate) return;
    setCheckingEffective(true);
    try {
      const result = await fetchEffectiveFareAdjustment(effectiveDate);
      setEffective(result);
      if (!result) {
        notify({
          icon: "info",
          title: lang === "VN" ? "Không có phụ thu" : "No surcharge",
          text: effectiveDate,
        });
      }
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không kiểm tra được" : "Check failed",
        text: getApiErrorMessage(
          error,
          error?.response?.status === 404
            ? (lang === "VN" ? "BE chưa mở API effective." : "Effective surcharge API is not available yet.")
            : (lang === "VN" ? "Thử lại sau." : "Please try again."),
        ),
      });
    } finally {
      setCheckingEffective(false);
    }
  };

  return (
    <div className="space-y-5">

      {apiMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          {lang === "VN"
            ? "API phụ thu (/fare-policy/adjustments) chưa có trên BE hiện tại — form đã sẵn, sẽ hoạt động khi BE deploy."
            : "Surcharge APIs are not on the current BE yet — forms are ready and will work after BE deploy."}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={handleSaveWeekend} className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <h3 className="font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Cuối tuần" : "Weekend"}
          </h3>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "% phụ thu" : "Surcharge %"}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={weekend.surchargePercent}
              onChange={(e) => setWeekend((prev) => ({ ...prev, surchargePercent: e.target.value }))}
              className={inputStyle}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={weekend.isActive}
              onChange={(e) => setWeekend((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-slate-300"
            />
            {lang === "VN" ? "Đang bật" : "Active"}
          </label>
          <button
            type="submit"
            disabled={savingWeekend}
            className="rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
          >
            {savingWeekend
              ? (lang === "VN" ? "Đang lưu…" : "Saving…")
              : (lang === "VN" ? "Lưu" : "Save")}
          </button>
        </form>

        <form onSubmit={handleSaveHoliday} className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <h3 className="font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Ngày lễ / đặc biệt" : "Holiday / special day"}
          </h3>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Ngày" : "Date"}</label>
            <AppDateInput
              required
              value={holiday.date}
              onChange={(e) => setHoliday((prev) => ({ ...prev, date: e.target.value }))}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Tên" : "Name"}</label>
            <input
              type="text"
              value={holiday.name}
              onChange={(e) => setHoliday((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={lang === "VN" ? "Quốc khánh" : "National Day"}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "% phụ thu" : "Surcharge %"}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={holiday.surchargePercent}
              onChange={(e) => setHoliday((prev) => ({ ...prev, surchargePercent: e.target.value }))}
              className={inputStyle}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={holiday.isActive}
              onChange={(e) => setHoliday((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-slate-300"
            />
            {lang === "VN" ? "Đang bật" : "Active"}
          </label>
          <button
            type="submit"
            disabled={savingHoliday}
            className="rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
          >
            {savingHoliday
              ? (lang === "VN" ? "Đang lưu…" : "Saving…")
              : (lang === "VN" ? "Lưu" : "Save")}
          </button>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <h3 className="mb-3 font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Kiểm tra phụ thu theo ngày" : "Check effective surcharge"}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className={labelStyle}>{lang === "VN" ? "Ngày" : "Date"}</label>
            <AppDateInput
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className={inputStyle}
            />
          </div>
          <button
            type="button"
            disabled={checkingEffective || !effectiveDate}
            onClick={handleCheckEffective}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            {checkingEffective
              ? (lang === "VN" ? "Đang kiểm…" : "Checking…")
              : (lang === "VN" ? "Kiểm tra" : "Check")}
          </button>
        </div>
        {effective ? (
          <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
            {effective.name || effective.scope}
            {" · "}
            +{effective.surchargePercent}%
            {!effective.isActive ? ` · ${lang === "VN" ? "tắt" : "off"}` : ""}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <h3 className="font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Danh sách phụ thu" : "Surcharge list"}
          </h3>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-[#124757]"
          >
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
        ) : adjustments.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">
            {lang === "VN" ? "Chưa có phụ thu." : "No surcharges yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                  <th className="px-5 py-3">{lang === "VN" ? "Phạm vi" : "Scope"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Ngày" : "Date"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Tên" : "Name"}</th>
                  <th className="px-4 py-3">%</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-200">{row.scope}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{row.date || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.name || "—"}</td>
                    <td className="px-4 py-3 font-black text-[#124757] dark:text-yellow-400">+{row.surchargePercent}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${row.isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                        {row.isActive ? (lang === "VN" ? "Bật" : "On") : (lang === "VN" ? "Tắt" : "Off")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function SeatTypeManagement() {
  const { lang } = useApp();
  const [tab, setTab] = useState("seats");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-2 pb-10 font-body animate-fade-in sm:px-4">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
        <h2 className="font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 sm:text-2xl">
          {lang === "VN" ? "Chính sách giá" : "Fare policy"}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {lang === "VN"
            ? "Giá loại ghế · công thức theo km · phụ thu cuối tuần / ngày lễ."
            : "Seat prices · distance formula · weekend/holiday surcharges."}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-headline font-black uppercase tracking-wider transition ${active
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400"
                  }`}
              >
                {lang === "VN" ? item.vn : item.en}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "seats" ? <SeatTypesTab lang={lang} onGoToDistanceTab={() => setTab("distance")} /> : null}
      {tab === "distance" ? <DistanceFareTab lang={lang} /> : null}
      {tab === "surcharge" ? <SurchargeTab lang={lang} /> : null}
    </div>
  );
}
