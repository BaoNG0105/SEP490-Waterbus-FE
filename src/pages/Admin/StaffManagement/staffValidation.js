import { validateFullNamePhoneEmail } from "../../../utils/formValidation";

/**
 * Validate các field bắt buộc (*) dùng chung cho CreateStaff / EditStaff: Họ tên, SĐT, Email.
 * Ngày sinh / Giới tính / Quốc tịch / Loại nhân viên / Bến làm việc được validate riêng ở từng
 * trang (khác nhau nhiều giữa admin picker / manager radio / read-only) nên không gộp vào đây.
 */
export const validateStaffFields = validateFullNamePhoneEmail;