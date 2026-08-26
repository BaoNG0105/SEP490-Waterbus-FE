import { INSURANCE_BOOKING_TYPES } from "../services/insuranceService";

// Helpers, constants và validation dùng chung cho form tạo/sửa gói bảo hiểm
// (trang Admin/InsuranceManagement: index.jsx, InsuranceFormModal.jsx).

export const emptyForm = () => ({
  code: "",
  name: "",
  bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
  unitPremiumAmount: "",
  coverageAmount: "",
  isRequired: false,
  providerSource: "waterbus",
  providerName: "",
  providerLogoUrl: "",
  providerLogoFile: null,
  providerLogoPreview: "",
  removeLogo: false,
  conditions: [""],
  termsUrl: "",
  status: "Active",
  displayOrder: 1,
});

export const VALIDATED_FIELDS = ["code", "name", "unitPremiumAmount", "coverageAmount", "providerName", "providerLogoFile", "termsUrl", "conditions"];

export const REQUIRED_FIELDS = ["code", "name", "unitPremiumAmount", "coverageAmount"];

// Field cần realtime validate (error hiện ngay khi gõ).
export const REALTIME_VALIDATED_FIELDS = new Set(["unitPremiumAmount", "coverageAmount"]);

export const MAX_CODE = 50;
export const MAX_NAME = 150;
export const MAX_PROVIDER_NAME = 150;
export const MAX_URL = 2048;
export const MAX_CONDITIONS = 20;
export const MAX_CONDITION_TEXT = 500;
export const MAX_PREMIUM = 100_000_000_000;
export const MIN_PREMIUM = 1_000;
export const MAX_COVERAGE = 10_000_000_000_00;
export const MAX_LOGO_SIZE = 5 * 1024 * 1024;
export const CODE_REGEX = /^[A-Za-z]\w*$/;
export const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
export const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-60 disabled:cursor-not-allowed";

export const buildTouched = (fields) => {
  const next = {};
  for (const fieldName of fields) next[fieldName] = true;
  return next;
};

// Chỉ touch những field thực sự vi phạm (khi mở edit mà data cũ invalid theo rule mới).
export const buildTouchedFromValidation = (formValues) => {
  const next = {};
  for (const fieldName of VALIDATED_FIELDS) {
    if (validateField(fieldName, formValues[fieldName], formValues)?.level === "error") {
      next[fieldName] = true;
    }
  }
  return next;
};

export const isValidUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_URL) return false;
  return URL_REGEX.test(trimmed);
};

