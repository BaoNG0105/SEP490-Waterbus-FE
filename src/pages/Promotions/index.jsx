import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";

// MOCK DATA: Dữ liệu mẫu
const heroPromos = [
  {
    id: 1,
    title: { vn: "Giảm 20% cho nhóm 5 người", en: "20% Off for Groups of 5" },
    desc: {
      vn: "Trải nghiệm hải trình thượng lưu cùng bạn bè với mức giá ưu đãi đặc biệt trong mùa hè này. Chỉ áp dụng cho các tuyến nội thành.",
      en: "Experience luxury cruising with friends at a special discounted rate this summer. Applicable for inner-city routes only.",
    },
    img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2000",
  },
  {
    id: 2,
    title: { vn: "Hoàng hôn lãng mạn", en: "Romantic Sunset Cruise" },
    desc: {
      vn: "Tặng ngay 1 đồ uống miễn phí khi đặt vé chuyến 17:00. Ngắm Sài Gòn chuyển mình trong ánh hoàng hôn tuyệt đẹp.",
      en: "Get 1 free drink when booking the 17:00 trip. Watch Saigon transform in the beautiful sunset light.",
    },
    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2000",
  },
];

const promoCards = [
  {
    id: 1,
    title: { vn: "Thứ 4 vui vẻ", en: "Happy Wednesday" },
    desc: {
      vn: "Giảm ngay 50% giá vé cho tất cả hành khách đặt vé vào khung giờ vàng từ 14:00 - 16:00 mỗi thứ 4 hàng tuần. Đây là cơ hội tuyệt vời để bạn tận hưởng không gian sông nước tĩnh lặng giữa tuần làm việc căng thẳng.",
      en: "Get 50% off tickets for all passengers booking during the golden hours of 14:00 - 16:00 every Wednesday. This is a great opportunity to enjoy the tranquil river space during a stressful work week.",
    },
    img: "https://images.unsplash.com/photo-1528150395403-992a693e26c8?q=80&w=800",
    icon: "local_activity",
  },
  {
    id: 2,
    title: { vn: "Ưu đãi thẻ thành viên", en: "Member Privileges" },
    desc: {
      vn: "Tích lũy dặm bay sông nước để đổi lấy những chuyến đi miễn phí và dịch vụ phòng chờ hạng thương gia tại bến. Hạng thẻ Platinum còn được ưu tiên lên tàu và tặng thức uống chào mừng.",
      en: "Accumulate river miles to redeem free trips and business class lounge services at the station. Platinum cardholders also get priority boarding and a complimentary welcome drink.",
    },
    img: "https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?q=80&w=800",
    icon: "workspace_premium",
  },
  {
    id: 3,
    title: { vn: "Gói di chuyển công sở", en: "Corporate Commute" },
    desc: {
      vn: "Giải pháp di chuyển đường thủy tối ưu cho doanh nghiệp. Tiết kiệm 30% chi phí đi lại hàng tháng cho nhân viên, đi kèm hóa đơn VAT và báo cáo chi phí minh bạch hàng tháng.",
      en: "Optimal water transit solution for businesses. Save 30% on monthly commuting costs for employees, accompanied by VAT invoices and transparent monthly expense reports.",
    },
    img: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=800",
    icon: "corporate_fare",
  },
  {
    id: 4,
    title: { vn: "Combo Gia Đình", en: "Family Combo" },
    desc: {
      vn: "Miễn phí hoàn toàn vé cho trẻ em dưới 1m2 khi đi cùng 2 người lớn vào các ngày Thứ 7 và Chủ Nhật. Không gian khoang hành khách rộng rãi thích hợp cho xe nôi và đồ dùng trẻ em.",
      en: "Completely free tickets for children under 1.2m when accompanied by 2 adults on Saturdays and Sundays. Spacious passenger cabin space suitable for strollers and baby gear.",
    },
    img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800",
    icon: "family_restroom",
  },
];

