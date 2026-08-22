import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  fetchInsurancePackages,
  addInsurancePackage,
  modifyInsurancePackage,
  changeInsurancePackageStatus,
  checkWaterbusDefault,
  INSURANCE_BOOKING_TYPES,
} from "../../../services/insuranceService";
import { notify } from "../../../utils/swalToast";
import { FormSelect } from "../../../components/FormSelect";

const emptyForm = () => ({
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

const VALIDATED_FIELDS = ["code", "name", "unitPremiumAmount", "coverageAmount", "providerName", "providerLogoFile", "termsUrl", "conditions"];

const REQUIRED_FIELDS = ["code", "name", "unitPremiumAmount", "coverageAmount"];

// Field cần realtime validate (error hiện ngay khi gõ).
const REALTIME_VALIDATED_FIELDS = new Set(["unitPremiumAmount", "coverageAmount"]);

const MAX_CODE = 50;
const MAX_NAME = 150;
const MAX_PROVIDER_NAME = 150;
const MAX_URL = 2048;
const MAX_CONDITIONS = 20;
const MAX_CONDITION_TEXT = 500;
const MAX_PREMIUM = 100_000_000_000;
const MIN_PREMIUM = 1_000;
const MAX_COVERAGE = 10_000_000_000_00;
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const CODE_REGEX = /^[A-Za-z]\w*$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

const buildTouched = (fields) => {
  const next = {};
  for (const fieldName of fields) next[fieldName] = true;
  return next;
};

// Chỉ touch những field thực sự vi phạm (khi mở edit mà data cũ invalid theo rule mới).
const buildTouchedFromValidation = (formValues) => {
  const next = {};
  for (const fieldName of VALIDATED_FIELDS) {
    if (validateField(fieldName, formValues[fieldName], formValues)?.level === "error") {
      next[fieldName] = true;
    }
  }
  return next;
};

const isValidUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_URL) return false;
  return URL_REGEX.test(trimmed);
};

