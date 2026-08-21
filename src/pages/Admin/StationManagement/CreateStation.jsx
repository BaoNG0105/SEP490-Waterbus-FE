import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewStation } from "../../../services/stationService";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";
import { StationFormFields } from "./StationFormFields";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const toTimePayload = (hhmm) => (hhmm ? `${hhmm}:00` : null);

export function CreateStation() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [formData, setFormData] = useState({
    stationCode: "",
    stationName: "",
    address: "",
    latitude: 10.7749,
    longitude: 106.706,
    openingTime: "06:00",
    closingTime: "22:00",
    isWaterbusStation: true,
  });

  // Validate real-time — chỉ check rỗng (null/blank), giống Login. Lỗi chỉ hiện cho field đã
  // "touched" (rời khỏi ít nhất 1 lần), nhưng nút Tạo bị khóa ngay khi còn field rỗng.
  const [touchedFields, setTouchedFields] = useState({});
  const fieldErrors = {
    ...(formData.stationCode.trim() ? {} : {
      stationCode: lang === "VN" ? "Vui lòng nhập mã nhà ga" : "Station code is required",
    }),
    ...(formData.stationName.trim() ? {} : {
      stationName: lang === "VN" ? "Vui lòng nhập tên nhà ga" : "Station name is required",
    }),
  };
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const visibleFieldErrors = {
    ...(touchedFields.stationCode ? { stationCode: fieldErrors.stationCode } : {}),
    ...(touchedFields.stationName ? { stationName: fieldErrors.stationName } : {}),
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (selectedImages.length + files.length > MAX_IMAGES) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Quá giới hạn" : "Limit Exceeded",
        text:
          lang === "VN"
            ? `Mỗi bến chỉ được tối đa ${MAX_IMAGES} hình ảnh.`
            : `Maximum ${MAX_IMAGES} images allowed per station.`,
        confirmButtonColor: "#124757",
      });
      e.target.value = null;
      return;
    }

    const newValidFiles = [];
    const newPreviews = [];
    for (const file of files) {
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Sai định dạng" : "Invalid format",
          text:
            lang === "VN"
              ? `${file.name}: chỉ nhận JPEG, PNG hoặc WebP.`
              : `${file.name}: JPEG, PNG or WebP only.`,
          confirmButtonColor: "#124757",
        });
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "File quá lớn" : "File too large",
          text:
            lang === "VN"
              ? `${file.name} vượt quá 5MB.`
              : `${file.name} exceeds 5MB.`,
          confirmButtonColor: "#124757",
        });
        continue;
      }
      newValidFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...newValidFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = null;
  };

  const handleRemoveImage = (indexToRemove) => {
    setImagePreviews((prev) => {
      const url = prev[indexToRemove];
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== indexToRemove);
    });
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    // Bấm submit khi còn field rỗng (VD: nhấn Enter) → hiện hết lỗi lên thay vì âm thầm chặn.
    setTouchedFields({ stationCode: true, stationName: true });
    if (hasFieldErrors) return;

    const code = formData.stationCode.trim().toUpperCase();
    const name = formData.stationName.trim();

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const latitude = Number(formData.latitude);
      const longitude = Number(formData.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setErrorMsg(
          lang === "VN"
            ? "Tọa độ vĩ độ / kinh độ không hợp lệ."
            : "Latitude / longitude are invalid.",
        );
        return;
      }

      const openingTime = toTimePayload(formData.openingTime);
      const closingTime = toTimePayload(formData.closingTime);
      const address = formData.address.trim() || null;

      let payload;
      if (selectedImages.length > 0) {
        // Upload file thật — multipart, field `images` (không gửi link URL).
        payload = new FormData();
        payload.append("stationCode", code);
        payload.append("stationName", name);
        payload.append("latitude", String(latitude));
        payload.append("longitude", String(longitude));
        payload.append("isWaterbusStation", String(formData.isWaterbusStation));
        if (address) payload.append("address", address);
        if (openingTime) payload.append("openingTime", openingTime);
        if (closingTime) payload.append("closingTime", closingTime);
        selectedImages.forEach((file) => payload.append("images", file));
      } else {
        payload = {
          stationCode: code,
          stationName: name,
          latitude,
          longitude,
          isWaterbusStation: formData.isWaterbusStation,
          address,
          openingTime,
          closingTime,
        };
      }

      await addNewStation(payload);

      notify({
        icon: "success",
        title: lang === "VN" ? "Tạo nhà ga thành công!" : "Station created!",
        text:
          lang === "VN"
            ? "Nhà ga đã được thêm. Gắn vào routeStops khi tạo/sửa tuyến để dùng trên chuyến."
            : "Station saved. Assign it to routeStops when creating/updating a route.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/stations-management"));
    } catch (error) {
      console.error("Lỗi tạo nhà ga:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(
        validationError
          || getApiErrorMessage(
            error,
            lang === "VN" ? "Không tạo được nhà ga." : "Failed to create station.",
          ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl animate-fade-in space-y-6 px-2 pb-10 font-body sm:px-4">
      <div className="flex items-center gap-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => navigate("/admin/stations-management")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-inner transition-all hover:bg-[#124757] hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-yellow-400 dark:hover:text-slate-900"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 md:text-2xl">
            {lang === "VN" ? "Thêm nhà ga mới" : "Add New Station"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {lang === "VN"
              ? "Điền thông tin bến, đánh dấu vị trí trên bản đồ và tải ảnh."
              : "Fill in pier details, mark the location on the map, and upload photos."}
          </p>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <StationFormFields
          lang={lang}
          formData={formData}
          onChange={handleFieldChange}
          isCreate
          imagePreviews={imagePreviews}
          maxImages={MAX_IMAGES}
          onImagesChange={handleImagesChange}
          onRemoveImage={handleRemoveImage}
          errors={visibleFieldErrors}
          onFieldBlur={handleFieldBlur}
        />

        <button
          type="submit"
          disabled={isSubmitting || hasFieldErrors}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#124757] py-4 font-headline text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
        >
          {isSubmitting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          {lang === "VN" ? "Tạo nhà ga" : "Create Station"}
        </button>
      </form>
    </div>
  );
}
