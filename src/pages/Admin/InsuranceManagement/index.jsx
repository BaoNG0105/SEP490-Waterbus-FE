import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ExternalLink, Landmark, ShieldCheck, X } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import {
  fetchInsurancePackages,
  addInsurancePackage,
  modifyInsurancePackage,
  uploadInsurancePackageImage,
  changeInsurancePackageStatus,
  checkWaterbusDefault,
  getInsurancePackageId,
  getInsuranceProviderLogoUrl,
  INSURANCE_BOOKING_TYPES,
} from "../../../services/insuranceService";
import { notify } from "../../../utils/swalToast";
import { FormSelect } from "../../../components/FormSelect";
import { InsuranceFormModal } from "./InsuranceFormModal";
import {
  emptyForm,
  VALIDATED_FIELDS,
  REALTIME_VALIDATED_FIELDS,
  MIN_PREMIUM,
  MAX_LOGO_SIZE,
  MAX_CONDITIONS,
  MAX_CONDITION_TEXT,
  inputStyle,
  buildTouched,
  buildTouchedFromValidation,
  findDuplicateInsuranceCode,
  validateField,
  parseVndInput,
  formatVndDisplay,
  normalizeInsuranceName,
} from "../../../utils/insurancePackageForm";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

// Map bookingType (enum từ BE) sang nhãn hiển thị.
const BOOKING_TYPE_LABELS = {
  PassengerInsurance: { vn: "Bảo hiểm hành khách", en: "Passenger insurance" },
  SeatInsurance: { vn: "Bảo hiểm vé", en: "Ticket insurance" },
  CharterInsurance: { vn: "Bảo hiểm thuê tàu", en: "Charter insurance" },
};
// const getBookingTypeLabel = (bookingType, lang = "VN") => {
//   const entry = BOOKING_TYPE_LABELS[bookingType];
//   if (!entry) return bookingType || "—";
//   return lang === "VN" ? entry.vn : entry.en;
// };

const formatVnd = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString("vi-VN") + "đ";
};

const isPackageActive = (pkg) => {
  if (typeof pkg?.status === "string") return pkg.status === "Active";
  return pkg?.isActive !== false;
};

function InsuranceLogo({ src, alt, className, fallback }) {
  const [hasError, setHasError] = useState(false);
  if (!src || hasError) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`select-none ${className}`}
      onDragStart={(event) => event.preventDefault()}
      onError={() => setHasError(true)}
    />
  );
}

