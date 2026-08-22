import { isBlank } from "./formValidation";

/**
 * Validate các field bắt buộc (*) dùng chung cho CreateLandmark / EditLandmark: Tên landmark,
 * Mô tả (nội dung sẽ được bake thành audio), Thứ tự hiển thị và Bán kính kích hoạt — 2 field số
 * này phải là số và lớn hơn 0. Trả về { [field]: message } — rỗng nghĩa là hợp lệ.
 */
export function validateLandmarkFields(formData, lang) {
  const errors = {};

  if (isBlank(formData.landmarkName)) {
    errors.landmarkName = lang === "VN" ? "Vui lòng nhập tên landmark." : "Landmark name is required.";
  }

  if (isBlank(formData.description)) {
    errors.description = lang === "VN" ? "Vui lòng nhập mô tả." : "Description is required.";
  }

  if (isBlank(formData.displayOrder)) {
    errors.displayOrder = lang === "VN" ? "Vui lòng nhập thứ tự hiển thị." : "Display order is required.";
  } else if (!Number.isFinite(Number(formData.displayOrder)) || Number(formData.displayOrder) <= 0) {
    errors.displayOrder = lang === "VN" ? "Thứ tự hiển thị phải là số lớn hơn 0." : "Display order must be a number greater than 0.";
  }

  if (isBlank(formData.triggerRadiusMeters)) {
    errors.triggerRadiusMeters = lang === "VN" ? "Vui lòng nhập bán kính kích hoạt." : "Trigger radius is required.";
  } else if (!Number.isFinite(Number(formData.triggerRadiusMeters)) || Number(formData.triggerRadiusMeters) <= 0) {
    errors.triggerRadiusMeters = lang === "VN" ? "Bán kính kích hoạt phải là số lớn hơn 0." : "Trigger radius must be a number greater than 0.";
  }

  return errors;
}