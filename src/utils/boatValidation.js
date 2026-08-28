// Quy tắc validate dùng chung cho CreateBoat.jsx / EditBoat.jsx.

/***/
export const MIN_BOAT_CODE_LENGTH = 3;
export const MAX_BOAT_CODE_LENGTH = 20;
/** Mã hiệu tàu: chỉ chữ cái, số và dấu gạch dưới (_), 3–20 ký tự. VD: WB_001 */
export const BOAT_CODE_REGEX = /^[A-Za-z0-9_]+$/;

/** Mã số đăng ký: chỉ chữ cái, số và dấu gạch ngang (-). VD: SG-WB-001 */
export const REGISTRATION_NUMBER_REGEX = /^[A-Za-z0-9-]+$/;

export const MIN_BOAT_SPEED_KMH = 1;
export const MAX_BOAT_SPEED_KMH = 100;

/***/
export const MIN_YEAR_BUILT = 1900;
export const getMinYearBuilt = () => MIN_YEAR_BUILT;

/***/
export const MIN_BOAT_NAME_LENGTH = 3;
export const MAX_BOAT_NAME_LENGTH = 100;
