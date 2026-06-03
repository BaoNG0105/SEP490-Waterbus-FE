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

// DỮ LIỆU TỌA ĐỘ VÀ THÔNG TIN CHI TIẾT CÁC TRẠM
export const mapStations = [
    {
        id: "bach-dang",
        nameVN: "Bến Bạch Đằng",
        nameEN: "Bach Dang Station",
        lat: 10.7728,
        lng: 106.7064,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776076390/x2bpvdexfabamjssoeno.webp",
        addressVN: "10B Tôn Đức Thắng, P. Bến Nghé, Quận 1, TP.HCM",
        addressEN: "10B Ton Duc Thang, Ben Nghe Ward, Dist. 1, HCMC",
        timeVN: "07:00 - 22:30 hàng ngày",
        timeEN: "07:00 AM - 10:30 PM daily",
    },
    {
        id: "thu-thiem",
        nameVN: "Bến Thủ Thiêm",
        nameEN: "Thu Thiem Port",
        lat: 10.7712,
        lng: 106.7118,
        image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800",
        addressVN: "Đường hầm Sông Sài Gòn, TP. Thủ Đức, TP.HCM",
        addressEN: "Saigon River Tunnel, Thu Duc City, HCMC",
        timeVN: "07:00 - 22:30 hàng ngày",
        timeEN: "07:00 AM - 10:30 PM daily",
    },
    {
        id: "binh-an",
        nameVN: "Bến Bình An",
        nameEN: "Binh An Port",
        lat: 10.7931,
        lng: 106.7230,
        image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800",
        addressVN: "Khu đô thị Bình An, Phường Bình An, TP. Thủ Đức",
        addressEN: "Binh An Urban Area, Binh An Ward, Thu Duc City",
        timeVN: "07:30 - 21:00 hàng ngày",
        timeEN: "07:30 AM - 09:00 PM daily",
    },
    {
        id: "thanh-da",
        nameVN: "Bến Thanh Đa",
        nameEN: "Thanh Da Station",
        lat: 10.8206,
        lng: 106.7176,
        image: "https://images.unsplash.com/photo-1528150395403-992a693e26c8?q=80&w=800",
        addressVN: "Bán đảo Thanh Đa, Phường 27, Quận Bình Thạnh",
        addressEN: "Thanh Da Peninsula, Ward 27, Binh Thanh Dist.",
        timeVN: "08:00 - 20:30 hàng ngày",
        timeEN: "08:00 AM - 08:30 PM daily",
    },
    {
        id: "linh-dong",
        nameVN: "Bến Linh Đông",
        nameEN: "Linh Dong Station",
        lat: 10.8351,
        lng: 106.7328,
        image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=800",
        addressVN: "Phường Linh Đông, TP. Thủ Đức, TP.HCM",
        addressEN: "Linh Dong Ward, Thu Duc City, HCMC",
        timeVN: "06:30 - 20:00 hàng ngày",
        timeEN: "06:30 AM - 08:00 PM daily",
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

// DỮ LIỆU TIN TỨC
export const newsData = [
    {
        id: 1,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
        dateVn: "15 Tháng 06, 2026",
        dateEn: "Jun 15, 2026",
        categoryVn: "Sự kiện",
        categoryEn: "Event",
        titleVn: "WaterBus khai trương tuyến mới nối liền Quận 1 và Quận 7",
        titleEn: "WaterBus opens a new route connecting District 1 and District 7",
        descVn: "Nhằm đáp ứng nhu cầu di chuyển ngày càng cao, tuyến đường thủy mới sẽ giúp rút ngắn thời gian di chuyển và mang lại trải nghiệm ngắm cảnh tuyệt vời cho hành khách.",
        descEn: "To meet the growing commuting needs, the new waterway route will shorten travel time and provide an excellent sightseeing experience for passengers."
    },
    {
        id: 2,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
        dateVn: "10 Tháng 06, 2026",
        dateEn: "Jun 10, 2026",
        categoryVn: "Thông báo",
        categoryEn: "Notice",
        titleVn: "Cập nhật lịch hoạt động xuyên suốt dịp Lễ Quốc Khánh 2/9",
        titleEn: "Operation schedule update during the Independence Day Holiday",
        descVn: "Hệ thống sẽ tăng cường thêm 20% số chuyến vào các khung giờ cao điểm ban đêm.",
        descEn: "The system will increase trips by 20% during night peak hours."
    },
    {
        id: 3,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
        dateVn: "05 Tháng 06, 2026",
        dateEn: "Jun 05, 2026",
        categoryVn: "Dịch vụ",
        categoryEn: "Service",
        titleVn: "Ra mắt tính năng đặt vé tàu Charter (bao trọn chuyến)",
        titleEn: "Launching the online Charter booking feature",
        descVn: "Dễ dàng xem báo giá và đặt trọn gói chuyến tàu riêng chỉ với vài thao tác click chuột.",
        descEn: "Easily view quotes and book a private boat trip with just a few clicks."
    },
    {
        id: 4,
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
        dateVn: "01 Tháng 06, 2026",
        dateEn: "Jun 01, 2026",
        categoryVn: "Cộng đồng",
        categoryEn: "Community",
        titleVn: "Đồng hành cùng chiến dịch làm sạch Sông Sài Gòn 2026",
        titleEn: "Join the Saigon River Cleanup Campaign 2026",
        descVn: "WaterBus tự hào tài trợ và tham gia chiến dịch bảo vệ môi trường dòng sông.",
        descEn: "WaterBus is proud to sponsor and join the river environmental protection campaign."
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