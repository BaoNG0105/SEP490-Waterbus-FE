import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

import { addNewBoat, fetchAllBoats, uploadBoatDocument } from "../../../services/boatService";

import { FormSelect } from "../../../components/FormSelect";
import { YearPickerInput } from "../../../components/YearPickerInput";

import { notify } from "../../../utils/swalToast";
import {
  BOAT_DOCUMENT_ACCEPT,
  BOAT_DOCUMENT_MAX_SIZE,
  BOAT_DOCUMENT_META,
  BOAT_DOCUMENT_MIME_TYPES,
  BOAT_DOCUMENT_TYPES,
} from "../../../utils/boatDocuments";
import { BoatDocumentsPanel } from "./BoatDocumentsPanel";

const unwrapList = (data) => (Array.isArray(data) ? data : (data?.items || data?.data || []));

const pickCreatedBoatId = (response) => {
  const src = response?.data && typeof response.data === "object" && !Array.isArray(response.data)
    ? response.data
    : response;
  return (
    src?.id
    || src?.boatId
    || src?.BoatId
    || src?.boatID
    || null
  );
};

const isValidDocFile = (file) =>
  BOAT_DOCUMENT_MIME_TYPES.includes(file.type) && file.size <= BOAT_DOCUMENT_MAX_SIZE;

