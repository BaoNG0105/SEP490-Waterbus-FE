import { validateFullNamePhoneEmail } from "../../../utils/formValidation";

/**
 * Validate các field bắt buộc (*) dùng chung cho CreateManager / EditManager: Họ tên, SĐT, Email,
 * và Bến phụ trách (phải chọn ít nhất 1 bến). Ngày sinh / Giới tính / Quốc tịch là optional nên
 * không validate ở đây.
 */
export function validateManagerFields(formData, lang) {
  const errors = validateFullNamePhoneEmail(formData, lang);

  if (!Array.isArray(formData.stationIds) || formData.stationIds.length === 0) {
    errors.stationIds = lang === "VN"
      ? "Vui lòng chọn ít nhất 1 bến phụ trách."
      : "Please select at least one assigned station.";
  }

  return errors;
}