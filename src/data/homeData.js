// src/data/homeData.js

// DỮ LIỆU MODAL QUẢNG CÁO
export const promoPosters = [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800",
    "https://images.unsplash.com/photo-1528150395403-992a693e26c8?q=80&w=800",
];

// DỮ LIỆU SLIDE HERO
export const heroSlides = [
    {
        src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
    },
    {
        src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
    },
    {
        src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
    },
];

// DỮ LIỆU HƯỚNG DẪN ĐẶT VÉ
export const guidelines = [
    {
        id: 1,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
        titleVn: "Chọn hành trình mong muốn",
        titleEn: "Choose Your Desired Route",
        descVn: "Bắt đầu bằng việc chọn bến đi, bến đến, ngày giờ và loại vé phù hợp với nhu cầu di chuyển của bạn.",
        descEn: "Start by selecting your departure wharf, destination, date, time, and ticket type that fits your needs."
    },
    {
        id: 2,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
        titleVn: "Chọn ghế & Nhập thông tin hành khách",
        titleEn: "Select Seat & Enter Passenger Info",
        descVn: "Lựa chọn vị trí ghế ngồi yêu thích trên sơ đồ tàu và nhập thông tin hành khách chính xác.",
        descEn: "Choose your preferred seat location on the vessel layout and enter accurate passenger information."
    },
    {
        id: 3,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
        titleVn: "Thanh toán an toàn, đa phương thức",
        titleEn: "Secure Multi-method Payment",
        descVn: "Thực hiện thanh toán nhanh chóng và bảo mật qua các ví điện tử, thẻ ngân hàng hoặc cổng thanh toán hỗ trợ.",
        descEn: "Make quick and secure payment via supported e-wallets, bank cards, or payment gateways."
    },
    {
        id: 4,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
        titleVn: "Nhận vé QR qua Email & SMS",
        titleEn: "Receive QR Ticket via Email & SMS",
        descVn: "Hệ thống sẽ gửi mã QR vé về email và số điện thoại của bạn. Xuất trình mã này khi lên tàu.",
        descEn: "The system will send your ticket QR code to your email and phone. Present this code when boarding."
    },
];

// DỮ LIỆU KHUYẾN MÃI
export const promoData = [
  {
    id: 1,
    titleVn: "Giảm 20% cho nhóm từ 4 người trở lên",
    titleEn: "20% Off for Groups of 4 or More",
    code: "SWBGROUP20",
    expiryVn: "Hạn dùng: 30/06/2026",
    expiryEn: "Exp: Jun 30, 2026",
    image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
    tagVn: "Ưu đãi nhóm",
    tagEn: "Group Deal"
  },
  {
    id: 2,
    titleVn: "Đồng giá vé 15k cho khung giờ thấp điểm",
    titleEn: "Flat 15k Ticket for Off-Peak Hours",
    code: "MIDDAY15K",
    expiryVn: "Hạn dùng: 15/07/2026",
    expiryEn: "Exp: Jul 15, 2026",
    image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
    tagVn: "Giờ thấp điểm",
    tagEn: "Off-Peak"
  },
  {
    id: 3,
    titleVn: "Tặng voucher nước miễn phí khi đặt vé khứ hồi",
    titleEn: "Free Beverage Voucher for Round-Trips",
    code: "FREEWATER",
    expiryVn: "Hạn dùng: 31/08/2026",
    expiryEn: "Exp: Aug 31, 2026",
    image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
    tagVn: "Quà tặng",
    tagEn: "Free Gift"
  }
];

// DỮ LIỆU Ý KIẾN KHÁCH HÀNG
export const testimonialsData = [
    {
        id: 1,
        name: "Nguyễn Văn Hải",
        roleVn: "Hành khách thường xuyên (Quận 1)",
        roleEn: "Frequent Passenger (District 1)",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
        quoteVn: "Đi WaterBus đi làm hằng ngày giúp tôi tránh được hoàn toàn cảnh kẹt xe mệt mỏi trên đường Tôn Đức Thắng. Tàu chạy rất đúng giờ, không gian thoáng mát và mát mẻ vô cùng.",
        quoteEn: "Commuting by WaterBus daily helps me completely avoid the exhausting traffic on Ton Duc Thang street. The vessels are extremely punctual, spacious, and wonderfully cool.",
        rating: 5
    },
    {
        id: 2,
        name: "Sarah Jenkins",
        roleVn: "Khách du lịch (Australia)",
        roleEn: "Tourist (Australia)",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
        quoteVn: "Một trải nghiệm ngắm hoàng hôn trên sông Sài Gòn tuyệt vời với mức giá quá rẻ! Hệ thống đặt vé trực tuyến bằng mã QR cực kỳ nhanh chóng và tiện lợi cho người nước ngoài.",
        quoteEn: "An amazing sunset experience on the Saigon River for such an affordable price! The online QR ticketing system is incredibly fast and convenient for foreigners.",
        rating: 5
    },
    {
        id: 3,
        name: "Trần Minh Quân",
        roleVn: "Nhiếp ảnh gia tự do",
        roleEn: "Freelance Photographer",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop",
        quoteVn: "Tôi thường chọn các chuyến tàu chiều muộn để săn ảnh thành phố lên đèn. Nhân viên thân thiện, tàu chạy êm, boong tàu phía sau rộng rãi rất lý tưởng để tác nghiệp.",
        quoteEn: "I often choose late afternoon trips to capture city lights. Friendly staff, smooth sailing, and the spacious rear deck is just perfect for taking photos.",
        rating: 5
    }
];

// ẢNH SLIDE QUẢNG CÁO APP
export const appImages = [
    "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
    "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
    "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png"
];