// VND: parse chuỗi người dùng nhập thành number.
// Chấp nhận cả "1.000.000" (có dấu chấm), "1000000" (không dấu), "1,5" -> 1 (chỉ integer).
const parseVndInput = (raw) => {
  if (raw === null || raw === undefined) return Number.NaN;
  const cleaned = String(raw).replace(/\s|\.|,/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
};

// Format số VND hiển thị theo locale vi-VN (1.000.000).
const formatVndDisplay = (value) => {
  const num = typeof value === "number" ? value : parseVndInput(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("vi-VN");
};

// Realtime auto-format VND: gõ "1000" -> "1.000" ngay trên input.
// Đơn giản đặt caret ở cuối (format lại mỗi keystroke).
const formatVndInput = (raw) => {
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

// Map bookingType (enum từ BE) sang nhãn hiển thị.
const BOOKING_TYPE_LABELS = {
  PassengerInsurance: { vn: "Bảo hiểm hành khách", en: "Passenger insurance" },
  SeatInsurance: { vn: "Bảo hiểm vé", en: "Ticket insurance" },
  CharterInsurance: { vn: "Bảo hiểm thuê tàu", en: "Charter insurance" },
};
const getBookingTypeLabel = (bookingType, lang = "VN") => {
  const entry = BOOKING_TYPE_LABELS[bookingType];
  if (!entry) return bookingType || "—";
  return lang === "VN" ? entry.vn : entry.en;
};

const validateField = (name, value, form, ctx = {}) => {
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

const formatVnd = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString("vi-VN") + "đ";
};

const isPackageActive = (pkg) => {
  if (typeof pkg?.status === "string") return pkg.status === "Active";
  return pkg?.isActive !== false;
};

export function InsuranceManagement() {
  const { lang } = useApp();
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [touched, setTouched] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [viewingPackage, setViewingPackage] = useState(null);
  const [waterbusDefaultConflict, setWaterbusDefaultConflict] = useState(null); // { hasActiveWaterbusDefault, existingPackage }

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-60 disabled:cursor-not-allowed";

  const loadPackages = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const params = {};
      if (statusFilter === "Active") params.activeOnly = true;
      const data = await fetchInsurancePackages(params);
      setPackages(data || []);
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Không tải được danh sách gói bảo hiểm." : "Failed to load insurance packages.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredPackages = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return packages
      .filter((pkg) => {
        if (statusFilter === "Active" && !isPackageActive(pkg)) return false;
        if (statusFilter === "Inactive" && isPackageActive(pkg)) return false;
        if (!keyword) return true;
        return (
          pkg.name?.toLowerCase().includes(keyword) ||
          pkg.code?.toLowerCase().includes(keyword) ||
          pkg.providerName?.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
  }, [packages, search, statusFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    const nextOrder = packages.length > 0 ? Math.max(...packages.map((p) => Number(p.displayOrder) || 0)) + 1 : 1;
    const newForm = { ...emptyForm(), displayOrder: nextOrder };
    setForm(newForm);
    setTouched({});
    setWaterbusDefaultConflict(null);
    setIsModalOpen(true);
    if (newForm.providerSource === "waterbus") {
      checkWaterbusConflict();
    }
  };

  const openEditModal = (pkg) => {
    setEditingId(pkg.id);
    const existingLogo = pkg.providerLogoUrl || "";
    const nextForm = {
      code: pkg.code || "",
      name: pkg.name || "",
      bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
      unitPremiumAmount: formatVndDisplay(pkg.unitPremiumAmount),
      coverageAmount: formatVndDisplay(pkg.coverageAmount),
      isRequired: Boolean(pkg.isRequired),
      providerSource: pkg.providerSource || "waterbus",
      providerName: pkg.providerName || "",
      providerLogoUrl: existingLogo,
      providerLogoFile: null,
      providerLogoPreview: existingLogo,
      removeLogo: false,
      conditions: Array.isArray(pkg.conditions) && pkg.conditions.length > 0 ? pkg.conditions : [""],
      termsUrl: pkg.termsUrl || "",
      status: isPackageActive(pkg) ? "Active" : "Inactive",
      displayOrder: Number(pkg.displayOrder) || 1,
    };
    setForm(nextForm);
    setWaterbusDefaultConflict(null);
    // Chỉ báo lỗi cho những field thực sự invalid (vd: data cũ vi phạm rule mới).
    // Field hợp lệ sẽ được re-validate khi user thao tác.
    setTouched(buildTouchedFromValidation(nextForm));
    // Realtime validate cho các field tiền/số — touch luôn để error hiện ngay nếu data cũ vi phạm rule.
    setTouched((prev) => {
      const next = { ...prev };
      for (const field of REALTIME_VALIDATED_FIELDS) {
        const result = validateField(field, nextForm[field], nextForm);
        if (result?.level === "error") next[field] = true;
      }
      return next;
    });
    setIsModalOpen(true);
    // Check conflict nếu là Waterbus
    if (nextForm.providerSource === "waterbus") {
      checkWaterbusConflict();
    }
  };

  const openViewModal = (pkg) => {
    setViewingPackage(pkg);
  };

  const closeViewModal = () => {
    setViewingPackage(null);
  };

  const closeModal = () => {
    if (isSaving) return;
    if (form.providerLogoPreview?.startsWith?.("blob:")) {
      URL.revokeObjectURL(form.providerLogoPreview);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setTouched({});
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (REALTIME_VALIDATED_FIELDS.has(field)) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }
    // Khi chuyển sang Waterbus → check conflict
    if (field === "providerSource" && value === "waterbus") {
      checkWaterbusConflict();
    } else if (field === "providerSource") {
      setWaterbusDefaultConflict(null);
    }
  };

  const checkWaterbusConflict = async () => {
    try {
      const result = await checkWaterbusDefault(form.bookingType);
      // Bỏ qua nếu đang edit gói đó
      const isSamePackage = editingId && result.existingPackage?.id === editingId;
      if (!isSamePackage) {
        setWaterbusDefaultConflict(result);
      } else {
        setWaterbusDefaultConflict(null);
      }
    } catch {
      setWaterbusDefaultConflict(null);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!file?.type?.startsWith("image/")) {
      notify({ icon: "warning", title: lang === "VN" ? "Logo phải là hình ảnh." : "Logo must be an image." });
      event.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      notify({ icon: "warning", title: lang === "VN" ? `Logo tối đa ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB.` : `Logo max ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB.` });
      event.target.value = "";
      return;
    }
    setForm((prev) => {
      if (prev.providerLogoPreview?.startsWith?.("blob:")) {
        URL.revokeObjectURL(prev.providerLogoPreview);
      }
      return {
        ...prev,
        providerLogoFile: file,
        providerLogoPreview: URL.createObjectURL(file),
        providerLogoUrl: "",
        removeLogo: false,
      };
    });
    setTouched((prev) => ({ ...prev, providerLogoFile: true }));
    event.target.value = "";
  };

  const removeLogo = () => {
    setForm((prev) => {
      if (prev.providerLogoPreview?.startsWith?.("blob:")) {
        URL.revokeObjectURL(prev.providerLogoPreview);
      }
      return {
        ...prev,
        providerLogoFile: null,
        providerLogoPreview: "",
        providerLogoUrl: "",
        removeLogo: true,
      };
    });
    setTouched((prev) => ({ ...prev, providerLogoFile: true }));
  };

  const updateCondition = (index, value) => {
    const safeValue = String(value ?? "").slice(0, MAX_CONDITION_TEXT);
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? safeValue : c)),
    }));
  };

  const addCondition = () => {
    setForm((prev) => {
      if (prev.conditions.length >= MAX_CONDITIONS) return prev;
      return { ...prev, conditions: [...prev.conditions, ""] };
    });
  };

  const removeCondition = (index) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.length <= 1
        ? [""]
        : prev.conditions.filter((_, i) => i !== index),
    }));
    setTouched((prev) => (prev.conditions ? prev : { ...prev, conditions: true }));
  };

  const validateForm = () => {
    const fieldNames = ["code", "name", "unitPremiumAmount", "coverageAmount", "providerName", "providerLogoFile", "termsUrl", "conditions"];
    for (const fieldName of fieldNames) {
      const result = validateField(fieldName, form[fieldName], form);
      if (result && result.level === "error") {
        return result.message;
      }
    }
    return "";
  };

  const errors = useMemo(() => {
    const fieldNames = ["code", "name", "unitPremiumAmount", "coverageAmount", "providerName", "providerLogoFile", "termsUrl", "conditions"];
    const result = {};
    for (const fieldName of fieldNames) {
      result[fieldName] = validateField(fieldName, form[fieldName], form);
    }
    return result;
  }, [form, packages, editingId]);

  const hasBlockingError = useMemo(
    () => Object.entries(errors).some(([field, e]) => e && e.level === "error" && touched[field]),
    [errors, touched],
  );

  const renderHint = (fieldName) => {
    const entry = errors[fieldName];
    if (!entry) return null;
    if (!touched[fieldName]) return null;
    const color =
      entry.level === "error"
        ? "text-red-500 dark:text-red-400"
        : "text-amber-500 dark:text-amber-400";
    const icon = entry.level === "error" ? "error" : "warning";
    return (
      <p className={`mt-1 flex items-center gap-1 text-[10px] font-bold leading-tight ${color}`}>
        <span className="material-symbols-outlined text-[14px] leading-none shrink-0">{icon}</span>
        <span>{entry.message}</span>
      </p>
    );
  };

  const inputClass = (fieldName) => {
    const entry = touched[fieldName] ? errors[fieldName] : null;
    if (entry?.level === "error") return `${inputStyle} border-red-400 focus:ring-red-300`;
    if (entry?.level === "warning") return `${inputStyle} border-amber-400 focus:ring-amber-300`;
    return inputStyle;
  };

  const buildPayload = () => {
    const commonFields = {
      name: form.name.trim(),
      bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
      unitPremiumAmount: parseVndInput(form.unitPremiumAmount),
      coverageAmount: parseVndInput(form.coverageAmount),
      isRequired: false,
      providerSource: form.providerSource || "waterbus",
      providerName: form.providerName.trim() || null,
      providerLogoUrl: form.providerLogoUrl.trim() || null,
      conditions: form.conditions.map((c) => c.trim()).filter(Boolean),
      termsUrl: form.termsUrl.trim() || null,
      status: form.status,
      isActive: form.status === "Active",
    };
    // Code chỉ gửi khi Create (BE coi code là định danh bất biến sau khi tạo).
    if (!editingId) {
      commonFields.code = form.code.trim();
    }
    // displayOrder: luôn gửi cả Create + Edit. Khi Create, nếu user chọn vị trí đã có gói khác,
    // BE sẽ tự dồn các gói xuống để nhường chỗ.
    commonFields.displayOrder = Number(form.displayOrder) || 1;

    if (form.providerLogoFile) {
      const formData = new FormData();
      Object.entries(commonFields).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") formData.append(key, String(value));
      });
      formData.append("providerLogo", form.providerLogoFile);
      if (editingId && form.providerLogoPreview) {
        formData.append("existingLogoUrl", form.providerLogoPreview);
      }
      return formData;
    }
    if (form.removeLogo) {
      return { ...commonFields, providerLogoUrl: null };
    }
    return commonFields;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setTouched(buildTouched(REQUIRED_FIELDS));
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
        text: validationError,
        confirmButtonColor: "#124757",
      });
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildPayload();
      if (
        (editingId ? false : !payload.code) ||
        !payload.name ||
        typeof payload.unitPremiumAmount !== "number" ||
        typeof payload.coverageAmount !== "number" ||
        !Number.isFinite(payload.unitPremiumAmount) ||
        !Number.isFinite(payload.coverageAmount) ||
        payload.unitPremiumAmount < MIN_PREMIUM ||
        payload.coverageAmount < MIN_PREMIUM
      ) {
        setTouched(buildTouched(REQUIRED_FIELDS));
        notify({
          icon: "warning",
          title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
          text:
            lang === "VN"
              ? "Vui lòng nhập đầy đủ Mã gói, Tên gói, Phí bảo hiểm ≥ 1 và Mức bồi thường > 0."
              : "Please fill Code, Name, Premium ≥ 1 and Coverage > 0.",
          confirmButtonColor: "#124757",
        });
        return;
      }
      if (editingId) {
        await modifyInsurancePackage(editingId, payload);
      } else {
        await addInsurancePackage(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      await loadPackages();

      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: editingId
          ? (lang === "VN" ? "Đã cập nhật gói" : "Package updated")
          : (lang === "VN" ? "Đã tạo gói" : "Package created"),
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể lưu gói bảo hiểm." : "Could not save the package."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pkg) => {
    const currentlyActive = isPackageActive(pkg);
    const nextStatus = currentlyActive ? "Inactive" : "Active";
    const nextActive = nextStatus === "Active";
    setTogglingId(pkg.id);
    setPackages((prev) => prev.map((p) => (
      p.id === pkg.id ? { ...p, status: nextStatus, isActive: nextActive } : p
    )));

    try {
      await changeInsurancePackageStatus(pkg.id, nextStatus);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: nextActive
          ? (lang === "VN" ? "Đã bật gói" : "Package activated")
          : (lang === "VN" ? "Đã tắt gói" : "Package deactivated"),
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      setPackages((prev) => prev.map((p) => (
        p.id === pkg.id
          ? { ...p, status: currentlyActive ? "Active" : "Inactive", isActive: currentlyActive }
          : p
      )));
      notify({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái gói." : "Could not update package status."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setTogglingId(null);
    }
  };
  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Quản lý gói bảo hiểm" : "Insurance Packages"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Quản lý các gói bảo hiểm hành khách"
              : "Manage passenger insurance packages"}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 text-slate-900 px-5 py-3 text-[11px] font-headline font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-md shrink-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {lang === "VN" ? "Thêm gói" : "Add package"}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "VN" ? "Tìm theo tên, mã, nhà cung cấp..." : "Search by name, code, provider..."}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400"
            />
          </div>
          <div className="relative z-10 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
            <FormSelect
              value={statusFilter}
              onChange={setStatusFilter}
              menuAlign="right"
              options={[
                { value: "all", label: lang === "VN" ? "Tất cả trạng thái" : "All Status" },
                { value: "Active", label: lang === "VN" ? "Đang bật" : "Active" },
                { value: "Inactive", label: lang === "VN" ? "Đang tắt" : "Inactive" },
              ]}
              className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50">
          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">shield</span>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {lang === "VN" ? "Chưa có gói bảo hiểm nào." : "No insurance packages yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPackages.map((pkg) => {
            const active = isPackageActive(pkg);
            return (
              <div
                key={pkg.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                      pkg.providerLogoUrl
                        ? "bg-white dark:bg-white border border-slate-200 dark:border-slate-600 p-1.5"
                        : "bg-[#124757]/10 dark:bg-yellow-400/10"
                    }`}>
                      {pkg.providerLogoUrl ? (
                        <img src={pkg.providerLogoUrl} alt={pkg.providerName || pkg.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">shield</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline font-black text-sm text-slate-800 dark:text-white truncate">{pkg.name}</h3>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          pkg.providerSource === "third_party"
                            ? "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20"
                            : "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20"
                        }`}>
                          <span className="material-symbols-outlined text-[9px]">{pkg.providerSource === "third_party" ? "business" : "directions_boat"}</span>
                          {pkg.providerSource === "third_party"
                            ? (lang === "VN" ? "Bên thứ 3" : "3rd party")
                            : "Waterbus"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">{pkg.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openViewModal(pkg)}
                      aria-label={lang === "VN" ? "Xem chi tiết" : "View details"}
                      title={lang === "VN" ? "Xem chi tiết" : "View details"}
                      className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all inline-flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-base">info</span>
                    </button>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      active
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                        : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {active ? (lang === "VN" ? "Hoạt động" : "Active") : (lang === "VN" ? "Không hoạt động" : "Inactive")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Phí / khách" : "Fee / passenger"}
                    </p>
                    <p className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400 mt-1">
                      {formatVnd(pkg.unitPremiumAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Mức bồi thường" : "Coverage"}
                    </p>
                    <p className="text-sm font-headline font-black text-slate-700 dark:text-slate-200 mt-1">
                      {formatVnd(pkg.coverageAmount)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(pkg)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    {lang === "VN" ? "Sửa" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(pkg)}
                    disabled={togglingId === pkg.id}
                    className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                      active
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}
                  >
                    {togglingId === pkg.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-sm">{active ? "toggle_off" : "toggle_on"}</span>
                    )}
                    {active
                      ? (lang === "VN" ? "Tắt gói" : "Turn off")
                      : (lang === "VN" ? "Bật gói" : "Turn on")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div key={editingId || "create"} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={closeModal}
            disabled={isSaving}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 bg-white dark:bg-slate-800 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Gói bảo hiểm" : "Insurance package"}
                </p>
                <h3 className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                  {editingId ? (lang === "VN" ? "Sửa gói bảo hiểm" : "Edit package") : (lang === "VN" ? "Thêm gói bảo hiểm" : "Add package")}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

<div className="p-6 space-y-5">
              {/* Row 1: Mã gói + Tên gói */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Mã gói" : "Code"}</label>
                  <input
                    value={form.code}
                    onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                    onBlur={() => handleBlur("code")}
                    readOnly={!!editingId}
                    className={inputClass("code") + " uppercase tracking-wider" + (editingId ? " bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed text-slate-500" : "")}
                    placeholder="CODE"
                    maxLength={MAX_CODE}
                    spellCheck={false}
                    autoCapitalize="characters"
                    title={editingId ? (lang === "VN" ? "Mã gói không thể thay đổi sau khi tạo." : "Code is read-only after creation.") : undefined}
                  />
                  {renderHint("code")}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelStyle}>{lang === "VN" ? "Tên gói" : "Name"}</label>
                  <input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    className={inputClass("name")}
                    placeholder={lang === "VN" ? "Tên bảo hiểm" : "Insurance name"}
                    maxLength={MAX_NAME}
                  />
                  {renderHint("name")}
                </div>
              </div>

              {/* Row 2: Phí + Mức bồi thường */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Phí mỗi khách (VND)" : "Fee per passenger (VND)"}</label>
                  <input
                    inputMode="numeric"
                    value={form.unitPremiumAmount}
                    onChange={(e) => updateField("unitPremiumAmount", formatVndInput(e.target.value))}
                    onInput={(e) => updateField("unitPremiumAmount", formatVndInput(e.target.value))}
                    onBlur={() => handleBlur("unitPremiumAmount")}
                    className={inputClass("unitPremiumAmount")}
                    placeholder={lang === "VN" ? `Tối thiểu ${MIN_PREMIUM.toLocaleString("vi-VN")}` : `Min ${MIN_PREMIUM.toLocaleString("vi-VN")}`}
                  />
                  {renderHint("unitPremiumAmount")}
                </div>
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Mức bồi thường (VND)" : "Coverage amount (VND)"}</label>
                  <input
                    inputMode="numeric"
                    value={form.coverageAmount}
                    onChange={(e) => updateField("coverageAmount", formatVndInput(e.target.value))}
                    onInput={(e) => updateField("coverageAmount", formatVndInput(e.target.value))}
                    onBlur={() => handleBlur("coverageAmount")}
                    className={inputClass("coverageAmount")}
                    placeholder={lang === "VN" ? `Tối thiểu ${MIN_PREMIUM.toLocaleString("vi-VN")}` : `Min ${MIN_PREMIUM.toLocaleString("vi-VN")}`}
                  />
                  {renderHint("coverageAmount")}
                </div>
              </div>

              {/* Row 3: Trạng thái */}
              <div>
                  <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                    {[
                      { value: "Active", labelVn: "Bật", labelEn: "Active" },
                      { value: "Inactive", labelVn: "Tắt", labelEn: "Inactive" },
                    ].map((option) => {
                      const selected = form.status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateField("status", option.value)}
                          className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${
                            selected
                              ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                              : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {lang === "VN" ? option.labelVn : option.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

              {/* Section: Nhà cung cấp + Logo */}
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-700/70 dark:bg-slate-900/40 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                  <span className="material-symbols-outlined text-base text-slate-400">storefront</span>
                  <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {lang === "VN" ? "Nhà cung cấp bảo hiểm" : "Insurance provider"}
                  </span>
                </div>

                {/* Nguồn nhà cung cấp */}
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Nguồn cung cấp" : "Provider source"}</label>
                  <div className="flex gap-2 mt-1">
                    {[
                      { value: "waterbus", labelVn: "Waterbus", labelEn: "Waterbus", icon: "directions_boat" },
                      { value: "third_party", labelVn: "Bên thứ 3", labelEn: "Third party", icon: "business" },
                    ].map((opt) => {
                      const isActive = form.providerSource === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateField("providerSource", opt.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border-2 font-headline font-black text-[10px] uppercase tracking-wide transition-all ${isActive
                            ? "bg-[#124757] border-[#124757] text-white dark:bg-yellow-400 dark:border-yellow-400 dark:text-slate-900"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                          {lang === "VN" ? opt.labelVn : opt.labelEn}
                        </button>
                      );
                    })}
                  </div>
                  {/* Warning: đã có gói Waterbus default active */}
                  {waterbusDefaultConflict?.hasActiveWaterbusDefault && (
                    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-base shrink-0">warning</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-snug">
                            {lang === "VN"
                              ? "Đã có gói Waterbus mặc định cho loại vé này."
                              : "A default Waterbus package already exists for this booking type."}
                          </p>
                          {waterbusDefaultConflict.existingPackage && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                              {waterbusDefaultConflict.existingPackage.name}
                              {" — "}
                              {formatVnd(waterbusDefaultConflict.existingPackage.unitPremiumAmount)}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              closeModal();
                              if (waterbusDefaultConflict.existingPackage?.id) {
                                setTimeout(() => openEditModal(waterbusDefaultConflict.existingPackage), 100);
                              }
                            }}
                            className="mt-1.5 text-[10px] font-black text-[#124757] dark:text-yellow-400 hover:underline uppercase tracking-wide"
                          >
                            {lang === "VN" ? "→ Sửa gói hiện tại" : "→ Edit existing package"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Tên nhà cung cấp" : "Provider name"}</label>
                  <input
                    value={form.providerName}
                    onChange={(e) => updateField("providerName", e.target.value)}
                    onBlur={() => handleBlur("providerName")}
                    className={inputClass("providerName")}
                    maxLength={MAX_PROVIDER_NAME}
                    placeholder={lang === "VN" ? "Tên nhà cung cấp" : "Provider name"}
                  />
                  {renderHint("providerName")}
                </div>

                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Logo nhà cung cấp" : "Provider logo"}</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="h-28 w-28 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden flex items-center justify-center transition-all hover:border-slate-300 dark:hover:border-slate-600">
                      {form.providerLogoPreview ? (
                        <img src={form.providerLogoPreview} alt="logo" className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                          <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-1">No logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600">
                          <span className="material-symbols-outlined text-base">upload</span>
                          {(() => {
                            if (!form.providerLogoPreview) return lang === "VN" ? "Tải ảnh lên" : "Upload";
                            return lang === "VN" ? "Đổi ảnh" : "Change";
                          })()}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={handleLogoChange}
                          />
                        </label>
                        {form.providerLogoPreview && (
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            {lang === "VN" ? "Xóa" : "Remove"}
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                        {lang === "VN"
                          ? `Định dạng JPG, PNG, WEBP hoặc SVG. Dung lượng tối đa ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB`
                          : `JPG, PNG, WEBP or SVG. Max ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB. Square image with transparent background recommended.`}
                      </span>
                    </div>
                  </div>
                  {renderHint("providerLogoFile")}
                </div>
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Điều khoản (URL)" : "Terms (URL)"}</label>
                <input
                  value={form.termsUrl}
                  onChange={(e) => updateField("termsUrl", e.target.value)}
                  onBlur={() => handleBlur("termsUrl")}
                  className={inputClass("termsUrl")}
                  placeholder=" "
                  maxLength={MAX_URL}
                />
                {renderHint("termsUrl")}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {lang === "VN" ? `Điều kiện áp dụng (${form.conditions.length}/${MAX_CONDITIONS})` : `Conditions (${form.conditions.length}/${MAX_CONDITIONS})`}
                  </label>
                  <button
                    type="button"
                    onClick={addCondition}
                    disabled={form.conditions.length >= MAX_CONDITIONS}
                    className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    {lang === "VN" ? "Thêm" : "Add"}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.conditions.map((condition, index) => (
                    <div key={`condition-${index}`} className="flex gap-2">
                      <input
                        value={condition}
                        onChange={(e) => updateCondition(index, e.target.value)}
                        onBlur={() => handleBlur("conditions")}
                        className={inputStyle}
                        placeholder={lang === "VN" ? "Nhập điều kiện áp dụng" : "Enter condition"}
                        maxLength={MAX_CONDITION_TEXT}
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="px-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                {renderHint("conditions")}
              </div>

            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 bg-white sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || hasBlockingError || !!waterbusDefaultConflict?.hasActiveWaterbusDefault}
                className="rounded-2xl bg-[#124757] px-6 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300 inline-flex items-center justify-center gap-2"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {editingId ? (lang === "VN" ? "Lưu thay đổi" : "Save changes") : (lang === "VN" ? "Tạo gói" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPackage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={closeViewModal}
          />
          <div className="relative my-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 bg-white dark:bg-slate-800 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Gói bảo hiểm" : "Insurance package"}
                </p>
                <h3 className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? "Chi tiết gói" : "Package details"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeViewModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Header: logo + name + status */}
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
                  viewingPackage.providerLogoUrl
                    ? "bg-white dark:bg-white border border-slate-200 dark:border-slate-600 p-1.5"
                    : "bg-[#124757]/10 dark:bg-yellow-400/10"
                }`}>
                  {viewingPackage.providerLogoUrl ? (
                    <img src={viewingPackage.providerLogoUrl} alt={viewingPackage.providerName || viewingPackage.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-[#124757] dark:text-yellow-400">shield</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-headline font-black text-base text-slate-800 dark:text-white">{viewingPackage.name}</h4>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      viewingPackage.providerSource === "third_party"
                        ? "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20"
                        : "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20"
                    }`}>
                      <span className="material-symbols-outlined text-[9px]">{viewingPackage.providerSource === "third_party" ? "business" : "directions_boat"}</span>
                      {viewingPackage.providerSource === "third_party"
                        ? (lang === "VN" ? "Bên thứ 3" : "3rd party")
                        : "Waterbus"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">{viewingPackage.code}</p>
                  <span className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    (viewingPackage.status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                      : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      (viewingPackage.status || "").toLowerCase() === "active" ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {(viewingPackage.status || "").toLowerCase() === "active"
                      ? (lang === "VN" ? "Hoạt động" : "Active")
                      : (lang === "VN" ? "Không hoạt động" : "Inactive")}
                  </span>
                </div>
              </div>

              {/* Fees row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Phí / khách" : "Fee / passenger"}
                  </p>
                  <p className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400 mt-1">
                    {formatVnd(viewingPackage.unitPremiumAmount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Mức bồi thường" : "Coverage"}
                  </p>
                  <p className="text-sm font-headline font-black text-slate-700 dark:text-slate-200 mt-1">
                    {formatVnd(viewingPackage.coverageAmount)}
                  </p>
                </div>
              </div>

              {/* Provider */}
              <div>
                <p className={labelStyle}>{lang === "VN" ? "Nhà cung cấp" : "Provider"}</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{viewingPackage.providerName || "—"}</p>
              </div>

              {/* Terms URL */}
              {viewingPackage.termsUrl && (
                <div>
                  <p className={labelStyle}>{lang === "VN" ? "Điều khoản" : "Terms"}</p>
                  <a
                    href={viewingPackage.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#124757] dark:text-yellow-400 hover:underline break-all"
                  >
                    {viewingPackage.termsUrl}
                  </a>
                </div>
              )}

              {/* Conditions */}
              <div>
                <p className={labelStyle}>{lang === "VN" ? "Điều kiện áp dụng" : "Conditions"}</p>
                {Array.isArray(viewingPackage.conditions) && viewingPackage.conditions.length > 0 ? (
                  <ul className="space-y-2">
                    {viewingPackage.conditions
                      .map((c) => (typeof c === "string" ? c : c?.text))
                      .filter(Boolean)
                      .map((text, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3"
                        >
                          <span className="material-symbols-outlined text-lg leading-none text-[#124757] dark:text-yellow-400 shrink-0 self-start -mt-px">check_circle</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{text}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
