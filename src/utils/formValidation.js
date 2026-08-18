// Helper validate dùng chung cho các form nhập liệu (Manager/Staff/Register/Profile) — chỉ chặn
// sớm ở FE để UX phản hồi ngay khi gõ/rời field, KHÔNG thay thế validate của Backend.

// Định dạng email cơ bản: có "@", có phần domain với dấu ".".
export const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SĐT Việt Nam: 0xxxxxxxxx (10 số) hoặc +84xxxxxxxxx.
export const PHONE_FORMAT_REGEX = /^(0\d{9}|\+84\d{9})$/;

export const isValidEmailFormat = (value) => EMAIL_FORMAT_REGEX.test(String(value || "").trim());

export const isValidPhoneFormat = (value) => PHONE_FORMAT_REGEX.test(String(value || "").trim());

// Domain email được phép cho tài khoản Manager/Staff do Admin cấp (không áp dụng cho khách hàng
// tự đăng ký ở trang Register — trang đó chỉ cần đúng định dạng email thông thường).
export const MANAGED_ACCOUNT_EMAIL_DOMAINS = ["gmail.com", "fpt.edu.vn"];

/**
 * @param {string} email
 * @param {{ requireValue?: boolean }} [options] requireValue=false thì email rỗng vẫn coi là hợp lệ
 * (dùng cho các chỗ email là optional, VD Edit Manager/Staff cho phép bỏ trống).
 */
export const isAllowedManagedEmail = (email, { requireValue = true } = {}) => {
  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed) return !requireValue;
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return false;
  return MANAGED_ACCOUNT_EMAIL_DOMAINS.includes(trimmed.slice(at + 1));
};

export const isBlank = (value) => String(value ?? "").trim() === "";

/**
 * Validate bộ 3 field bắt buộc dùng chung cho form Manager/Staff (Admin tạo/sửa tài khoản
 * nội bộ): Họ tên, SĐT, Email (@gmail.com/@fpt.edu.vn). Trả về { [field]: message } — rỗng
 * nghĩa là hợp lệ.
 */
export function validateFullNamePhoneEmail(formData, lang) {
  const errors = {};

  if (isBlank(formData.fullName)) {
    errors.fullName = lang === "VN" ? "Vui lòng nhập họ và tên." : "Full name is required.";
  }

  if (isBlank(formData.phoneNumber)) {
    errors.phoneNumber = lang === "VN" ? "Vui lòng nhập số điện thoại." : "Phone number is required.";
  } else if (!isValidPhoneFormat(formData.phoneNumber)) {
    errors.phoneNumber = lang === "VN"
      ? "Số điện thoại không hợp lệ (VD: 0901234567)."
      : "Invalid phone number (e.g. 0901234567).";
  }

  if (isBlank(formData.email)) {
    errors.email = lang === "VN" ? "Vui lòng nhập email." : "Email is required.";
  } else if (!isAllowedManagedEmail(formData.email)) {
    errors.email = lang === "VN"
      ? "Email chỉ hỗ trợ @gmail.com hoặc @fpt.edu.vn."
      : "Email must be @gmail.com or @fpt.edu.vn.";
  }

  return errors;
}