import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchSeatTypes, isDeck1SeatType, isDeck2SeatType, isDistanceFareSeatType, saveSeatTypeBasePrice } from "../../../services/seatTypeService";
import {
  fetchFareAdjustments,
  fetchFarePolicy,
  saveCalendarDayAdjustment,
  saveFarePolicy,
  saveWeekendAdjustment,
} from "../../../services/farePolicyService";
import {
  fetchSightseeingConcession,
  saveSightseeingConcession,
} from "../../../services/ticketTypeService";
import {
  fetchAdminRentalPricePolicies,
  RENTAL_PRICE_UNITS,
  saveAdminRentalPricePolicy,
} from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify } from "../../../utils/swalToast";
import { required } from "../../../utils/required";

const MAIN_TABS = [
  { id: "tickets", vn: "Giá mua vé", en: "Ticket prices" },
  { id: "charter", vn: "Giá thuê tàu", en: "Request booking prices" },
];

const TICKET_SECTIONS = [
  { id: "seats", vn: "Giá ghế", en: "Seat prices" },
  { id: "surcharge", vn: "Phụ thu", en: "Surcharges" },
];

const ROUNDING_DISPLAY = 1000;
const MAX_TICKET_PRICE_VND = 100_000_000;
const MAX_DISTANCE_FARE_PER_KM_VND = 1_000_000;
const MAX_RENTAL_PRICE_VND = 1_000_000_000;

const formatVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")} VND`;
};

/** Giá trẻ em / người lớn tuổi = giá gốc × (100 − % giảm) / 100, làm tròn nghìn. */
const concessionPriceFromBase = (basePrice, discountPercent) => {
  const base = Number(basePrice);
  const percent = Number(discountPercent);
  if (!Number.isFinite(base) || base < 0) return null;
  if (!Number.isFinite(percent)) return null;
  const raw = base * ((100 - percent) / 100);
  return Math.round(raw / ROUNDING_DISPLAY) * ROUNDING_DISPLAY;
};

const inputStyle =
  "box-border h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold leading-none text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white";
const labelStyle = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400";

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const isWholeVndInRange = (value, min, max) => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= min && amount <= max;
};

const groupThousands = (value) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

/** Tên ngày lễ: chữ, số và các dấu phân cách thường gặp như "Quốc khánh (2/9)". */
const sanitizeHolidayName = (value) => String(value ?? "")
  .replace(/[^\p{L}\p{N}\s/().,-]/gu, "")
  .replace(/\s{2,}/g, " ");

const isValidHolidayName = (value) => {
  const name = String(value ?? "").trim();
  if (!name || name.length > 100 || !/\p{L}/u.test(name) || sanitizeHolidayName(name) !== name) return false;
  if (!/^[\p{L}\p{N}]/u.test(name) || !/[\p{L}\p{N})]$/u.test(name)) return false;
  if (/[.,/-]{2,}|\({2,}|\){2,}/.test(name)) return false;
  if ((name.match(/\//g) || []).length > 1) return false;
  if ((name.match(/\(/g) || []).length !== (name.match(/\)/g) || []).length) return false;
  return true;
};

const getHolidayNameError = (value, lang) => {
  const name = String(value ?? "").trim();
  if (!name) return lang === "VN" ? "Tên ngày lễ là bắt buộc." : "Holiday name is required.";
  if (isValidHolidayName(name)) return "";
  return lang === "VN"
    ? "Tên chỉ gồm chữ, số và các dấu - / ( ) . ,; không lặp ký tự đặc biệt."
    : "Use letters, numbers, and - / ( ) . , only; do not repeat punctuation.";
};

/** Ô nhập tiền: gõ số trần, hiển thị có dấu chấm, trả về chuỗi chỉ gồm chữ số. */
function MoneyInput({ value, onChange, max, className = "", wrapperClassName = "w-full", suffix = "VND", ...rest }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={groupThousands(value)}
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          if (!next || max == null || Number(next) <= max) onChange(next);
        }}
        className={`${className} ${suffix ? (String(suffix).length > 3 ? "pr-16" : "pr-12") : ""} text-right tabular-nums`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wide text-slate-400">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

const normalizePercentInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Math.min(100, Number(digits)));
};

/** Input phần trăm nguyên 0–100, không cho dấu âm, dấu chấm hay spin buttons. */
function PercentInput({ value, onChange, className = "", ...rest }) {
  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(normalizePercentInput(event.target.value))}
        className={`${className} pr-8 text-right tabular-nums`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">%</span>
    </div>
  );
}