export function InsuranceManagement() {
  const { lang } = useApp();
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerTypeFilter, setProviderTypeFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [touched, setTouched] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [viewingPackage, setViewingPackage] = useState(null);
  const [waterbusDefaultConflict, setWaterbusDefaultConflict] = useState(null); // { hasActiveWaterbusDefault, existingPackage }

  const loadPackages = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      // Luôn lấy cả Active/Inactive để kiểm tra trùng mã chính xác; UI tự lọc bên dưới.
      const params = { activeOnly: false };
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
        if (providerTypeFilter === "waterbus" && pkg.isWaterbusDefault !== true) return false;
        if (providerTypeFilter === "third_party" && pkg.isWaterbusDefault === true) return false;
        if (!keyword) return true;
        return (
          pkg.name?.toLowerCase().includes(keyword) ||
          pkg.code?.toLowerCase().includes(keyword) ||
          pkg.providerName?.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
  }, [packages, search, statusFilter, providerTypeFilter]);

  // Phát hiện nhiều gói Waterbus default Active cùng lúc (vi phạm constraint "chỉ 1 gói Waterbus mặc định").
  // Mục đích: cảnh báo user khi mở form / save. KHÔNG khóa thao tác trên list.
  const waterbusDuplicates = useMemo(() => {
    return packages.filter(
      (pkg) => pkg.isWaterbusDefault === true && isPackageActive(pkg),
    );
  }, [packages]);

  const hasDuplicateWaterbus = waterbusDuplicates.length > 1;

  // Trả về các gói Waterbus default Active khác (loại trừ chính gói đang edit).
  const findOtherActiveWaterbusDefaults = (excludeId) => {
    return waterbusDuplicates.filter(
      (pkg) => String(pkg.id ?? pkg.insurancePackageId) !== String(excludeId || ""),
    );
  };

  /**
   * Parse lỗi từ BE — chỉ dùng nội bộ để detect duplicate Waterbus default.
   * KHÔNG hiển thị raw message cho khách hàng.
   * @returns {{ isDuplicateDefault: boolean }}
   */
  const detectDuplicateDefault = (error) => {
    const data = error?.response?.data || {};
    const status = error?.response?.status;
    if (status !== 400) return { isDuplicateDefault: false };

    const collected = [];
    if (data.errors && typeof data.errors === "object") {
      Object.values(data.errors).forEach((val) => {
        if (Array.isArray(val)) collected.push(...val);
        else if (val) collected.push(val);
      });
    }
    if (data.message) collected.push(data.message);
    if (data.title) collected.push(data.title);

    const text = collected.join(" | ").toLowerCase();
    // Detect duplicate bảo hiểm mặc định — không quan tâm field name kỹ thuật.
    const isDuplicateDefault =
      /default/.test(text) &&
      (/waterbus/.test(text) || /đã có.*mặc định/.test(text) || /already.*active.*default/.test(text));

    return { isDuplicateDefault };
  };

  /**
   * Pre-check duplicate bảo hiểm mặc định trước khi submit (áp dụng cho cả Create và Edit).
   * Trả về `true` nếu OK để tiếp tục submit; `false` nếu đã show dialog chặn lại.
   *
   * Lý do tách: flow Edit có thể đổi gói ThirdParty → Waterbus (làm cho isWaterbusDefault=true)
   * hoặc đổi status Inactive → Active. Cả 2 trường hợp đều phải pre-check giống nhau để khách hàng
   * không phải chờ BE reject mới biết.
   *
   * @returns {Promise<boolean>} true nếu không có conflict, false nếu đã chặn.
   */
  const ensureNoActiveDefault = async ({ payload, excludeId }) => {
    // Chỉ quan tâm khi payload yêu cầu: là Waterbus default + đang được bật.
    if (payload.isWaterbusDefault !== true || payload.isActive !== true) {
      return true;
    }
    try {
      const check = await checkWaterbusDefault(payload.bookingType);
      // Tìm các gói trùng (loại trừ chính gói đang edit nếu có).
      const conflicting = (check?.existingPackage ? [check.existingPackage] : [])
        .filter((other) => String(other?.id ?? other?.insurancePackageId) !== String(excludeId || ""));
      if (check?.hasActiveWaterbusDefault && conflicting.length > 0) {
        setWaterbusDefaultConflict({
          hasActiveWaterbusDefault: true,
          existingPackage: conflicting[0] || null,
          duplicates: conflicting,
        });
        showDuplicateDefaultDialog({ duplicates: conflicting });
        return false;
      }
    } catch (checkErr) {
      // Check lỗi → tin tưởng BE validate khi submit. Không chặn UX ở đây.
      console.warn("Không check được duplicate trước khi submit, tiếp tục gửi request:", checkErr);
    }
    return true;
  };

  /**
   * Dialog thông báo gọn cho khách hàng:
   * - Tiêu đề: vì sao bị chặn
   * - Danh sách gói cần tắt (nếu có)
   * - Hướng dẫn 1 dòng
   * KHÔNG hiển thị field name, raw message, hay chi tiết kỹ thuật từ BE.
   */
  const showDuplicateDefaultDialog = ({ duplicates }) => {
    const dupList = (duplicates || []).map((pkg) => `
      <li style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1px solid #fcd34d;border-radius:8px;font-size:13px;">
        <span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;">
          <span style="color:#0f172a;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(pkg.name || "")}</span>
          <span style="color:#64748b;font-size:11px;font-family:monospace;">${escapeHtml(pkg.code || "")}</span>
        </span>
        <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;flex-shrink:0;">
          ${lang === "VN" ? "Đang bật" : "Active"}
        </span>
      </li>
    `).join("");

    const html = `
      <div style="text-align:left;font-family:inherit;">
        <p style="margin:0 0 12px 0;color:#0f172a;font-size:14px;line-height:1.55;">
          ${lang === "VN"
            ? "Hiện đã có một gói bảo hiểm mặc định đang hoạt động. Bạn cần <strong>tắt gói đó</strong> trước khi bật gói khác làm mặc định."
            : "A default insurance package is already active. Please <strong>turn it off</strong> before enabling another as the default."}
        </p>
        ${dupList ? `
          <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">
            ${lang === "VN" ? "Gói cần tắt" : "Package to turn off"}
          </p>
          <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;">
            ${dupList}
          </ul>
        ` : ""}
      </div>
    `;

    notify({
      dialog: true,
      icon: "warning",
      tone: "warning",
      title: lang === "VN"
        ? "Đã có gói bảo hiểm mặc định đang hoạt động"
        : "A default insurance package is already active",
      html,
      confirmButtonText: lang === "VN" ? "Đóng" : "Close",
      width: 460,
    });
  };

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
    const existingLogo = getInsuranceProviderLogoUrl(pkg);
    const isWaterbus = pkg.isWaterbusDefault === true
      || pkg.providerSource === "Waterbus"
      || pkg.providerSource === "waterbus";
    const nextForm = {
      code: pkg.code || "",
      name: pkg.name || "",
      bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
      unitPremiumAmount: formatVndDisplay(pkg.unitPremiumAmount),
      coverageAmount: formatVndDisplay(pkg.coverageAmount),
      isRequired: Boolean(pkg.isRequired),
      providerSource: isWaterbus ? "waterbus" : "third_party",
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
    setTouched(buildTouchedFromValidation(nextForm, { packages, editingId: pkg.id }));
    // Realtime validate cho các field tiền/số — touch luôn để error hiện ngay nếu data cũ vi phạm rule.
    setTouched((prev) => {
      const next = { ...prev };
      for (const field of REALTIME_VALIDATED_FIELDS) {
        const result = validateField(field, nextForm[field], nextForm, { packages, editingId: pkg.id });
        if (result?.level === "error") next[field] = true;
      }
      return next;
    });
    setIsModalOpen(true);
    // Check conflict nếu là Waterbus. Truyền pkg.id trực tiếp vì setEditingId là async,
    // đọc editingId qua closure tại đây sẽ ra giá trị cũ.
    if (nextForm.providerSource === "waterbus") {
      checkWaterbusConflict(pkg.id);
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
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-fill providerName when switching to Waterbus (only if currently empty)
      if (field === "providerSource" && value === "waterbus" && !prev.providerName.trim()) {
        next.providerName = "Waterbus";
      }
      return next;
    });
    // Khi người dùng đã sửa một field cần validate, báo lỗi ngay nếu giá trị trở thành
    // không hợp lệ hoặc bị xóa. Form mới mở vẫn không đỏ hàng loạt.
    if (VALIDATED_FIELDS.includes(field) || REALTIME_VALIDATED_FIELDS.has(field)) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }
    // Trigger check conflict khi:
    // - Chuyển sang Waterbus
    // - Đổi status sang Active (vì gói Waterbus + Active mới = có thể gây duplicate)
    if (field === "providerSource" && value === "waterbus") {
      checkWaterbusConflict();
    } else if (field === "providerSource") {
      setWaterbusDefaultConflict(null);
    } else if (field === "status" && value === "Active") {
      // Check dựa trên form state hiện tại (sau khi set xong) → cần dùng setForm callback.
      setForm((prev) => {
        if (prev.providerSource === "waterbus") {
          checkWaterbusConflict();
        }
        return prev;
      });
    } else if (field === "status" && value === "Inactive") {
      setWaterbusDefaultConflict(null);
    }
  };

  const checkWaterbusConflict = (excludeIdOverride) => {
    // Check từ packages đã load (BE đánh dấu Waterbus default qua isWaterbusDefault).
    // Tìm gói Waterbus default Active KHÁC gói đang edit. Cho phép truyền overrideId
    // để xử lý trường hợp state editingId chưa cập nhật xong (setEditingId là async).
    const excludeId = excludeIdOverride ?? editingId;
    const otherActiveWaterbus = findOtherActiveWaterbusDefaults(excludeId);
    if (otherActiveWaterbus.length === 0) {
      setWaterbusDefaultConflict({ hasActiveWaterbusDefault: false, existingPackage: null });
      return;
    }
    // Lấy gói đầu tiên làm đại diện (UI chỉ cần 1 để hiển thị link "Sửa gói hiện tại").
    const existing = otherActiveWaterbus[0];
    setWaterbusDefaultConflict({
      hasActiveWaterbusDefault: true,
      existingPackage: existing,
      // Kèm danh sách đầy đủ để user biết có bao nhiêu gói trùng.
      duplicates: otherActiveWaterbus,
    });
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
    for (const fieldName of VALIDATED_FIELDS) {
      const result = validateField(fieldName, form[fieldName], form, { packages, editingId });
      if (result && result.level === "error") {
        return result.message;
      }
    }
    return "";
  };

  const errors = useMemo(() => {
    const result = {};
    for (const fieldName of VALIDATED_FIELDS) {
      result[fieldName] = validateField(fieldName, form[fieldName], form, { packages, editingId });
    }
    return result;
  }, [editingId, form, packages]);

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
    const entry = errors[fieldName];
    if (entry?.level === "error") return `${inputStyle} !border-red-500 !bg-red-50/50 focus:!ring-red-300 dark:!bg-red-500/10`;
    if (entry?.level === "warning") return `${inputStyle} !border-amber-400 focus:!ring-amber-300`;
    return inputStyle;
  };

  const buildPayload = () => {
    const sourceKey = form.providerSource === "third_party" ? "ThirdParty" : "Waterbus";
    // DEBUG: trace state khi payload được build
    if (typeof window !== "undefined" && window.console) {
      console.debug("[InsuranceManagement] buildPayload:", {
        formProviderSource: form.providerSource,
        derivedSourceKey: sourceKey,
        formStatus: form.status,
        formName: form.name,
        editingId,
      });
    }
    const commonFields = {
      name: normalizeInsuranceName(form.name),
      bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
      unitPremiumAmount: parseVndInput(form.unitPremiumAmount),
      coverageAmount: parseVndInput(form.coverageAmount),
      isRequired: false,
      providerSource: sourceKey,
      isWaterbusDefault: sourceKey === "Waterbus",
      providerName: normalizeInsuranceName(form.providerName) || null,
      // Giữ nguyên URL hiện tại khi chỉ sửa thông tin gói; upload mới sẽ thay imageUrl
      // bằng URL Cloudinary sau khi request update thành công.
      providerLogoUrl: form.providerLogoUrl?.trim() || null,
      imageUrl: form.providerLogoUrl?.trim() || null,
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

    if (form.removeLogo) {
      const payload = { ...commonFields, providerLogoUrl: null, imageUrl: null };
      return { requestPayload: payload, validationPayload: payload, logoFile: null };
    }
    return {
      requestPayload: commonFields,
      validationPayload: commonFields,
      logoFile: form.providerLogoFile,
    };
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setTouched(buildTouched(VALIDATED_FIELDS));
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
      const { requestPayload, validationPayload, logoFile } = buildPayload();
      if (
        (editingId ? false : !validationPayload.code) ||
        !validationPayload.name ||
        typeof validationPayload.unitPremiumAmount !== "number" ||
        typeof validationPayload.coverageAmount !== "number" ||
        !Number.isFinite(validationPayload.unitPremiumAmount) ||
        !Number.isFinite(validationPayload.coverageAmount) ||
        validationPayload.unitPremiumAmount < MIN_PREMIUM ||
        validationPayload.coverageAmount < MIN_PREMIUM
      ) {
        setTouched(buildTouched(VALIDATED_FIELDS));
        notify({
          icon: "warning",
          title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
          text:
            lang === "VN"
              ? "Vui lòng nhập đầy đủ Mã gói, Tên gói, Phí bảo hiểm và Mức bồi thường (tối thiểu 1.000 VND)."
              : "Please fill Code, Name, Premium and Coverage (minimum 1,000 VND).",
          confirmButtonColor: "#124757",
        });
        return;
      }

      if (!editingId) {
        let latestPackages = packages;
        try {
          latestPackages = await fetchInsurancePackages({ activeOnly: false });
          setPackages(latestPackages || []);
        } catch (checkError) {
          // BE vẫn kiểm tra unique khi POST; không chặn tạo chỉ vì GET kiểm tra bị lỗi.
          console.warn("Không kiểm tra được mã bảo hiểm trước khi lưu:", checkError);
        }

        const duplicate = findDuplicateInsuranceCode(
          latestPackages,
          validationPayload.code,
          null,
          validationPayload.bookingType,
        );
        if (duplicate) {
          setTouched((prev) => ({ ...prev, code: true }));
          notify({
            icon: "warning",
            title: lang === "VN" ? "Mã gói đã tồn tại" : "Package code already exists",
            text: lang === "VN"
              ? `Mã '${validationPayload.code}' đã được dùng cho một gói bảo hiểm hành khách.`
              : `Code '${validationPayload.code}' is already used by a passenger insurance package.`,
            confirmButtonColor: "#124757",
          });
          return;
        }
      }

      // Spec BE: cả Create lẫn Edit đều phải đảm bảo chưa có gói Waterbus default active khác
      // khi payload yêu cầu isWaterbusDefault=true + isActive=true.
      // - Create: payload đang áp dụng cho gói mới → excludeId = null.
      // - Edit: payload đang áp dụng cho gói đang sửa → excludeId = editingId (tránh chặn chính gói đó).
      const ok = await ensureNoActiveDefault({ payload: validationPayload, excludeId: editingId });
      if (!ok) {
        setIsSaving(false);
        return;
      }

      const savedPackage = editingId
        ? await modifyInsurancePackage(editingId, requestPayload)
        : await addInsurancePackage(requestPayload);

      if (logoFile) {
        const packageId = getInsurancePackageId(savedPackage) ?? editingId;
        if (!packageId) {
          throw new Error("Không nhận được mã gói bảo hiểm để tải logo.");
        }
        await uploadInsurancePackageImage(packageId, logoFile);
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
      const responseErrors = error?.response?.data?.errors || {};
      const duplicateCodeMessage = (responseErrors.code || responseErrors.Code || [])[0];
      if (
        error?.response?.status === 400
        && /đã tồn tại|already exists|duplicate/i.test(String(duplicateCodeMessage || ""))
      ) {
        setTouched((prev) => ({ ...prev, code: true }));
        await loadPackages();
        notify({
          icon: "warning",
          title: lang === "VN" ? "Mã gói đã tồn tại" : "Package code already exists",
          text: duplicateCodeMessage,
          confirmButtonColor: "#124757",
        });
        return;
      }
      const { isDuplicateDefault } = detectDuplicateDefault(error);
      if (isDuplicateDefault) {
        const duplicates = findOtherActiveWaterbusDefaults(editingId);
        setWaterbusDefaultConflict({
          hasActiveWaterbusDefault: true,
          existingPackage: duplicates[0] || null,
          duplicates,
        });
        showDuplicateDefaultDialog({ duplicates });
        // Refetch để đảm bảo UI đồng bộ DB (trường hợp DB có data stale)
        await loadPackages();
        return;
      }
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: lang === "VN"
          ? "Không thể lưu gói bảo hiểm. Vui lòng thử lại."
          : "Could not save the package. Please try again.",
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

    // Spec BE: trước khi PATCH status → Active trên gói có isWaterbusDefault=true,
    // phải đảm bảo chưa có gói Waterbus default active nào khác.
    if (nextActive && pkg.isWaterbusDefault === true) {
      const ok = await ensureNoActiveDefault({
        payload: {
          isWaterbusDefault: true,
          isActive: true,
          bookingType: pkg.bookingType || INSURANCE_BOOKING_TYPES.PASSENGER,
        },
        excludeId: pkg.id,
      });
      if (!ok) return;
    }

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
      // Spec BE: PATCH /status không trả về DTO → phải refetch để đồng bộ isWaterbusDefault / isActive với DB.
      await loadPackages();
    } catch (error) {
      setPackages((prev) => prev.map((p) => (
        p.id === pkg.id
          ? { ...p, status: currentlyActive ? "Active" : "Inactive", isActive: currentlyActive }
          : p
      )));
      const { isDuplicateDefault } = detectDuplicateDefault(error);
      if (isDuplicateDefault) {
        const duplicates = findOtherActiveWaterbusDefaults(pkg.id);
        showDuplicateDefaultDialog({ duplicates });
        // Refetch để chắc chắn UI đúng với DB (BE có thể đã đổi isActive ngầm)
        await loadPackages();
        return;
      }
      notify({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: lang === "VN"
          ? "Không thể đổi trạng thái gói. Vui lòng thử lại."
          : "Could not update package status. Please try again.",
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
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Loại bảo hiểm:" : "Type:"}</span>
              <FormSelect
                value={providerTypeFilter}
                onChange={setProviderTypeFilter}
                menuAlign="right"
                options={[
                  { value: "all", label: lang === "VN" ? "Tất cả loại" : "All types" },
                  { value: "waterbus", label: lang === "VN" ? "Hệ thống" : "System" },
                  { value: "third_party", label: lang === "VN" ? "Bảo hiểm ngoài" : "Third party" },
                ]}
                className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {hasDuplicateWaterbus && (
        <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 p-4 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-500/30 shadow-sm flex items-start gap-3">
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
          <div className="flex-1">
            <div className="mb-1.5">
              {lang === "VN"
                ? `Đang có ${waterbusDuplicates.length} gói Waterbus mặc định hoạt động cùng lúc. Cần Inactive các gói trùng trước khi chỉnh sửa để tránh tạo thêm gói mặc định trùng.`
                : `${waterbusDuplicates.length} active Waterbus default packages detected. Inactive duplicates before editing to avoid creating more defaults.`}
            </div>
            <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400/80 space-y-0.5">
              {waterbusDuplicates.map((pkg) => (
                <div key={pkg.id ?? pkg.insurancePackageId} className="flex items-center gap-2">
                  <span>•</span>
                  <span className="font-mono">{pkg.code}</span>
                  <span>—</span>
                  <span>{pkg.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400/80">
              {lang === "VN"
                ? "→ Khi mở Edit/Create với providerSource = Waterbus, hệ thống sẽ chặn và yêu cầu Inactive các gói trùng trước."
                : "→ Opening Edit/Create with providerSource = Waterbus will be blocked; inactive duplicates first."}
            </div>
          </div>
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
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${pkg.providerLogoUrl
                      ? "bg-white dark:bg-white border border-slate-200 dark:border-slate-600 p-1.5"
                      : "bg-[#124757]/10 dark:bg-yellow-400/10"
                      }`}>
                      <InsuranceLogo
                        key={pkg.providerLogoUrl || "empty"}
                        src={pkg.providerLogoUrl}
                        alt={pkg.providerName || pkg.name}
                        className="w-full h-full object-contain"
                        fallback={<span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">shield</span>}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline font-black text-sm text-slate-800 dark:text-white truncate">{pkg.name}</h3>
                        <span className={`shrink-0 text-[9px] font-bold ${
                          pkg.isWaterbusDefault === true
                            ? "text-sky-600 dark:text-sky-300"
                            : "text-violet-600 dark:text-violet-300"
                        }`}>
                          {pkg.isWaterbusDefault === true
                            ? (lang === "VN" ? "Hệ thống" : "System")
                            : (lang === "VN" ? "Bảo hiểm ngoài" : "3rd party")}
                        </span>
                        {hasDuplicateWaterbus && waterbusDuplicates.some((dup) => (dup.id ?? dup.insurancePackageId) === (pkg.id ?? pkg.insurancePackageId)) && (
                          <span
                            title={lang === "VN" ? "Trùng với gói Waterbus mặc định khác — Inactive các gói khác trước khi chỉnh sửa" : "Duplicate of another active Waterbus default — inactive others before editing"}
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                          >
                            <span className="material-symbols-outlined text-[9px]">priority_high</span>
                            {lang === "VN" ? "Trùng" : "Duplicate"}
                          </span>
                        )}
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
                    <span className={`text-[10px] font-bold ${active
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-slate-500 dark:text-slate-400"
                      }`}>
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
                    className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${active
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
        <InsuranceFormModal
          key={editingId || "create"}
          lang={lang}
          form={form}
          editingId={editingId}
          isSaving={isSaving}
          hasBlockingError={hasBlockingError}
          waterbusDefaultConflict={waterbusDefaultConflict}
          renderHint={renderHint}
          inputClass={inputClass}
          updateField={updateField}
          handleBlur={handleBlur}
          handleLogoChange={handleLogoChange}
          removeLogo={removeLogo}
          updateCondition={updateCondition}
          addCondition={addCondition}
          removeCondition={removeCondition}
          closeModal={closeModal}
          handleSave={handleSave}
          openEditModal={openEditModal}
        />
      )}

      {viewingPackage && (
        <div className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            aria-label={lang === "VN" ? "Đóng" : "Close"}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={closeViewModal}
          />
          <div className="relative my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-4xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-4xl border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="font-headline text-base font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Chi tiết gói bảo hiểm" : "Insurance package details"}
              </h3>
              <button
                type="button"
                onClick={closeViewModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                title={lang === "VN" ? "Đóng" : "Close"}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-700 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${viewingPackage.providerLogoUrl
                  ? "bg-white dark:bg-white border border-slate-200 dark:border-slate-600 p-1.5"
                  : "bg-[#124757]/10 dark:bg-yellow-400/10"
                  }`}>
                  <InsuranceLogo
                    key={viewingPackage.providerLogoUrl || "empty"}
                    src={viewingPackage.providerLogoUrl}
                    alt={viewingPackage.providerName || viewingPackage.name}
                    className="w-full h-full object-contain"
                    fallback={<ShieldCheck size={26} className="text-[#124757] dark:text-yellow-400" aria-hidden="true" />}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${(viewingPackage.status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                      : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${(viewingPackage.status || "").toLowerCase() === "active" ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                      {(viewingPackage.status || "").toLowerCase() === "active"
                        ? (lang === "VN" ? "Hoạt động" : "Active")
                        : (lang === "VN" ? "Không hoạt động" : "Inactive")}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      viewingPackage.isWaterbusDefault === true
                        ? "text-sky-600 dark:text-sky-300"
                        : "text-violet-600 dark:text-violet-300"
                    }`}>
                      {viewingPackage.isWaterbusDefault === true
                        ? (lang === "VN" ? "Hệ thống" : "System")
                        : (lang === "VN" ? "Bảo hiểm ngoài" : "3rd party")}
                    </span>
                  </div>
                  <h4 className="mt-1.5 font-headline text-lg font-black leading-tight text-slate-800 dark:text-white">{viewingPackage.name}</h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-bold">#{viewingPackage.code}</span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Building2 size={13} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{viewingPackage.providerName || "—"}</span>
                    </span>
                  </div>
                </div>
                </div>
                {viewingPackage.termsUrl ? (
                  <a
                    href={viewingPackage.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 font-headline text-[10px] font-black uppercase text-[#124757] transition-colors hover:border-[#124757] dark:border-slate-700 dark:text-yellow-400 dark:hover:border-yellow-400"
                    title={viewingPackage.termsUrl}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    {lang === "VN" ? "Điều khoản" : "Terms"}
                  </a>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#124757] p-3.5 text-white dark:bg-yellow-400 dark:text-slate-900">
                  <div className="flex items-center gap-1.5 text-[10px] font-headline font-black uppercase tracking-wider opacity-80">
                    <Landmark size={15} aria-hidden="true" />
                    {lang === "VN" ? "Phí / khách" : "Fee / passenger"}
                  </div>
                  <p className="mt-1 font-headline text-lg font-black tabular-nums">
                    {formatVnd(viewingPackage.unitPremiumAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
                  <div className="flex items-center gap-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <ShieldCheck size={15} aria-hidden="true" />
                    {lang === "VN" ? "Mức bồi thường" : "Coverage"}
                  </div>
                  <p className="mt-1 font-headline text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">
                    {formatVnd(viewingPackage.coverageAmount)}
                  </p>
                </div>
              </div>

              <section className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#124757] dark:text-yellow-400" aria-hidden="true" />
                  <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Điều kiện áp dụng" : "Conditions"}
                  </p>
                  </div>
                  {Array.isArray(viewingPackage.conditions) && viewingPackage.conditions.length > 0 ? (
                    <span className="text-[10px] font-bold text-slate-400">{viewingPackage.conditions.length}</span>
                  ) : null}
                </div>
                {Array.isArray(viewingPackage.conditions) && viewingPackage.conditions.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {viewingPackage.conditions
                      .map((c) => (typeof c === "string" ? c : c?.text))
                      .filter(Boolean)
                      .map((text, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/60"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#124757]/10 font-headline text-[9px] font-black text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400">{i + 1}</span>
                          <span className="flex-1 text-[11px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">{text}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">—</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
