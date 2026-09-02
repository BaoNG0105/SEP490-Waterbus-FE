import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  addPromotion,
  buildPromotionPayload,
  emptyPromotionForm,
  extractPromotionId,
  fetchPromotions,
  uploadPromotionImageFile,
  validatePromotionForm,
} from "../../../services/promotionService";
import { PromotionFormFields } from "./PromotionFormFields";
import { notify } from "../../../utils/swalToast";

export function CreatePromotion() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  // Mỗi lần inline error đổi, cuộn tới field đầu tiên bị lỗi để user thấy ngay.
  const [errorTick, setErrorTick] = useState(0);
  const [formData, setFormData] = useState(() => emptyPromotionForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const [externalFieldErrors, setExternalFieldErrors] = useState({});
  const codeCheckRequestRef = useRef(0);
  const hasBlockingErrors = Object.keys(fieldErrors).length > 0
    || Object.keys(externalFieldErrors).length > 0;
  // Chặn nút submit ngay từ đầu — không chỉ dựa vào fieldErrors (chỉ có khi field đã "touched"),
  // mà check toàn bộ form ngay cả khi user chưa động vào field nào.
  const liveFormError = useMemo(
    () => validatePromotionForm(formData, lang, { isCreate: true }),
    [formData, lang],
  );

  const handleFieldChange = (field, value) => {
    if (field === "promotionCode") {
      codeCheckRequestRef.current += 1;
      setExternalFieldErrors((prev) => {
        if (!prev.promotionCode) return prev;
        const next = { ...prev };
        delete next.promotionCode;
        return next;
      });
      setServerError("");
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setDuplicateCodeError = (code, message = "") => {
    setExternalFieldErrors((prev) => ({
      ...prev,
      promotionCode: {
        severity: "error",
        message: message || (lang === "VN"
          ? `Mã khuyến mãi '${code}' đã tồn tại.`
          : `Promotion code '${code}' already exists.`),
      },
    }));
    setServerError("");
  };

  const checkPromotionCodeExists = async (rawCode) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code || !/^[A-Z0-9]+$/.test(code)) return false;

    const requestId = ++codeCheckRequestRef.current;
    try {
      const promotions = await fetchPromotions();
      if (requestId !== codeCheckRequestRef.current) return false;
      const duplicate = promotions.some(
        (promotion) => String(promotion.promotionCode || "").trim().toUpperCase() === code,
      );
      if (duplicate) {
        setDuplicateCodeError(code);
        return true;
      }
      setExternalFieldErrors((prev) => {
        if (!prev.promotionCode) return prev;
        const next = { ...prev };
        delete next.promotionCode;
        return next;
      });
      return false;
    } catch {
      // Không chặn form khi pre-check lỗi mạng; POST vẫn là kiểm tra cuối cùng.
      return false;
    }
  };

  // Cuộn tới field đầu tiên bị lỗi khi submit bị chặn.
  useEffect(() => {
    if (errorTick === 0) return;
    const firstErrField = Object.keys({ ...fieldErrors, ...externalFieldErrors })[0];
    if (!firstErrField) return;
    const el = document.querySelector(`[data-field="${firstErrField}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errorTick, externalFieldErrors, fieldErrors]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const inlineErrorCount = Object.keys(fieldErrors).length;
    const formError = validatePromotionForm(formData, lang, { isCreate: true });
    if (inlineErrorCount > 0 || formError) {
      // Inline error đã hiển thị dưới từng ô. Kích hoạt scroll-to-first-error.
      setServerError(formError || "");
      setErrorTick((t) => t + 1);
      return;
    }
    try {
      setIsSubmitting(true);
      setServerError("");

      if (await checkPromotionCodeExists(formData.promotionCode)) {
        setErrorTick((tick) => tick + 1);
        return;
      }

      const payload = buildPromotionPayload(formData, { includeCode: true });
      const created = await addPromotion(payload);
      const promotionId = extractPromotionId(created);

      if (formData.imageFile && promotionId) {
        try {
          await uploadPromotionImageFile(promotionId, formData.imageFile);
        } catch (uploadError) {
          console.error(uploadError);
          await notify({
            icon: "warning",
            title: lang === "VN" ? "Đã tạo KM, upload ảnh thất bại" : "Created, but image upload failed",
            text:
              uploadError.response?.data?.message ||
              (lang === "VN"
                ? "Bạn có thể vào sửa để upload lại ảnh."
                : "You can edit the promotion to re-upload the image."),
            confirmButtonColor: "#124757",
          });
          navigate(promotionId ? `/admin/promotions/edit/${promotionId}` : "/admin/promotions");
          return;
        }
      }

      notify({
        icon: "success",
        title: lang === "VN" ? "Tạo khuyến mãi thành công!" : "Promotion Created Successfully!",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/promotions"));
    } catch (error) {
      console.error("Lỗi tạo khuyến mãi:", error);
      const responseData = error.response?.data || {};
      const responseErrors = responseData.errors || {};
      const codeMessages = responseErrors.promotionCode
        || responseErrors.PromotionCode
        || responseErrors.code
        || responseErrors.Code
        || [];
      const codeMessage = Array.isArray(codeMessages) ? codeMessages[0] : codeMessages;
      const duplicateText = String(codeMessage || responseData.message || responseData.title || "");
      const isDuplicateCode = /tồn tại|trùng|already exists|duplicate/i.test(duplicateText)
        && (Boolean(codeMessage) || /mã khuyến mãi|promotion/i.test(duplicateText));
      if (
        [400, 409].includes(error.response?.status)
        && isDuplicateCode
      ) {
        setDuplicateCodeError(formData.promotionCode, codeMessage || "");
        setErrorTick((tick) => tick + 1);
        return;
      }
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setServerError(
        validationError ||
          error.response?.data?.message ||
          (lang === "VN" ? "Tạo khuyến mãi thất bại." : "Failed to create promotion.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-6xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/promotions")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Thêm khuyến mãi mới" : "Add New Promotion"}
          </h2>
        </div>
      </div>

      {serverError && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm"
        >
          {serverError}
        </div>
      )}

      <form noValidate onSubmit={handleFormSubmit} className="space-y-6">
        <PromotionFormFields
          lang={lang}
          formData={formData}
          onChange={handleFieldChange}
          onErrorsChange={setFieldErrors}
          externalErrors={externalFieldErrors}
          onPromotionCodeBlur={checkPromotionCodeExists}
          submitValidationTick={errorTick}
          isCreate
        />

        <button
          type="submit"
          disabled={isSubmitting || hasBlockingErrors || Boolean(liveFormError)}
          className="sticky bottom-4 z-20 w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting && (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {lang === "VN" ? "Tạo khuyến mãi" : "Create Promotion"}
        </button>
      </form>
    </div>
  );
}