function SeatTypesTab({ lang, onGoToDistanceTab, deckMode = "deck1", concessionPercent = null }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const showConcessionCol = deckMode === "deck2";
  const draftPriceError = String(draftPrice).trim() && !isWholeVndInRange(draftPrice, 0, MAX_TICKET_PRICE_VND)
    ? (lang === "VN" ? "Nhập số nguyên từ 0 đến 100.000.000 VND." : "Enter a whole number from 0 to 100,000,000 VND.")
    : "";

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
    const scoped = rows.filter((row) => (
      deckMode === "deck2" ? isDeck2SeatType(row) : isDeck1SeatType(row)
    ));
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (row) => row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    );
  }, [rows, query, deckMode]);

  const startEdit = (row) => {
    if (isDistanceFareSeatType(row) || row.priceEditable === false) {
      notify({
        icon: "info",
        title: lang === "VN" ? "STANDARD theo km" : "STANDARD is distance-based",
        text: lang === "VN"
          ? "STANDARD dùng pricingMode=DistanceFareForRegular. Chỉnh ở mục Giá theo km bên dưới (/api/fare-policy)."
          : "STANDARD uses DistanceFareForRegular. Edit in the Distance fare section below (/api/fare-policy).",
      });
      return;
    }
    setEditingCode(row.code);
    setDraftPrice(String(Math.round(Number(row.basePrice) || 0)));
  };

  const cancelEdit = () => {
    setEditingCode("");
    setDraftPrice("");
  };

  const handleSave = async (code) => {
    if (!String(draftPrice ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu giá" : "Missing price",
        text: lang === "VN" ? "Vui lòng nhập giá gốc." : "Please enter a base price.",
      });
      return;
    }
    const price = Number(draftPrice);
    if (!isWholeVndInRange(price, 0, MAX_TICKET_PRICE_VND)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giá không hợp lệ" : "Invalid price",
        text: lang === "VN" ? "Giá ghế phải là số nguyên từ 0 đến 100.000.000 VND." : "Seat price must be a whole number from 0 to 100,000,000 VND.",
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
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700 sm:px-5">
          <div className="relative">
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
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757]" />
            <p className="text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-xs font-medium text-slate-400">
            {lang === "VN" ? "Không có loại ghế trong mục này." : "No seat types in this section."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                  <th className="px-5 py-3">{lang === "VN" ? "Mã" : "Code"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Tên" : "Name"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Giá gốc" : "Base price"}</th>
                  {showConcessionCol ? (
                    <th className="px-4 py-3">
                      {lang === "VN" ? "Trẻ em / NCT / NKT" : "Child / senior / disabled"}
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Hành động" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-700/60">
                {filtered.map((row) => {
                  const editing = editingCode === row.code;
                  const locked = isDistanceFareSeatType(row) || row.priceEditable === false;
                  const priceForConcession = editing ? Number(draftPrice) : Number(row.basePrice);
                  const childSeniorPrice = showConcessionCol
                    ? concessionPriceFromBase(priceForConcession, concessionPercent)
                    : null;
                  return (
                    <tr key={row.code} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30">
                      <td className="px-5 py-3.5">
                        <span className="font-headline text-[11px] font-black text-[#124757] dark:text-yellow-400">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-200">{row.name}</td>
                      <td className="px-4 py-3.5">
                        {editing ? (
                          <div>
                            <MoneyInput
                              value={draftPrice}
                              onChange={setDraftPrice}
                              max={MAX_TICKET_PRICE_VND}
                              wrapperClassName="w-36"
                              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-[#FFD100] dark:bg-slate-900 dark:text-white ${draftPriceError ? "border-rose-500" : "border-slate-200 dark:border-slate-600"}`}
                              autoFocus
                            />
                            {draftPriceError ? <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">{draftPriceError}</p> : null}
                          </div>
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
                      {showConcessionCol ? (
                        <td className="px-4 py-3.5">
                          <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                            {childSeniorPrice == null ? "—" : formatVnd(childSeniorPrice)}
                          </span>
                        </td>
                      ) : null}
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
                            title={lang === "VN" ? "Tới mục Giá theo km bên dưới" : "Go to the Distance fare section below"}
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
    roundingStep: 1000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState({ baseFare: false, pricePerKm: false });
  const baseFareErrorRaw = String(form.baseFare ?? "").trim() && !isWholeVndInRange(form.baseFare, 0, MAX_TICKET_PRICE_VND)
    ? (lang === "VN" ? "Nhập số nguyên từ 0 đến 100.000.000 VND." : "Enter a whole number from 0 to 100,000,000 VND.")
    : "";
  const pricePerKmErrorRaw = String(form.pricePerKm ?? "").trim() && !isWholeVndInRange(form.pricePerKm, 1, MAX_DISTANCE_FARE_PER_KM_VND)
    ? (lang === "VN" ? "Nhập số nguyên từ 1 đến 1.000.000 VND/km." : "Enter a whole number from 1 to 1,000,000 VND/km.")
    : "";
  const baseFareError = touched.baseFare ? baseFareErrorRaw : "";
  const pricePerKmError = touched.pricePerKm ? pricePerKmErrorRaw : "";

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const policy = await fetchFarePolicy();
      setForm({
        baseFare: policy.baseFare,
        pricePerKm: policy.pricePerKm,
        roundingStep: policy.roundingStep || 1000,
      });
      setTouched({ baseFare: false, pricePerKm: false });
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
    setTouched({ baseFare: true, pricePerKm: true });

    if (!String(form.baseFare ?? "").trim() || !String(form.pricePerKm ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
        text: lang === "VN" ? "Vui lòng nhập đầy đủ giá cơ bản và giá/km." : "Please fill in both the base fare and the price per km.",
      });
      return;
    }
    const baseFare = Number(form.baseFare);
    if (!isWholeVndInRange(baseFare, 0, MAX_TICKET_PRICE_VND)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giá cơ bản không hợp lệ" : "Invalid base fare",
        text: lang === "VN" ? "Giá cơ bản phải là số nguyên từ 0 đến 100.000.000 VND." : "Base fare must be a whole number from 0 to 100,000,000 VND.",
      });
      return;
    }
    const pricePerKm = Number(form.pricePerKm);
    if (!isWholeVndInRange(pricePerKm, 1, MAX_DISTANCE_FARE_PER_KM_VND)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giá/km không hợp lệ" : "Invalid price per km",
        text: lang === "VN" ? "Giá/km phải là số nguyên lớn hơn 0 và không quá 1.000.000 VND/km." : "Price per km must be a whole number above 0 and no more than 1,000,000 VND/km.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveFarePolicy(form);
      setForm({
        baseFare: saved.baseFare,
        pricePerKm: saved.pricePerKm,
        roundingStep: saved.roundingStep || 1000,
      });
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu công thức giá" : "Fare policy saved",
        showConfirmButton: false,
        timer: 1400,
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

      <form
        onSubmit={handleSave}
        className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6"
      >
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giá cơ bản" : "Base fare"}</label>
                <MoneyInput
                  required
                  value={form.baseFare}
                  onChange={(next) => {
                    setTouched((prev) => ({ ...prev, baseFare: true }));
                    setForm((prev) => ({ ...prev, baseFare: next }));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, baseFare: true }))}
                  max={MAX_TICKET_PRICE_VND}
                  className={`${inputStyle} ${baseFareError ? "border-rose-500 focus:ring-rose-500" : ""}`}
                />
                <p className="mt-1 min-h-4 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  {baseFareError}
                </p>
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giá / km" : "Price per km"}</label>
                <MoneyInput
                  required
                  value={form.pricePerKm}
                  onChange={(next) => {
                    setTouched((prev) => ({ ...prev, pricePerKm: true }));
                    setForm((prev) => ({ ...prev, pricePerKm: next }));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, pricePerKm: true }))}
                  max={MAX_DISTANCE_FARE_PER_KM_VND}
                  className={`${inputStyle} ${pricePerKmError ? "border-rose-500 focus:ring-rose-500" : ""}`}
                  suffix="VND/km"
                />
                <p className="mt-1 min-h-4 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  {pricePerKmError}
                </p>
              </div>
              <div>
                <span className={labelStyle} aria-hidden>&nbsp;</span>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 w-full rounded-xl bg-[#124757] px-4 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
                >
                  {isSaving
                    ? (lang === "VN" ? "Đang lưu…" : "Saving…")
                    : (lang === "VN" ? "Lưu" : "Save")}
                </button>
                <span className="mt-1 block min-h-4" aria-hidden />
              </div>
            </div>
            <div className="flex gap-2.5 rounded-2xl border border-[#124757]/20 bg-[#f4fafb] px-4 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-yellow-400/20 dark:bg-yellow-400/5 dark:text-slate-400">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-base text-[#124757] dark:text-yellow-400" aria-hidden>info</span>
              <div className="min-w-0">
                <p className="font-headline text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Lưu ý" : "Note"}
                </p>
                <p>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Cách tính giá: " : "Price calculation: "}</span>
                  {lang === "VN"
                    ? "Giá cơ bản + (giá mỗi km × số km di chuyển). Nếu kết quả có số lẻ, hệ thống làm tròn lên đến đồng kế tiếp."
                    : `Base fare + (price/km × distance), rounded up to ${Number(form.roundingStep) || 1000} VND.`}
                </p>
                <p>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{lang === "VN" ? "Vé ưu đãi: " : "Concession tickets: "}</span>
                  {lang === "VN"
                    ? "Trẻ em, người cao tuổi, người khuyết tật và em bé được miễn phí (0 VND)."
                    : "Children, seniors, disabled passengers and infants travel free (0 VND)."}
                </p>
              </div>
            </div>
          </div>
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
  const [savingWeekend, setSavingWeekend] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [holidayDateTouched, setHolidayDateTouched] = useState(false);
  const [holidayNameTouched, setHolidayNameTouched] = useState(false);
  const [holidayPercentTouched, setHolidayPercentTouched] = useState(false);
  const holidayDateError = holidayDateTouched && !holiday.date
    ? (lang === "VN" ? "Ngày lễ là bắt buộc." : "Holiday date is required.")
    : "";
  const holidayNameValid = isValidHolidayName(holiday.name);
  const holidayNameError = holidayNameTouched ? getHolidayNameError(holiday.name, lang) : "";
  const holidayPercentValue = Number(holiday.surchargePercent);
  const holidayPercentValid = Number.isInteger(holidayPercentValue)
    && holidayPercentValue > 0
    && holidayPercentValue <= 100;
  const holidayPercentError = holidayPercentTouched && !holidayPercentValid
    ? (lang === "VN" ? "Nhập số nguyên từ 1% đến 100%." : "Enter a whole number from 1% to 100%.")
    : "";
  const holidayFormValid = Boolean(holiday.date) && holidayNameValid && holidayPercentValid;

  const labelScope = (scope) => {
    const key = String(scope || "").toLowerCase();
    if (key === "weekend") return lang === "VN" ? "Cuối tuần" : "Weekend";
    if (key === "holiday") return lang === "VN" ? "Ngày lễ" : "Holiday";
    return scope || "—";
  };

  const isWeekendRow = (row) => String(row?.scope || "").toLowerCase() === "weekend" && !row?.date;

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const list = await fetchFareAdjustments();
      setAdjustments(list);
      setApiMissing(false);
      const weekendRow = list.find((row) => isWeekendRow(row));
      if (weekendRow) {
        setWeekend({
          surchargePercent: Math.min(100, Math.max(0, Math.round(Number(weekendRow.surchargePercent) || 0))),
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

    if (!String(weekend.surchargePercent ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu mức phụ thu" : "Missing surcharge",
        text: lang === "VN" ? "Vui lòng nhập mức phụ thu." : "Please enter a surcharge percentage.",
      });
      return;
    }
    const weekendPercent = Number(weekend.surchargePercent);
    if (!Number.isInteger(weekendPercent) || weekendPercent <= 0 || weekendPercent > 100) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Mức phụ thu không hợp lệ" : "Invalid surcharge",
        text: lang === "VN" ? "Mức phụ thu phải là số nguyên lớn hơn 0% và không quá 100%." : "Surcharge must be a whole number above 0% and no more than 100%.",
      });
      return;
    }

    setSavingWeekend(true);
    try {
      const payload = {
        surchargePercent: weekendPercent,
        isActive: Boolean(weekend.isActive),
      };
      await saveWeekendAdjustment(payload);
      setWeekend(payload);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu phụ thu cuối tuần" : "Weekend surcharge saved",
        showConfirmButton: false,
        timer: 1400,
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
    const holidayName = String(holiday.name || "").trim();
    if (!isValidHolidayName(holidayName)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Tên ngày lễ không hợp lệ" : "Invalid holiday name",
        text: lang === "VN"
          ? "Tên chỉ gồm chữ, số, khoảng trắng và các dấu - / ( ) . ,"
          : "Name may contain letters, numbers, spaces, and - / ( ) . , only.",
      });
      return;
    }
    if (!String(holiday.surchargePercent ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu mức phụ thu" : "Missing surcharge",
        text: lang === "VN" ? "Vui lòng nhập mức phụ thu." : "Please enter a surcharge percentage.",
      });
      return;
    }
    const holidayPercent = Number(holiday.surchargePercent);
    if (!Number.isInteger(holidayPercent) || holidayPercent <= 0 || holidayPercent > 100) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Mức phụ thu không hợp lệ" : "Invalid surcharge",
        text: lang === "VN" ? "Mức phụ thu phải là số nguyên lớn hơn 0% và không quá 100%." : "Surcharge must be a whole number above 0% and no more than 100%.",
      });
      return;
    }
    setSavingHoliday(true);
    try {
      const payload = {
        date: holiday.date,
        scope: "Holiday",
        name: holidayName,
        surchargePercent: holidayPercent,
        isActive: true,
      };
      await saveCalendarDayAdjustment(payload);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu ngày đặc biệt" : "Special day saved",
        showConfirmButton: false,
        timer: 1400,
      });
      setHoliday({
        date: "",
        scope: "Holiday",
        name: "",
        surchargePercent: 50,
        isActive: true,
      });
      setHolidayDateTouched(false);
      setHolidayNameTouched(false);
      setHolidayPercentTouched(false);
      await load();
      setAdjustments((prev) => prev.map((row) => {
        if (row.date !== payload.date || String(row.scope).toLowerCase() !== "holiday") return row;
        const beName = String(row.name || "").trim();
        const beNameIsFallback = !beName || /^holiday[\s_-]*\d{4}-\d{2}-\d{2}$/i.test(beName);
        return {
          ...row,
          name: beNameIsFallback ? payload.name : beName,
          isActive: true,
          surchargePercent: payload.surchargePercent,
          scope: "Holiday",
        };
      }));
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

  const handleToggleActive = async (row) => {
    const nextActive = !row.isActive;
    setTogglingId(row.id);
    try {
      if (isWeekendRow(row)) {
        const payload = {
          surchargePercent: Number(row.surchargePercent) || 0,
          isActive: nextActive,
        };
        await saveWeekendAdjustment(payload);
        setWeekend(payload);
      } else {
        if (!row.date) {
          notify({
            icon: "warning",
            title: lang === "VN" ? "Thiếu ngày" : "Missing date",
          });
          return;
        }
        await saveCalendarDayAdjustment({
          date: row.date,
          scope: "Holiday",
          name: String(row.name || "").trim(),
          surchargePercent: Number(row.surchargePercent) || 0,
          isActive: nextActive,
        });
      }
      setAdjustments((prev) => prev.map((item) => (
        item.id === row.id ? { ...item, isActive: nextActive } : item
      )));
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: nextActive
          ? (lang === "VN" ? "Đã bật phụ thu" : "Surcharge enabled")
          : (lang === "VN" ? "Đã tắt phụ thu" : "Surcharge disabled"),
        showConfirmButton: false,
        timer: 1200,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không đổi được trạng thái" : "Could not update status",
        text: getApiErrorMessage(error, lang === "VN" ? "Thử lại sau." : "Please try again."),
      });
    } finally {
      setTogglingId("");
    }
  };

  return (
    <div className="space-y-4">
      {apiMissing ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === "VN"
            ? "API phụ thu chưa có trên BE — form sẵn, dùng được khi BE deploy."
            : "Surcharge API not on BE yet — forms are ready after deploy."}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="space-y-5 p-5 sm:p-6">
          <form onSubmit={handleSaveWeekend} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_20rem_auto] sm:items-start">
            <div className="min-w-0 flex-1">
              <p className="font-headline text-[11px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Phụ thu cuối tuần" : "Weekend surcharge"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {lang === "VN" ? "Tự động áp dụng vào Thứ 7 và Chủ Nhật." : "Automatically applies on Saturday and Sunday."}
              </p>
            </div>
            <div className="w-full">
              <label className={labelStyle}>{<>{lang === "VN" ? "Mức phụ thu" : "Surcharge"}{required()}</>}</label>
              <PercentInput
                value={weekend.surchargePercent}
                onChange={(surchargePercent) => setWeekend((prev) => ({ ...prev, surchargePercent }))}
                className={inputStyle}
                aria-label={lang === "VN" ? "Mức phụ thu cuối tuần" : "Weekend surcharge"}
              />
            </div>
            <div>
              <span className={labelStyle} aria-hidden>&nbsp;</span>
              <button
                type="submit"
                disabled={savingWeekend}
                className="box-border h-10 w-full rounded-xl bg-[#124757] px-4 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
              >
                {savingWeekend ? "…" : (lang === "VN" ? "Lưu" : "Save")}
              </button>
              <span className="mt-1 block min-h-4" aria-hidden />
            </div>
          </form>

          <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
            <form onSubmit={handleSaveHoliday} className="space-y-3">
              <p className="font-headline text-[11px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Ngày lễ" : "Holiday"}
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_10rem_auto] lg:items-start">
                <div className="min-w-37.5 flex-1">
                  <label className={labelStyle}>{<>{lang === "VN" ? "Ngày" : "Date"}{required()}</>}</label>
                  <AppDateInput
                    required
                    value={holiday.date}
                    onChange={(e) => {
                      setHolidayDateTouched(true);
                      setHoliday((prev) => ({ ...prev, date: e.target.value }));
                    }}
                    className={`${inputStyle} ${holidayDateError ? "border-rose-500! bg-rose-50/50! focus:ring-rose-500! dark:bg-rose-500/10!" : ""}`}
                  />
                  <p className="mt-1 min-h-4 text-[10px] font-bold text-rose-600 dark:text-rose-400">{holidayDateError}</p>
                </div>
                <div className="min-w-35 flex-1">
                  <label className={labelStyle}>{<>{lang === "VN" ? "Tên" : "Name"}{required()}</>}</label>
                  <input
                    type="text"
                    required
                    value={holiday.name}
                    onChange={(e) => {
                      setHolidayNameTouched(true);
                      setHoliday((prev) => ({ ...prev, name: sanitizeHolidayName(e.target.value) }));
                    }}
                    onBlur={() => setHolidayNameTouched(true)}
                    placeholder={lang === "VN" ? "Quốc khánh" : "National Day"}
                    className={`${inputStyle} ${holidayNameError ? "border-rose-500! bg-rose-50/50! focus:ring-rose-500! dark:bg-rose-500/10!" : ""}`}
                  />
                  <p className="mt-1 min-h-4 text-[10px] font-bold text-rose-600 dark:text-rose-400">{holidayNameError}</p>
                </div>
                <div className="w-30">
                  <label className={labelStyle}>{<>{lang === "VN" ? "Mức phụ thu" : "Surcharge"}{required()}</>}</label>
                  <PercentInput
                    value={holiday.surchargePercent}
                    onChange={(surchargePercent) => {
                      setHolidayPercentTouched(true);
                      setHoliday((prev) => ({ ...prev, surchargePercent }));
                    }}
                    className={`${inputStyle} ${holidayPercentError ? "border-rose-500! bg-rose-50/50! focus:ring-rose-500! dark:bg-rose-500/10!" : ""}`}
                    aria-label={lang === "VN" ? "Mức phụ thu ngày lễ" : "Holiday surcharge"}
                  />
                  <p className="mt-1 min-h-4 text-[10px] font-bold text-rose-600 dark:text-rose-400">{holidayPercentError}</p>
                </div>
                <div>
                  <span className={labelStyle} aria-hidden>&nbsp;</span>
                  <button
                    type="submit"
                    disabled={savingHoliday || !holidayFormValid}
                    className="box-border h-10 w-full shrink-0 rounded-xl bg-[#124757] px-4 text-[11px] font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
                  >
                    {savingHoliday ? "…" : (lang === "VN" ? "Thêm" : "Add")}
                  </button>
                  <span className="mt-1 block min-h-4" aria-hidden />
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700">
          <div className="px-5 py-3 sm:px-6">
            <p className="font-headline text-[11px] font-black uppercase tracking-wider text-slate-500">
              {lang === "VN" ? "Đang áp dụng" : "Active rules"}
            </p>
          </div>

          {isLoading ? (
            <p className="px-5 pb-6 text-center text-xs text-slate-400 sm:px-6">
              {lang === "VN" ? "Đang tải…" : "Loading…"}
            </p>
          ) : adjustments.length === 0 ? (
            <p className="px-5 pb-6 text-center text-xs text-slate-400 sm:px-6">
              {lang === "VN" ? "Chưa có phụ thu." : "No surcharges yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                    <th className="px-5 py-3 sm:px-6">{lang === "VN" ? "Loại" : "Type"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Ngày" : "Date"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Tên" : "Name"}</th>
                    <th className="px-4 py-3">%</th>
                    <th className="px-4 py-3 sm:pr-6">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {adjustments.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-200 sm:px-6">
                        {labelScope(row.scope)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {String(row.scope).toLowerCase() === "weekend"
                          ? (lang === "VN" ? "Thứ 7 và Chủ Nhật" : "Saturday and Sunday")
                          : (row.date || "—")}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {row.name || (String(row.scope).toLowerCase() === "weekend"
                          ? (lang === "VN" ? "Cuối tuần" : "Weekend")
                          : "—")}
                      </td>
                      <td className="px-4 py-3 font-black text-[#124757] dark:text-yellow-400">
                        +{row.surchargePercent}%
                      </td>
                      <td className="px-4 py-3 sm:pr-6">
                        <button
                          type="button"
                          disabled={togglingId === row.id}
                          onClick={() => handleToggleActive(row)}
                          title={lang === "VN" ? "Bấm để bật/tắt" : "Click to toggle"}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition disabled:opacity-50 ${row.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                        >
                          {togglingId === row.id
                            ? "…"
                            : (row.isActive ? (lang === "VN" ? "Bật" : "On") : (lang === "VN" ? "Tắt" : "Off"))}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SightseeingConcessionTab({ lang, onPercentChange }) {
  const [percent, setPercent] = useState("0");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchSightseeingConcession();
      setPercent(String(data.discountPercent));
      onPercentChange?.(data.discountPercent);
    } catch (error) {
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được mức giảm tuyến tham quan." : "Failed to load sightseeing concession.",
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

  const discountPercent = Number(percent);
  const percentError = String(percent).trim() && (
    !Number.isFinite(discountPercent)
    || discountPercent < 0
    || discountPercent > 100
    || !/^\d+(?:\.\d{1,2})?$/.test(String(percent))
  )
    ? (lang === "VN" ? "Nhập từ 0 đến 100%, tối đa 2 chữ số thập phân." : "Enter 0–100%, with at most 2 decimal places.")
    : "";

  const handleSave = async (e) => {
    e.preventDefault();
    if (!String(percent ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu mức giảm" : "Missing discount",
        text: lang === "VN" ? "Vui lòng nhập mức giảm." : "Please enter a discount percentage.",
      });
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || !/^\d+(?:\.\d{1,2})?$/.test(String(percent))) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Mức giảm không hợp lệ" : "Invalid discount",
        text: lang === "VN" ? "Nhập từ 0 đến 100%, tối đa 2 chữ số thập phân." : "Enter 0–100%, with at most 2 decimal places.",
      });
      return;
    }
    try {
      setIsSaving(true);
      const saved = await saveSightseeingConcession(discountPercent);
      setPercent(String(saved.discountPercent));
      onPercentChange?.(saved.discountPercent);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu mức giảm" : "Discount saved",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Không lưu được mức giảm." : "Could not save discount."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6"
    >
      {errorMsg ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {errorMsg}
        </div>
      ) : null}

      {isLoading ? (
        <p className="py-6 text-center text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {lang === "VN" ? "Ưu đãi WaterSightseeing (Trẻ em / Người lớn tuổi / Người khuyết tật)" : "Sightseeing concession (CHILD / SENIOR / DISABLED)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-24">
              <input
                type="text"
                inputMode="decimal"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
                  const n = Number(next);
                  if (next && (!Number.isFinite(n) || n > 100)) return;
                  setPercent(next);
                  if (next && Number.isFinite(n)) onPercentChange?.(n);
                }}
                className={`${inputStyle} pr-8 text-right tabular-nums ${percentError ? "border-rose-500 focus:ring-rose-500" : ""}`}
                aria-label={lang === "VN" ? "Mức giảm %" : "Discount %"}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                %
              </span>
            </div>
            {percentError ? <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{percentError}</p> : null}
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#124757] px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
            >
              {isSaving ? (lang === "VN" ? "Đang lưu…" : "Saving…") : (lang === "VN" ? "Lưu" : "Save")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

const RENTAL_SERVICE_GROUPS = [
  {
    decks: 1,
    id: "waterbus",
    vn: "Giá thuê tàu Waterbus",
    en: "Waterbus request booking rates",
  },
  {
    decks: 2,
    id: "sightseeing",
    vn: "Giá thuê tàu Sightseeing",
    en: "Sightseeing request booking rates",
  },
];

function RentalPricePoliciesTab({ lang, numberOfDecks }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [warningMsg, setWarningMsg] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const groups = RENTAL_SERVICE_GROUPS.filter((group) => (
    numberOfDecks == null || Number(group.decks) === Number(numberOfDecks)
  ));

  const applyList = (list) => {
    setRows(list);
    const next = {};
    list.forEach((row) => {
      next[row.charterBoatRentalPricePolicyId] = {
        unitPrice: String(Math.round(Number(row.unitPrice) || 0)),
        currency: row.currency || "VND",
      };
    });
    setDrafts(next);
  };

  const load = async () => {
    try {
      setIsLoading(true);
      setWarningMsg("");
      const { policies, fromFallback, error } = await fetchAdminRentalPricePolicies();
      applyList(policies);
      if (fromFallback) {
        setWarningMsg(
          lang === "VN"
            ? "BE chưa trả được danh sách policy. Đang hiện form mặc định — bạn vẫn có thể nhập giá và Lưu."
            : "Server failed to return policies. Showing defaults — you can still edit and Save.",
        );
        if (error) console.warn(error);
      }
    } catch (error) {
      setWarningMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được giá thuê." : "Failed to load rental prices.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, numberOfDecks]);

  const patchDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (row) => {
    const draft = drafts[row.charterBoatRentalPricePolicyId] || {};
    if (!String(draft.unitPrice ?? "").trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu giá" : "Missing price",
        text: lang === "VN" ? "Vui lòng nhập giá thuê." : "Please enter a unit price.",
      });
      return;
    }
    const unitPrice = Number(draft.unitPrice);
    if (!isWholeVndInRange(unitPrice, 0, MAX_RENTAL_PRICE_VND)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giá không hợp lệ" : "Invalid price",
        text: lang === "VN" ? "Giá thuê phải là số nguyên từ 0 đến 1.000.000.000 VND." : "Unit price must be a whole number from 0 to 1,000,000,000 VND.",
      });
      return;
    }
    try {
      setSavingKey(row.charterBoatRentalPricePolicyId);
      const saved = await saveAdminRentalPricePolicy({
        numberOfDecks: row.numberOfDecks,
        rentalUnit: row.rentalUnit,
        unitPrice,
        currency: draft.currency || "VND",
        charterBoatRentalPricePolicyId: row.charterBoatRentalPricePolicyId,
      });
      setRows((prev) => prev.map((item) => (
        item.charterBoatRentalPricePolicyId === row.charterBoatRentalPricePolicyId
          ? { ...item, ...saved, unitPrice, currency: draft.currency || "VND" }
          : item
      )));
      setDrafts((prev) => ({
        ...prev,
        [row.charterBoatRentalPricePolicyId]: {
          unitPrice: String(Math.round(unitPrice)),
          currency: draft.currency || "VND",
        },
      }));
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu giá thuê" : "Rental policy saved",
        showConfirmButton: false,
        timer: 1400,
      });
      const refreshed = await fetchAdminRentalPricePolicies();
      if (!refreshed.fromFallback) {
        applyList(refreshed.policies);
        setWarningMsg("");
      }
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Không lưu được policy." : "Could not save policy."),
      });
    } finally {
      setSavingKey("");
    }
  };

  const renderPolicyRow = (row) => {
    const draft = drafts[row.charterBoatRentalPricePolicyId] || {};
    const busy = savingKey === row.charterBoatRentalPricePolicyId;
    const unitPriceError = String(draft.unitPrice ?? "").trim() && !isWholeVndInRange(draft.unitPrice, 0, MAX_RENTAL_PRICE_VND)
      ? (lang === "VN" ? "Nhập số nguyên từ 0 đến 1.000.000.000 VND." : "Enter a whole number from 0 to 1,000,000,000 VND.")
      : "";
    const unitLabel = row.rentalUnit === RENTAL_PRICE_UNITS.DAY
      ? (lang === "VN" ? "Ngày" : "Day")
      : (lang === "VN" ? "Giờ" : "Hour");

    return (
      <tr key={row.charterBoatRentalPricePolicyId}>
        <td className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">{unitLabel}</td>
        <td className="px-4 py-3">
          <MoneyInput
            value={draft.unitPrice ?? ""}
            onChange={(next) => patchDraft(row.charterBoatRentalPricePolicyId, { unitPrice: next })}
            max={MAX_RENTAL_PRICE_VND}
            wrapperClassName="w-full max-w-[180px]"
            className={`${inputStyle} ${unitPriceError ? "border-rose-500 focus:ring-rose-500" : ""}`}
            suffix=""
          />
          {unitPriceError ? <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">{unitPriceError}</p> : null}
        </td>
        <td className="w-18 px-4 py-3">
          <span className="inline-flex h-10.5 w-14 items-center justify-center text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {draft.currency || "VND"}
          </span>
        </td>
        <td className="w-28 px-4 py-3 text-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave(row)}
            className="h-10 w-17 rounded-xl bg-[#124757] text-[10px] font-headline font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
          >
            {busy ? "…" : (lang === "VN" ? "Lưu" : "Save")}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {warningMsg ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {warningMsg}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-400 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          {lang === "VN" ? "Đang tải…" : "Loading…"}
        </div>
      ) : (
        groups.map((group) => {
          const groupRows = rows
            .filter((row) => Number(row.numberOfDecks) === group.decks)
            .sort((a, b) => String(a.rentalUnit).localeCompare(String(b.rentalUnit)));

          return (
            <div
              key={group.id}
              className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
            >
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <h4 className="font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? group.vn : group.en}
                </h4>
              </div>
              {groupRows.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">
                  {lang === "VN" ? "Chưa có policy cho loại này." : "No policies for this type yet."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-left text-xs">
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[42%]" />
                      <col className="w-18" />
                      <col className="w-28" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                        <th className="px-5 py-3">{lang === "VN" ? "Đơn vị thuê" : "Rental unit"}</th>
                        <th className="px-4 py-3">{lang === "VN" ? "Giá thuê" : "Unit price"}</th>
                        <th className="px-4 py-3">{lang === "VN" ? "Tiền tệ" : "Currency"}</th>
                        <th className="px-4 py-3 text-center">{lang === "VN" ? "Lưu" : "Save"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {groupRows.map(renderPolicyRow)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function Deck2PricingSection({ lang }) {
  const [concessionPercent, setConcessionPercent] = useState(null);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-[#124757] px-2.5 py-1 font-headline text-[10px] font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-[#124757]">
          WaterSightseeing
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <p className="text-[11px] font-medium text-slate-400">
          CABIN / RIVER / SKY
        </p>
      </div>
      <SectionLabel lang={lang} vn="GIÁ THEO GHẾ" en="PRICE BY SEAT" />
      <SeatTypesTab lang={lang} deckMode="deck2" concessionPercent={concessionPercent} />
      <SightseeingConcessionTab lang={lang} onPercentChange={setConcessionPercent} />
    </section>
  );
}

function SectionLabel({ lang, vn, en }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
      <h3 className="font-headline text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
        {lang === "VN" ? vn : en}
      </h3>
    </div>
  );
}

function SegmentedControl({ items, value, onChange, lang, fullWidth = false, variant = "primary" }) {
  if (variant === "secondary") {
    return (
      <div className={`flex gap-1 border-b border-slate-200 dark:border-slate-700 ${fullWidth ? "w-full" : ""}`}>
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`-mb-px min-w-0 px-4 py-2.5 text-center font-headline text-[11px] font-bold uppercase tracking-wider transition ${fullWidth ? "flex-1" : ""} ${active
                ? "border-b-2 border-[#124757] text-[#124757] dark:border-yellow-400 dark:text-yellow-400"
                : "border-b-2 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
            >
              {lang === "VN" ? item.vn : item.en}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-900/80 ${fullWidth ? "w-full" : "w-full sm:w-auto"}`}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`min-w-0 rounded-xl px-3.5 py-2.5 text-center font-headline text-[11px] font-black uppercase tracking-wider transition ${fullWidth ? "flex-1" : "flex-1 sm:flex-none"} ${active
              ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-[#124757]"
              : "text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
          >
            {lang === "VN" ? item.vn : item.en}
          </button>
        );
      })}
    </div>
  );
}

export function SeatTypeManagement() {
  const { lang } = useApp();
  const [mainTab, setMainTab] = useState("tickets");
  const [ticketSection, setTicketSection] = useState("seats");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 pb-10 font-body animate-fade-in sm:px-4">
      <div className="space-y-4">
        <div>
          <h2 className="font-headline text-2xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Chính sách giá" : "Fare policy"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {mainTab === "tickets"
              ? (lang === "VN" ? "Cấu hình giá vé theo loại tàu và phụ thu." : "Configure ticket prices by boat type and surcharges.")
              : (lang === "VN" ? "Giá thuê chung theo số tầng · Giờ / Ngày." : "Shared request booking rates by decks · Hour / Day.")}
          </p>
        </div>
        <SegmentedControl
          items={MAIN_TABS}
          value={mainTab}
          onChange={setMainTab}
          lang={lang}
          fullWidth
        />
      </div>

      {mainTab === "tickets" ? (
        <div className="space-y-5">
          <SegmentedControl
            items={TICKET_SECTIONS}
            value={ticketSection}
            onChange={setTicketSection}
            lang={lang}
            fullWidth
            variant="secondary"
          />

          {ticketSection === "seats" ? (
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-[#124757] px-2.5 py-1 font-headline text-[10px] font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-[#124757]">
                    Waterbus
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <p className="text-[11px] font-medium text-slate-400">
                    {lang === "VN" ? "STANDARD" : "STANDARD"}
                  </p>
                </div>
                <SectionLabel
                  lang={lang}
                  vn="Giá theo km"
                  en="Distance formula"
                />
                <div id="distance-fare-section">
                  <DistanceFareTab lang={lang} />
                </div>
              </section>

              <Deck2PricingSection lang={lang} />
            </div>
          ) : null}

          {ticketSection === "surcharge" ? (
            <div className="space-y-4">
              <SectionLabel
                lang={lang}
                vn="Phụ thu"
                en="Surcharges"
              />
              <SurchargeTab lang={lang} />
            </div>
          ) : null}
        </div>
      ) : null}

      {mainTab === "charter" ? (
        <div className="space-y-4">
          <RentalPricePoliciesTab lang={lang} />
        </div>
      ) : null}
    </div>
  );
}