// VND: parse chuỗi người dùng nhập thành number.
// Chấp nhận cả "1.000.000" (có dấu chấm), "1000000" (không dấu), "1,5" -> 1 (chỉ integer).
export const parseVndInput = (raw) => {
  if (raw === null || raw === undefined) return Number.NaN;
  const cleaned = String(raw).replace(/\s|\.|,/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
};

// Format số VND hiển thị theo locale vi-VN (1.000.000).
export const formatVndDisplay = (value) => {
  const num = typeof value === "number" ? value : parseVndInput(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("vi-VN");
};

// Realtime auto-format VND: gõ "1000" -> "1.000" ngay trên input.
// Đơn giản đặt caret ở cuối (format lại mỗi keystroke).
export const formatVndInput = (raw) => {
  if (raw === null || raw === undefined) return "";
  const digits = String(raw).split("").filter((c) => c >= "0" && c <= "9").join("");
  if (!digits) return "";
  // Nhóm 3 số từ phải sang trái, phân cách bằng dấu chấm.
  const out = [];
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out.push(".");
    out.push(digits[i]);
  }
  return out.join("");
};

export const validateField = (name, value, form = {}) => {
  const stringValue = String(value ?? "");
  switch (name) {
    case "code": {
      const trimmed = stringValue.trim();
      if (!trimmed) return { level: "error", message: "Vui lòng nhập mã gói." };
      if (trimmed.length > MAX_CODE) return { level: "error", message: `Mã gói không được vượt quá ${MAX_CODE} ký tự.` };
      if (!CODE_REGEX.test(trimmed)) return { level: "error", message: "Mã gói chỉ gồm chữ cái, số, gạch dưới và bắt đầu bằng chữ cái." };
      return null;
    }
    case "name": {
      const trimmed = stringValue.trim();
      if (!trimmed) return { level: "error", message: "Vui lòng nhập tên gói bảo hiểm." };
      if (trimmed.length > MAX_NAME) return { level: "error", message: `Tên gói không được vượt quá ${MAX_NAME} ký tự.` };
      return null;
    }
    case "unitPremiumAmount": {
      const num = parseVndInput(stringValue);
      if (!Number.isFinite(num) || !stringValue.trim()) return { level: "error", message: `Phí bảo hiểm phải từ ${MIN_PREMIUM.toLocaleString("vi-VN")} VND trở lên.` };
      if (num < MIN_PREMIUM) return { level: "error", message: `Phí bảo hiểm phải từ ${MIN_PREMIUM.toLocaleString("vi-VN")} VND trở lên.` };
      if (num > MAX_PREMIUM) return { level: "error", message: `Phí bảo hiểm không được vượt quá ${MAX_PREMIUM.toLocaleString("vi-VN")} VND.` };
      return null;
    }
    case "coverageAmount": {
      const num = parseVndInput(stringValue);
      if (!Number.isFinite(num) || !stringValue.trim()) return { level: "error", message: `Mức bồi thường phải từ ${MIN_PREMIUM.toLocaleString("vi-VN")} VND trở lên.` };
      if (num < MIN_PREMIUM) return { level: "error", message: `Mức bồi thường phải từ ${MIN_PREMIUM.toLocaleString("vi-VN")} VND trở lên.` };
      if (num > MAX_COVERAGE) return { level: "error", message: `Mức bồi thường không được vượt quá ${MAX_COVERAGE.toLocaleString("vi-VN")} VND.` };
      const fee = parseVndInput(form?.unitPremiumAmount);
      if (Number.isFinite(fee) && fee >= MIN_PREMIUM && num < fee) {
        return { level: "warning", message: `Mức bồi thường (${num.toLocaleString("vi-VN")}) thấp hơn phí mỗi khách (${fee.toLocaleString("vi-VN")}).` };
      }
      return null;
    }
    case "providerName": {
      const trimmed = stringValue.trim();
      if (trimmed.length > MAX_PROVIDER_NAME) return { level: "error", message: `Tên nhà cung cấp không vượt quá ${MAX_PROVIDER_NAME} ký tự.` };
      const hasLogo = !!form?.providerLogoFile || !!form?.providerLogoPreview;
      if (hasLogo && !trimmed) {
        return { level: "error", message: "Vui lòng nhập tên nhà cung cấp khi đã có logo." };
      }
      return null;
    }
    case "providerLogoFile": {
      const file = value instanceof File ? value : null;
      if (!file) return null;
      if (!file?.type?.startsWith("image/")) return { level: "error", message: "Logo phải là định dạng hình ảnh (JPG, PNG, WEBP)." };
      if (file.size > MAX_LOGO_SIZE) return { level: "error", message: `Logo không được vượt quá ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB.` };
      return null;
    }
    case "termsUrl": {
      const trimmed = stringValue.trim();
      if (!trimmed) return null;
      if (trimmed.length > MAX_URL) return { level: "error", message: `Đường dẫn không được vượt quá ${MAX_URL} ký tự.` };
      if (!isValidUrl(trimmed)) return { level: "error", message: "Vui lòng nhập đúng định dạng URL (https://...)." };
      return null;
    }
    case "conditions": {
      const list = Array.isArray(value) ? value : [];
      if (list.length > MAX_CONDITIONS) return { level: "error", message: `Tối đa ${MAX_CONDITIONS} điều kiện.` };
      for (let i = 0; i < list.length; i += 1) {
        const item = String(list[i] ?? "").trim();
        if (item.length > MAX_CONDITION_TEXT) {
          return { level: "error", message: `Điều kiện #${i + 1} không vượt quá ${MAX_CONDITION_TEXT} ký tự.` };
        }
      }
      return null;
    }
    default:
      return null;
  }
};