export const Promotions = () => {
  const { lang } = useApp();

  // State quản lý Slider cho Hero Section
  const [currentSlide, setCurrentSlide] = useState(0);

  // State quản lý hiển thị Modal chi tiết Promo
  const [selectedPromo, setSelectedPromo] = useState(null);

  // Tự động chuyển slide Hero mỗi 5 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroPromos.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="pt-28 pb-20 bg-surface dark:bg-slate-900 transition-colors duration-300 min-h-screen relative">
      {/* Hero: Auto-sliding Banner */}
      <section className="px-4 md:px-8 max-w-7xl mx-auto mb-20">
        <div className="relative w-full h-[500px] rounded-[2rem] overflow-hidden group shadow-2xl">
          {heroPromos.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
            >
              {/* Ảnh nền */}
              <div className="absolute inset-0">
                <img
                  alt={slide.title[lang === "VN" ? "vn" : "en"]}
                  className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s]"
                  src={slide.img}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-transparent"></div>
              </div>

              {/* Nội dung chữ */}
              <div className="relative h-full flex flex-col justify-center px-8 md:px-16 max-w-3xl">
                <h1 className="text-4xl md:text-6xl font-bold font-headline text-white leading-[1.1] mb-6 tracking-tighter">
                  {slide.title[lang === "VN" ? "vn" : "en"]}
                </h1>
                <p className="text-base md:text-lg text-white/80 font-body mb-8 max-w-xl line-clamp-3">
                  {slide.desc[lang === "VN" ? "vn" : "en"]}
                </p>
                <div className="flex items-center gap-4">
                  {/* Nút Cuộn trang */}
                  <button
                    onClick={() => {
                      document
                        .getElementById("promotions-grid")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    className="bg-primary-container dark:bg-yellow-400 text-slate-900 px-8 py-4 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg"
                  >
                    {lang === "VN" ? "Khám phá ngay" : "Explore Now"}
                    <span className="material-symbols-outlined">
                      arrow_downward
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Slider Controls */}
          <div className="absolute bottom-10 right-10 md:right-16 flex gap-3 z-20">
            {heroPromos.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${currentSlide === idx
                  ? "w-12 bg-primary-container dark:bg-yellow-400"
                  : "w-6 bg-white/30 hover:bg-white/50"
                  }`}
              ></div>
            ))}
          </div>
        </div>
      </section>

      {/* Promotions Grid Section (Đã gắn ID để nút cuộn tìm tới) */}
      <section
        id="promotions-grid"
        className="px-4 md:px-8 max-w-7xl mx-auto scroll-mt-24"
      >
        <div className="flex flex-col mb-12">
          <h2 className="text-4xl font-bold font-headline tracking-tighter mb-2 text-slate-900 dark:text-white">
            {lang === "VN" ? "Ưu đãi hiện hành" : "Current Offers"}
          </h2>
          <p className="text-on-surface-variant dark:text-white/60 font-label">
            {lang === "VN"
              ? "Chọn gói dịch vụ phù hợp để tối ưu hóa trải nghiệm của bạn."
              : "Select the right package to optimize your experience."}
          </p>
        </div>

        {/* Grid Danh sách thẻ khuyến mãi (Loại bỏ filter, render trực tiếp từ promoCards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {promoCards.map((promo) => (
            <div
              key={promo.id}
              className="group bg-surface-container-lowest dark:bg-slate-800 rounded-[2.5rem] p-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-surface-variant dark:border-slate-700"
            >
              <div
                className="relative h-64 rounded-[2rem] overflow-hidden mb-6 cursor-pointer"
                onClick={() => setSelectedPromo(promo)}
              >
                <img
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={promo.title[lang === "VN" ? "vn" : "en"]}
                  src={promo.img}
                />
              </div>
              <div className="px-4 pb-4 flex flex-col h-[calc(100%-18rem)] justify-between">
                <div>
                  <h3 className="text-2xl font-bold font-headline mb-3 tracking-tight text-slate-900 dark:text-white group-hover:text-primary dark:group-hover:text-yellow-400 transition-colors">
                    {promo.title[lang === "VN" ? "vn" : "en"]}
                  </h3>
                  <p className="text-on-surface-variant dark:text-white/70 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {promo.desc[lang === "VN" ? "vn" : "en"]}
                  </p>
                </div>
                {/* Nút Xem chi tiết kích hoạt Modal */}
                <button
                  onClick={() => setSelectedPromo(promo)}
                  className="w-full py-4 rounded-xl border-2 border-outline-variant dark:border-slate-600 font-bold text-sm text-slate-700 dark:text-white hover:bg-primary hover:border-primary hover:text-white dark:hover:bg-yellow-400 dark:hover:border-yellow-400 dark:hover:text-slate-900 transition-colors flex items-center justify-center gap-2 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 dark:group-hover:bg-slate-700"
                >
                  {lang === "VN" ? "Xem chi tiết" : "View Details"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-20 bg-slate-900 rounded-[3rem] p-8 md:p-12 overflow-hidden relative shadow-2xl">
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-30 pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-container dark:from-yellow-400 via-transparent to-transparent"></div>
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold font-headline text-white mb-4 tracking-tighter">
                {lang === "VN"
                  ? "Đừng bỏ lỡ hành trình tiếp theo"
                  : "Don't miss the next journey"}
              </h2>
              <p className="text-white/70 font-body text-sm md:text-base">
                {lang === "VN"
                  ? "Đăng ký nhận bản tin để cập nhật những ưu đãi sớm nhất và mã giảm giá độc quyền qua email của bạn."
                  : "Subscribe to our newsletter for early access to offers and exclusive discount codes via email."}
              </p>
            </div>
            <form
              className="flex w-full lg:w-auto gap-3 flex-col sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                className="bg-white/10 border border-white/20 rounded-full px-6 py-4 text-white font-label flex-grow md:w-72 focus:ring-2 focus:ring-primary-container dark:focus:ring-yellow-400 outline-none placeholder:text-white/40"
                placeholder={
                  lang === "VN" ? "Email của bạn..." : "Your email..."
                }
                type="email"
                required
              />
              <button
                type="submit"
                className="bg-primary-container dark:bg-yellow-400 text-slate-900 px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform whitespace-nowrap shadow-lg"
              >
                {lang === "VN" ? "Đăng ký" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* MODAL HIỂN THỊ CHI TIẾT KHUYẾN MÃI */}
      {selectedPromo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-[fadeIn_0.3s_ease-out] flex flex-col md:flex-row max-h-[90vh]">
            {/* Nút đóng */}
            <button
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
              onClick={() => setSelectedPromo(null)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Ảnh Cover (Cột trái trên Desktop, Box trên Mobile) */}
            <div className="md:w-5/12 h-48 md:h-auto shrink-0 relative">
              <img
                alt={selectedPromo.title[lang === "VN" ? "vn" : "en"]}
                className="w-full h-full object-cover"
                src={selectedPromo.img}
              />
            </div>

            {/* Nội dung chi tiết (Cột phải trên Desktop) */}
            <div className="p-8 md:p-10 flex flex-col h-full overflow-y-auto no-scrollbar md:w-7/12">
              <h3 className="font-headline text-3xl font-bold mb-6 text-slate-900 dark:text-white leading-tight">
                {selectedPromo.title[lang === "VN" ? "vn" : "en"]}
              </h3>

              <div className="prose prose-slate dark:prose-invert font-body text-slate-600 dark:text-white/70 mb-8 flex-grow">
                <p className="leading-relaxed">
                  {selectedPromo.desc[lang === "VN" ? "vn" : "en"]}
                </p>
                {/* Bạn có thể bổ sung thêm các quy định điều khoản cụ thể ở đây sau này nếu có API */}
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary dark:text-yellow-400">
                      check_circle
                    </span>{" "}
                    Áp dụng cho mọi hình thức thanh toán.
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary dark:text-yellow-400">
                      check_circle
                    </span>{" "}
                    Không có giá trị quy đổi thành tiền mặt.
                  </li>
                </ul>
              </div>

              {/* Nút Đặt vé CTA trong Modal */}
              <a
                href="/#booking-section"
                onClick={(e) => {
                  setSelectedPromo(null); // Đóng modal

                  // Nếu vô tình đang ở trang chủ thì chỉ cần cuộn xuống, không cần load lại trang
                  if (window.location.pathname === "/") {
                    e.preventDefault();
                    document
                      .getElementById("booking-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="w-full bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 py-4 rounded-xl font-headline font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md mt-auto"
              >
                {lang === "VN" ? "Đặt vé nhận ưu đãi" : "Book with Offer"}
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
