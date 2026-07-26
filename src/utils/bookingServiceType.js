// Cấu hình dùng chung cho 2 loại booking vé lẻ, phân biệt bởi field "serviceType" trả về từ
// GET /bookings và GET /bookings/{id}: "Waterbus" (chuyến cố định) | "Sightseeing" (tour ngắm cảnh).

// Trang lịch sử đặt vé gộp chung cho Waterbus + Sightseeing, phân loại bằng tab (?type=<serviceType>).
export const MY_BOOKINGS_PATH = "/profile/my-bookings";

export const BOOKING_SERVICE_CONFIG = {
  Waterbus: {
    serviceType: "Waterbus",
    basePath: "/profile/my-waterbus-booking",
    newBookingPath: "/waterbus-booking",
    titleVn: "Vé Waterbus của tôi",
    titleEn: "My Waterbus Bookings",
    descVn: "Xem lại lịch sử đặt vé, trạng thái và tổng tiền của các chuyến đã đặt.",
    descEn: "Review your booking history, status, and total amount for each trip.",
    emptyVn: "Bạn chưa có vé Waterbus nào.",
    emptyEn: "You have no Waterbus bookings yet.",
    newBookingLabelVn: "Đặt vé mới",
    newBookingLabelEn: "New booking",
    firstBookingLabelVn: "Đặt vé đầu tiên",
    firstBookingLabelEn: "Book your first trip",
  },
  Sightseeing: {
    serviceType: "Sightseeing",
    basePath: "/profile/my-sightseeing-booking",
    newBookingPath: "/watersightseeing-booking",
    titleVn: "Vé WaterSightseeing của tôi",
    titleEn: "My Sightseeing Bookings",
    descVn: "Xem lại lịch sử đặt tour ngắm cảnh, trạng thái và tổng tiền của các chuyến đã đặt.",
    descEn: "Review your sightseeing tour history, status, and total amount for each trip.",
    emptyVn: "Bạn chưa có vé WaterSightseeing nào.",
    emptyEn: "You have no Sightseeing bookings yet.",
    newBookingLabelVn: "Đặt tour mới",
    newBookingLabelEn: "New tour",
    firstBookingLabelVn: "Đặt tour đầu tiên",
    firstBookingLabelEn: "Book your first tour",
  },
};

export const getBookingServiceConfig = (serviceType) => BOOKING_SERVICE_CONFIG[serviceType] || BOOKING_SERVICE_CONFIG.Waterbus;
