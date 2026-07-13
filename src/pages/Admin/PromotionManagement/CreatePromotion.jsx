import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import {
  addPromotion,
  buildPromotionPayload,
  emptyPromotionForm,
  extractPromotionId,
  uploadPromotionImageFile,
  validatePromotionForm,
} from "../../../services/promotionService";
import { PromotionFormFields } from "./PromotionFormFields";

export function CreatePromotion() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState(() => emptyPromotionForm());

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const formError = validatePromotionForm(formData, lang, { isCreate: true });
      if (formError) {
        setErrorMsg(formError);
        setIsSubmitting(false);
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
          await Swal.fire({
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

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Tạo khuyến mãi thành công!" : "Promotion Created Successfully!",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/promotions"));
    } catch (error) {
      console.error("Lỗi tạo khuyến mãi:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(
        validationError ||
          error.response?.data?.message ||
          (lang === "VN" ? "Tạo khuyến mãi thất bại." : "Failed to create promotion.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-3xl mx-auto animate-fade-in">
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
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "POST /promotions → (optional) PUT /promotions/{id}/image"
              : "POST /promotions → (optional) PUT /promotions/{id}/image"}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <PromotionFormFields
          lang={lang}
          formData={formData}
          onChange={handleFieldChange}
          isCreate
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
