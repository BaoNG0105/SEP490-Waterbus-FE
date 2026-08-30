import { isBlank } from "./formValidation";

/**
 * Validate các field bắt buộc (*) dùng chung cho CreateLandmark / EditLandmark: Tên landmark,
 * Mô tả (nội dung sẽ được bake thành audio) và Bán kính kích hoạt — field số này phải là số và
 * lớn hơn 0. Trả về { [field]: message } — rỗng nghĩa là hợp lệ.
 * (Thứ tự hiển thị không còn là field nhập tay — luôn mặc định 0 trong code, không validate.)
 */
export function validateLandmarkFields(formData, lang) {
  const errors = {};

  if (isBlank(formData.landmarkName)) {
    errors.landmarkName = lang === "VN" ? "Vui lòng nhập tên landmark." : "Landmark name is required.";
  }

  if (isBlank(formData.description)) {
    errors.description = lang === "VN" ? "Vui lòng nhập mô tả." : "Description is required.";
  }

  if (isBlank(formData.triggerRadiusMeters)) {
    errors.triggerRadiusMeters = lang === "VN" ? "Vui lòng nhập bán kính kích hoạt." : "Trigger radius is required.";
  } else if (!Number.isFinite(Number(formData.triggerRadiusMeters)) || Number(formData.triggerRadiusMeters) <= 0) {
    errors.triggerRadiusMeters = lang === "VN" ? "Bán kính kích hoạt phải là số lớn hơn 0." : "Trigger radius must be a number greater than 0.";
  }

  return errors;
}