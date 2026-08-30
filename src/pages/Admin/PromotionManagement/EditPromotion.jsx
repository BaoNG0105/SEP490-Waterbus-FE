import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  fetchPromotions,
  modifyPromotion,
  buildPromotionPayload,
  formFromPromotion,
  emptyPromotionForm,
  uploadPromotionImageFile,
  validatePromotionForm,
} from "../../../services/promotionService";
import { PromotionFormFields } from "./PromotionFormFields";
import { notify } from "../../../utils/swalToast";

export function EditPromotion() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorTick, setErrorTick] = useState(0);
  const [formData, setFormData] = useState(() => emptyPromotionForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const hasBlockingErrors = Object.keys(fieldErrors).length > 0;

  useEffect(() => {
    const getPromotionRecord = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");

        const preloaded = location.state?.promotion;
        if (preloaded && String(preloaded.id) === String(id)) {
          setFormData(formFromPromotion(preloaded));
          return;
        }

        const list = await fetchPromotions();
        const found = list.find((p) => String(p.id) === String(id));
        if (!found) {
          notify({
            icon: "error",
            title: lang === "VN" ? "Không tìm thấy khuyến mãi!" : "Promotion Not Found!",
            text:
              lang === "VN"
                ? "Mã định danh khuyến mãi không tồn tại. Quay về danh sách."
                : "The requested promotion does not exist.",
            confirmButtonColor: "#124757",
            allowOutsideClick: false,
          }).then(() => navigate("/admin/promotions"));
          return;
        }
        setFormData(formFromPromotion(found));
      } catch (error) {
        console.error("Lỗi khi tải chi tiết khuyến mãi:", error);
        setErrorMsg(
          lang === "VN"
            ? "Không thể lấy thông tin khuyến mãi do lỗi kết nối mạng."
            : "Failed to retrieve promotion details."
        );
      } finally {
        setIsLoading(false);
      }
    };
    getPromotionRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const formError = validatePromotionForm(formData, lang, { isCreate: false });
    if (Object.keys(fieldErrors).length > 0 || formError) {
      const firstError = Object.values(fieldErrors).find((item) => item?.message);
      setErrorMsg(
        firstError?.message || formError ||
          (lang === "VN" ? "Vui lòng kiểm tra lại các trường được đánh dấu." : "Please review the highlighted fields.")
      );
      setErrorTick((tick) => tick + 1);
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const payload = buildPromotionPayload(formData, { includeCode: true });
      await modifyPromotion(id, payload);

      if (formData.imageFile) {
        await uploadPromotionImageFile(id, formData.imageFile);
      }

      notify({
        icon: "success",
        title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/promotions"));
    } catch (error) {
      console.error("Lỗi cập nhật khuyến mãi:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(
        validationError ||
          error.response?.data?.message ||
          (lang === "VN" ? "Gặp lỗi trong quá trình lưu thông tin." : "Failed to save changes.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

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
            {lang === "VN"
              ? `Chỉnh sửa khuyến mãi: ${formData.promotionCode}`
              : `Edit Promotion: ${formData.promotionCode}`}
          </h2>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <form noValidate onSubmit={handleFormSubmit} className="space-y-6">
        <PromotionFormFields
          lang={lang}
          formData={formData}
          onChange={handleFieldChange}
          onErrorsChange={setFieldErrors}
          submitValidationTick={errorTick}
          lockCode
          lockType
          isCreate={false}
        />

        <button
          type="submit"
          disabled={isSubmitting || hasBlockingErrors}
          className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting && (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
