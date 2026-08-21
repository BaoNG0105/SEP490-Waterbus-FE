// Quy tắc validate dùng chung cho CreateBoat.jsx / EditBoat.jsx.

/** Mã hiệu tàu: chỉ chữ cái, số và dấu gạch dưới (_). VD: WB_001 */
export const BOAT_CODE_REGEX = /^[A-Za-z0-9_]+$/;

/** Mã số đăng ký: chỉ chữ cái, số và dấu gạch ngang (-). VD: SG-WB-001 */
export const REGISTRATION_NUMBER_REGEX = /^[A-Za-z0-9-]+$/;

export const MIN_BOAT_SPEED_KMH = 1;
export const MAX_BOAT_SPEED_KMH = 100;

/**
 * Số năm tối đa cho phép tính từ năm hiện tại trở về trước cho "Năm đóng tàu". 60 năm là mốc
 * rộng rãi đủ để chấp nhận tàu cũ đã tân trang (vòng đời tàu chở khách thực tế thường 25-40 năm),
 * đồng thời vẫn chặn được các giá trị nhập nhầm quá xa (VD "1850", gõ thiếu số...).
 */
export const MAX_BOAT_AGE_YEARS = 60;

export const getMinYearBuilt = (currentYear) => currentYear - MAX_BOAT_AGE_YEARS;
