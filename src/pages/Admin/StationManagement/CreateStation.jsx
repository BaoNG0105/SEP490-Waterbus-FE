import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewStation } from "../../../services/stationService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";

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

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    const code = formData.stationCode.trim().toUpperCase();
    const name = formData.stationName.trim();
    if (!code || !name) {
      setErrorMsg(
        lang === "VN"
          ? "Vui lòng nhập mã nhà ga và tên nhà ga."
          : "Station code and name are required.",
      );
      return;
    }

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

  const labelStyle =
    "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";
  const inputStyle =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 outline-none shadow-inner transition-all focus:ring-2 focus:ring-[#124757] dark:border-slate-700/60 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400";

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
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <div className="flex h-full flex-col space-y-6 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
              <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Thông tin nhà ga" : "Station details"}
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    formData.isWaterbusStation
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-slate-400"
                  }`}
                >
                  {lang === "VN" ? "Trạm Waterbus" : "Waterbus Pier"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange("isWaterbusStation", !formData.isWaterbusStation)
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                    formData.isWaterbusStation ? "bg-yellow-400" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                      formData.isWaterbusStation ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
              <div>
                <label className={labelStyle}>
                  {lang === "VN" ? "Mã nhà ga (*)" : "Station Code (*)"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={formData.stationCode}
                  onChange={(e) =>
                    handleFieldChange("stationCode", e.target.value.toUpperCase())
                  }
                  placeholder={lang === "VN" ? "VD: BD, TT" : "e.g. BD, TT"}
                  className={`${inputStyle} uppercase tracking-wider`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelStyle}>
                  {lang === "VN" ? "Tên nhà ga (*)" : "Station Name (*)"}
                </label>
                <input
                  type="text"
                  required
                  value={formData.stationName}
                  onChange={(e) => handleFieldChange("stationName", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className={labelStyle}>
                {lang === "VN" ? "Địa chỉ" : "Address"}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                className={inputStyle}
              />
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div>
                <label className={labelStyle}>
                  {lang === "VN" ? "Giờ mở cửa" : "Opening Time"}
                </label>
                <input
                  type="time"
                  value={formData.openingTime}
                  onChange={(e) => handleFieldChange("openingTime", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className={labelStyle}>
                  {lang === "VN" ? "Giờ đóng cửa" : "Closing Time"}
                </label>
                <input
                  type="time"
                  value={formData.closingTime}
                  onChange={(e) => handleFieldChange("closingTime", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="mt-auto space-y-4 border-t border-slate-100 pt-6 dark:border-slate-700">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>{lang === "VN" ? "Hình ảnh" : "Photos"}</span>
                <span className={imagePreviews.length === MAX_IMAGES ? "text-rose-500" : ""}>
                  {imagePreviews.length} / {MAX_IMAGES}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {imagePreviews.map((previewUrl, index) => (
                  <div
                    key={previewUrl}
                    className="group relative aspect-4/3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      aria-label={lang === "VN" ? "Xóa ảnh" : "Remove image"}
                      className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-600"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
                {imagePreviews.length < MAX_IMAGES ? (
                  <label className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-all hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <span className="material-symbols-outlined text-lg text-slate-400">
                      add_photo_alternate
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">
                      {lang === "VN" ? "Thêm ảnh" : "Add"}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImagesChange}
                      className="hidden"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex h-145 min-h-145 flex-col rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 lg:h-auto">
            <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? "Vị trí trên bản đồ" : "Map location"}
                </h3>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {lang === "VN"
                    ? "Click bản đồ để đánh dấu vị trí bến."
                    : "Click the map to mark the pier location."}
                </p>
              </div>
              <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {Number(formData.latitude).toFixed(5)}, {Number(formData.longitude).toFixed(5)}
              </p>
            </div>
            <div className="relative min-h-75 w-full flex-1">
              <div className="absolute inset-0">
                <WaterwayMap
                  stationPoint={{
                    name: formData.stationName || (lang === "VN" ? "Vị trí bến mới" : "New pier"),
                    latitude: Number(formData.latitude) || 10.7749,
                    longitude: Number(formData.longitude) || 106.706,
                  }}
                  onLocationSelect={(lat, lng) => {
                    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
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