export function CreateBoat() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    numberOfDecks: 1,
    seatSetupType: "FullStandard",
    serviceType: "Passenger",
    registrationNumber: "",
    maxSpeedKmh: 0,
    yearBuilt: new Date().getFullYear(),
    description: "",
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [pendingDocs, setPendingDocs] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  /** Chỉ giữ lại khi tạo OK nhưng còn hồ sơ chưa upload xong. */
  const [createdBoat, setCreatedBoat] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setPendingDoc = (type, file) => {
    if (file && !isValidDocFile(file)) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "File không hợp lệ" : "Invalid file",
        text: lang === "VN"
          ? "Chỉ hỗ trợ PDF, JPG, PNG, WEBP và tối đa 10MB."
          : "Only PDF, JPG, PNG, WEBP files up to 10MB are supported.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    setPendingDocs((prev) => {
      const next = { ...prev };
      if (file) next[type] = file;
      else delete next[type];
      return next;
    });
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);

    if (imagePreviews.length + files.length > 3) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Quá số lượng" : "Limit Exceeded",
        text: lang === "VN" ? "Hệ thống chỉ cho phép lưu trữ tối đa 3 hình ảnh cho mỗi phương tiện." : "Maximum 3 images allowed per vessel.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
    const newValidFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!validTypes.includes(file.type)) continue;
      if (file.size > maxSize) continue;
      newValidFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...newValidFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = null;
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
    setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const resolveBoatId = async (response, code) => {
    const directId = pickCreatedBoatId(response);
    if (directId) return String(directId);

    const list = unwrapList(await fetchAllBoats({}));
    const match = list.find((boat) =>
      String(boat?.code || boat?.boatCode || "").trim().toLowerCase() === String(code).trim().toLowerCase()
    );
    return match?.id || match?.boatId || null;
  };

  const uploadSelectedDocs = async (boatId, docs) => {
    const entries = Object.entries(docs).filter(([, file]) => Boolean(file));
    const failures = [];

    for (const [type, file] of entries) {
      const payload = new FormData();
      payload.append("file", file);
      try {
        await uploadBoatDocument(boatId, type, payload);
      } catch (error) {
        console.error(error);
        const label = lang === "VN" ? BOAT_DOCUMENT_META[type]?.labelVn : BOAT_DOCUMENT_META[type]?.labelEn;
        failures.push(label || type);
      }
    }

    return { uploaded: entries.length - failures.length, failures };
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (Number(formData.yearBuilt) > currentYear) {
      setErrorMsg(
        lang === "VN"
          ? `Năm đóng tàu không được lớn hơn năm hiện tại (${currentYear}).`
          : `Year built cannot be later than the current year (${currentYear}).`
      );
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const payload = new FormData();
      payload.append("code", formData.code.trim());
      payload.append("name", formData.name.trim());
      payload.append("numberOfDecks", String(formData.numberOfDecks));
      payload.append("seatSetupType", formData.seatSetupType);
      payload.append("serviceType", formData.serviceType || "Passenger");
      payload.append("maxSpeedKmh", String(formData.maxSpeedKmh));
      payload.append("yearBuilt", String(formData.yearBuilt));
      if (formData.registrationNumber.trim()) payload.append("registrationNumber", formData.registrationNumber.trim());
      if (formData.description.trim()) payload.append("description", formData.description.trim());
      selectedImages.forEach((file) => payload.append("images", file));

      const created = await addNewBoat(payload);
      const boatId = await resolveBoatId(created, formData.code.trim());
      if (!boatId) {
        throw new Error(lang === "VN" ? "Tạo tàu thành công nhưng không lấy được ID để thêm hồ sơ." : "Boat created but ID was missing for documents.");
      }

      const src = created?.data && typeof created.data === "object" ? created.data : created;
      const boatMeta = {
        id: String(boatId),
        code: formData.code.trim(),
        name: formData.name.trim(),
        status: src?.status || src?.Status || "Inactive",
      };

      const selectedDocCount = Object.values(pendingDocs).filter(Boolean).length;
      const { failures } = selectedDocCount > 0
        ? await uploadSelectedDocs(boatId, pendingDocs)
        : { failures: [] };

      if (failures.length > 0) {
        setCreatedBoat(boatMeta);
        setPendingDocs({});
        notify({
          icon: "warning",
          title: lang === "VN" ? "Tàu đã tạo — một số hồ sơ lỗi" : "Boat created — some documents failed",
          text: (lang === "VN" ? "Chưa lưu được: " : "Failed: ") + failures.join(", "),
          confirmButtonColor: "#124757",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã tạo tàu" : "Boat created",
        text: selectedDocCount > 0
          ? (lang === "VN" ? `Đã lưu ${selectedDocCount}/4 hồ sơ pháp lý.` : `Saved ${selectedDocCount}/4 legal documents.`)
          : (lang === "VN" ? "Có thể bổ sung hồ sơ pháp lý sau trong hồ sơ tàu." : "You can add legal documents later from the boat file."),
        showConfirmButton: false,
        timer: 2400,
      });
      navigate("/admin/boats-management");
    } catch (error) {
      console.error("Lỗi thêm tàu mới:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(
        validationError
        || error.response?.data?.message
        || error.message
        || (lang === "VN" ? "Lưu thông tin thất bại." : "Failed to create vessel."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const selectStyle = `${inputStyle} cursor-pointer`;
  const deckOptions = [
    { value: 1, label: lang === "VN" ? "1 Tầng" : "1 Deck" },
    { value: 2, label: lang === "VN" ? "2 Tầng" : "2 Decks" },
  ];
  const seatSetupOptions = [
    { value: "FullStandard", label: "Waterbus" },
    { value: "StandardAndVip", label: "Water Sightseeing" },
  ];
  const serviceTypeOptions = [
    { value: "Passenger", label: lang === "VN" ? "Chở khách" : "Passenger" },
    { value: "Rescue", label: lang === "VN" ? "Cứu hộ / kéo tàu" : "Rescue" },
  ];
  const pendingDocCount = Object.values(pendingDocs).filter(Boolean).length;

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-4xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/boats-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Đăng ký phương tiện mới" : "Register New Vessel"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {createdBoat
              ? (lang === "VN"
                ? `Tàu ${createdBoat.code} đã tạo — bổ sung hồ sơ còn thiếu.`
                : `Boat ${createdBoat.code} created — finish remaining documents.`)
              : (lang === "VN"
                ? "Thông số tàu và 4 hồ sơ pháp lý trong một lần lưu."
                : "Vessel specs and all 4 legal documents in one save.")}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {!createdBoat ? (
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
              {lang === "VN" ? "Thông số chung" : "General Information"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Mã hiệu tàu (*)" : "Vessel Code (*)"}</label>
                <input type="text" required placeholder="VD: WB_001" value={formData.code} onChange={(e) => handleInputChange("code", e.target.value)} className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Tên phương tiện (*)" : "Vessel Name (*)"}</label>
                <input type="text" required placeholder="VD: Waterbus 001" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} className={inputStyle} />
              </div>
            </div>

            <div className="relative z-10">
              <label className={labelStyle}>{lang === "VN" ? "Loại dịch vụ (*)" : "Service type (*)"}</label>
              <FormSelect
                value={formData.serviceType}
                onChange={(v) => handleInputChange("serviceType", v)}
                options={serviceTypeOptions}
                className={selectStyle}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Mã số đăng ký" : "Registration Number"}</label>
                <input type="text" placeholder="VD: SG-WB-001" value={formData.registrationNumber} onChange={(e) => handleInputChange("registrationNumber", e.target.value)} className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
                <YearPickerInput min={1900} max={currentYear} required value={formData.yearBuilt} onChange={(e) => handleInputChange("yearBuilt", e.target.value)} className={inputStyle} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 overflow-visible">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
              {lang === "VN" ? "Cấu trúc hạ tầng" : "Infrastructure"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 overflow-visible">
              <div className="relative z-20">
                <label className={labelStyle}>{lang === "VN" ? "Số tầng tàu" : "Decks"}</label>
                <FormSelect
                  value={formData.numberOfDecks}
                  onChange={(v) => handleInputChange("numberOfDecks", Number(v))}
                  options={deckOptions}
                  className={selectStyle}
                />
              </div>
              <div className="relative z-30">
                <label className={labelStyle}>{lang === "VN" ? "Kiểu thiết lập ghế" : "Seat Setup Type"}</label>
                <FormSelect
                  value={formData.seatSetupType}
                  onChange={(v) => handleInputChange("seatSetupType", v)}
                  options={seatSetupOptions}
                  className={`${selectStyle} font-bold text-[#124757]`}
                />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Vận tốc tối đa (Kmh)" : "Max Speed (Kmh)"}</label>
                <input type="number" min={0} required value={formData.maxSpeedKmh} onChange={(e) => handleInputChange("maxSpeedKmh", e.target.value)} className={inputStyle} />
              </div>
            </div>

            <div>
              <label className={labelStyle}>{lang === "VN" ? "Mô tả ghi chú kỹ thuật" : "Engineering Notes"}</label>
              <textarea rows={3} placeholder={lang === "VN" ? "Nhập chi tiết về thiết kế, động cơ, đặc quyền..." : "Provide details about engine and perks..."} value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
              <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                {lang === "VN" ? "Bộ sưu tập ảnh" : "Gallery"}
              </h3>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${imagePreviews.length === 3 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                {imagePreviews.length} / 3
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {imagePreviews.map((previewUrl, index) => (
                <div key={index} className="aspect-4/3 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shadow-sm">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    aria-label={lang === "VN" ? "Xóa ảnh" : "Remove image"}
                    className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-600"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}

              {imagePreviews.length < 3 && (
                <label className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <span className="material-symbols-outlined text-2xl text-slate-400 mb-1">add_photo_alternate</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tải ảnh lên</span>
                  <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                {lang === "VN" ? "Hồ sơ pháp lý (4 loại)" : "Legal documents (4 types)"}
              </h3>
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <span className="material-symbols-outlined text-sm">folder_open</span>
                {pendingDocCount}/4 {lang === "VN" ? "đã chọn" : "selected"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {BOAT_DOCUMENT_TYPES.map((type) => {
                const meta = BOAT_DOCUMENT_META[type];
                const label = lang === "VN" ? meta.labelVn : meta.labelEn;
                const file = pendingDocs[type] || null;
                return (
                  <div
                    key={type}
                    className={`rounded-2xl border p-4 space-y-2 transition-colors ${file
                        ? "border-[#124757]/40 bg-[#124757]/5 dark:border-yellow-400/40 dark:bg-yellow-400/5"
                        : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/50"
                      }`}
                  >
                    <label className={labelStyle}>{label}</label>
                    <input
                      type="file"
                      accept={BOAT_DOCUMENT_ACCEPT}
                      onChange={(e) => setPendingDoc(type, e.target.files?.[0] || null)}
                      className="block w-full text-[11px] font-bold text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#124757] file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900 file:font-bold file:cursor-pointer"
                    />
                    {file ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
                        <span className="truncate text-[11px] font-bold text-[#124757] dark:text-yellow-300 inline-flex items-center gap-1.5">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingDoc(type, null)}
                          className="shrink-0 text-slate-400 transition-colors hover:text-red-500"
                          title={lang === "VN" ? "Bỏ chọn" : "Clear"}
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        {lang === "VN" ? "PDF, JPG, PNG, WEBP · tối đa 10MB" : "PDF, JPG, PNG, WEBP · max 10MB"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {lang === "VN"
                ? (pendingDocCount > 0 ? `Lưu tàu & ${pendingDocCount} hồ sơ` : "Lưu tàu")
                : (pendingDocCount > 0 ? `Save boat & ${pendingDocCount} document(s)` : "Save boat")}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            {lang === "VN"
              ? `Tàu ${createdBoat.code} đã tạo. Bổ sung / sửa hồ sơ còn thiếu rồi bấm Hoàn tất.`
              : `Boat ${createdBoat.code} created. Finish remaining documents, then click Done.`}
          </div>

          <BoatDocumentsPanel
            boatId={createdBoat.id}
            boatCode={createdBoat.code}
            boatStatus={createdBoat.status}
          />

          <button
            type="button"
            onClick={() => navigate("/admin/boats-management")}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] transition-all"
          >
            {lang === "VN" ? "Hoàn tất" : "Finish"}
          </button>
        </div>
      )}
    </div>
  );
}
