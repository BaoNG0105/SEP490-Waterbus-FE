import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // Import Link để điều hướng các marker trên bản đồ
import { useApp } from "../../context/AppContext";

const heroSlides = [
  {
    type: "youtube",
    videoId: "AzBaYqeO8WE",
  },
  {
    type: "image",
    src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png",
  },
  {
    type: "image",
    src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg",
  },
  {
    type: "image",
    src: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png",
  },
];

// DỮ LIỆU TỌA ĐỘ CÁC TRẠM TRÊN BẢN ĐỒ
const mapStations = [
  {
    id: "bach-dang",
    nameVN: "Bến Bạch Đằng",
    nameEN: "Bach Dang Station",
    top: "88%",
    left: "33%",
  },
  {
    id: "thu-thiem",
    nameVN: "Bến Thủ Thiêm",
    nameEN: "Thu Thiem Port",
    top: "85%",
    left: "42%",
  },
  {
    id: "binh-an",
    nameVN: "Bến Bình An",
    nameEN: "Binh An Port",
    top: "57%",
    left: "54.5%",
  },
  {
    id: "thanh-da",
    nameVN: "Bến Thanh Đa",
    nameEN: "Thanh Da Station",
    top: "28%",
    left: "43%",
  },
  {
    id: "linh-dong",
    nameVN: "Bến Linh Đông",
    nameEN: "Linh Dong Station",
    top: "6%",
    left: "71.5%",
  },
];

// Thông báo (Hardcode)
const announcements = [
  {
    vn: "[THÔNG BÁO] Từ ngày 15/04/2026, hành khách tại Sân bay/Bến tàu cần thực hiện khai báo thông tin trước khi lên tàu.",
    en: "[NOTICE] From April 15, 2026, passengers must declare information before boarding.",
  },
  {
    vn: "[KHUYẾN MÃI] Nhập mã SUMMER26 giảm ngay 20% cho các chuyến đi trong tuần. Số lượng có hạn!",
    en: "[PROMOTION] Enter code SUMMER26 for 20% off weekday trips. Limited quantity!",
  },
  {
    vn: "[TIN TỨC] WaterBus chính thức mở thêm tuyến mới nối liền Quận 1 và Quận 7 vào tháng 6 này.",
    en: "[NEWS] WaterBus officially opens a new route connecting District 1 and District 7 this June.",
  },
];

// Quảng cáo (Hardcode)
const promoPosters = [
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800",
  "https://images.unsplash.com/photo-1528150395403-992a693e26c8?q=80&w=800",
];

// Ưu đãi (Hardcode)
const promoCards = [
  {
    id: 1,
    tag: { vn: "Mới nhất", en: "Newest" },
    title: { vn: "Thứ 4 vui vẻ", en: "Happy Wednesday" },
    desc: {
      vn: "Giảm ngay 50% giá vé cho tất cả hành khách đặt vé vào khung giờ vàng từ 14:00 - 16:00 mỗi thứ 4 hàng tuần.",
      en: "Get 50% off tickets for all passengers booking during the golden hours of 14:00 - 16:00 every Wednesday.",
    },
    img: "https://images.unsplash.com/photo-1528150395403-992a693e26c8?q=80&w=800",
  },
  {
    id: 2,
    tag: { vn: "Member Only", en: "Member Only" },
    title: { vn: "Ưu đãi thẻ thành viên", en: "Member Privileges" },
    desc: {
      vn: "Tích lũy dặm bay sông nước để đổi lấy những chuyến đi miễn phí và dịch vụ phòng chờ hạng thương gia tại bến.",
      en: "Accumulate river miles to redeem free trips and business class lounge services at the station.",
    },
    img: "https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?q=80&w=800",
  },
  {
    id: 3,
    tag: { vn: "Doanh nghiệp", en: "Corporate" },
    title: { vn: "Gói di chuyển công sở", en: "Corporate Commute" },
    desc: {
      vn: "Giải pháp di chuyển đường thủy tối ưu cho doanh nghiệp. Tiết kiệm 30% chi phí đi lại hàng tháng cho nhân viên.",
      en: "Optimal water transit solution for businesses. Save 30% on monthly commuting costs for employees.",
    },
    img: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=800",
  },
  {
    id: 4,
    tag: { vn: "Cuối tuần", en: "Weekend" },
    title: { vn: "Combo Gia Đình", en: "Family Combo" },
    desc: {
      vn: "Miễn phí hoàn toàn vé cho trẻ em dưới 1m2 khi đi cùng 2 người lớn vào các ngày Thứ 7 và Chủ Nhật.",
      en: "Completely free tickets for children under 1.2m when accompanied by 2 adults on Saturdays and Sundays.",
    },
    img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800",
  },
];

// Đánh giá (Hardcode)
const testimonials = [
  {
    name: "Trần Thảo Vy",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBrNSk9BqdRAed-iWcBtJs40kmiP7nRfT6hQtrE4L-7WCnjYWJPPYNMelRE67KMhTgTbvaYqMshhgvbEdy4X1QfpQ3HT1kPHgFDyEWb4VVNcDNCjYmuSEO7RSYOMbuRvKKz8QaYtiAiMi75qhY0J1hrnZBxVykWUKmzDZ9vbWmIcpkVlG_zp3cHbNY-dBHahHvbcDGIvjOHCtWh8jEP1kPj0J1DuIRFfnp2ictfnfF_4mOgIS8Ks49dCC2-llOZLSVg1-C2ERnJEWLQ",
    quote:
      "The best way to commute in Saigon. No traffic, clean air, and always on time. Highly recommended for daily travel.",
  },
  {
    name: "Lê Anh Tú",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDnqcaVG7bAoxxZtz7En4UNSJfzRK_w0p3swT-DvFArsWG4EWHS83crseUb7CjVD5A62eE49XvX_inMlfqSjXRbZmsLTcPtnB5E3iOOjY8oelZ0kAT5-ASVxrqFRSEEy7bkuuvZIcc_lVMD7WMGmOqDiZmOkmNkt4DMRlwhAMVjTxVKv73Nrcb0MLb7ub0B5aC2tFYFmHm3HIx2u57qxP4xG7EKPe9hvMtBNkk9lEpQ_sKwkIyS-WLF59-jpNBE47F_WyIp-4z_AM1D",
    quote:
      "Luxurious experience at an affordable price. The Wi-Fi is fast and the cabin is super comfortable.",
  },
  {
    name: "Phan Minh Hạnh",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBwQAXy32-vnB6cACwmtGP72n_hgRe8XR3TyFchbCmT6qiHcSmIv0zG7EwJ01mcCWz_Jb6eHHyDu0dJOMAN7ZQUZMTJ-spql8n3Nqb5Kn3g3rQWh3grbHaA6vBOSZ6TStM_lc_43utIl7btl90-py07kTD7vMasPtct9u6dScFOxh0FCRV1p9FMEFyPVQi0HCDeIlRYokmF9J5slp8ZGBKJwCBPGIlghcg1WQChW1eCz4q9mDQEoOJ_-4xQbcrxkdqiKEWjKKX8HIXK",
    quote:
      "Efficient and futuristic. I love the simple booking process and the views are just incredible.",
  },
];

export const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { lang } = useApp();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoSlide, setPromoSlide] = useState(0);
  const [showNoticeBar, setShowNoticeBar] = useState(true);
  const [noticeIndex, setNoticeIndex] = useState(0);

  // Auto-cycle cho thanh thông báo (Chỉnh thành 12 giây để khớp với 1 vòng chạy chữ)
  useEffect(() => {
    if (!showNoticeBar) return;
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % announcements.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [showNoticeBar]);

  // Hàm điều hướng thông báo Trái/Phải
  const nextNotice = () =>
    setNoticeIndex((prev) => (prev + 1) % announcements.length);
  const prevNotice = () =>
    setNoticeIndex((prev) =>
      prev === 0 ? announcements.length - 1 : prev - 1,
    );

  // Auto-cycle cho Hero Slides
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(slideTimer);
  }, []);

  // GSAP Reveal Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.1 },
    );
    const elements = document.querySelectorAll(".gsap-reveal");
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  // Hiển thị Modal sau 3 giây (chỉ hiện 1 lần mỗi phiên truy cập để tránh làm phiền)
  useEffect(() => {
    const hasSeenPromo = sessionStorage.getItem("hasSeenPromo");
    if (!hasSeenPromo) {
      const timer = setTimeout(() => {
        setShowPromoModal(true);
        sessionStorage.setItem("hasSeenPromo", "true");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Tự động chuyển slide trong Modal quảng cáo mỗi 3s
  useEffect(() => {
    if (!showPromoModal) return;
    const slideTimer = setInterval(() => {
      setPromoSlide((prev) => (prev + 1) % promoPosters.length);
    }, 3000);
    return () => clearInterval(slideTimer);
  }, [showPromoModal]);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(slideTimer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.1 },
    );

    const elements = document.querySelectorAll(".gsap-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <main className="dark:bg-slate-900 transition-colors duration-300">
      {/* THANH THÔNG BÁO */}
      {showNoticeBar && (
        <div className="fixed top-0 left-0 w-full h-10 bg-white dark:bg-slate-900 border-b border-surface-variant/50 dark:border-slate-700 z-[120] flex items-center justify-between px-4 md:px-8 shadow-sm transition-colors duration-300">
          {/* Cụm Icon chuông */}
          <div className="flex items-center shrink-0 z-10 bg-white dark:bg-slate-900 py-2 pr-3">
            <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-[18px] animate-pulse">
              notifications_active
            </span>
          </div>

          {/* Cụm Nội dung chữ chạy băng chuyền */}
          <div className="flex-1 relative h-full flex items-center overflow-hidden group">
            {/* CSS Keyframes inline cho hiệu ứng băng chuyền */}
            <style>{`
              @keyframes text-ticker {
                0% { left: 100%; transform: translateX(0); }
                100% { left: 0; transform: translateX(-100%); }
              }
              .animate-ticker {
                position: absolute;
                white-space: nowrap;
                animation: text-ticker 12s linear infinite;
              }
            `}</style>

            {/* Thẻ p sẽ bị reset lại animation mỗi khi noticeIndex thay đổi nhờ thuộc tính key */}
            <p
              key={noticeIndex}
              className="text-xs md:text-sm font-body font-medium text-slate-700 dark:text-slate-300 animate-ticker group-hover:[animation-play-state:paused] cursor-default"
            >
              {lang === "VN"
                ? announcements[noticeIndex].vn
                : announcements[noticeIndex].en}
            </p>
          </div>

          {/* Cụm Nút điều hướng & Đóng (Luôn nổi lên trên để không bị chữ đè) */}
          <div className="flex items-center gap-1 shrink-0 ml-4 z-10 bg-white dark:bg-slate-900 pl-2">
            <button
              onClick={prevNotice}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                chevron_left
              </span>
            </button>
            <button
              onClick={nextNotice}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                chevron_right
              </span>
            </button>

            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-1 md:mx-2"></div>

            <button
              onClick={() => setShowNoticeBar(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                close
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section (Đã tích hợp Booking form) */}
      <section className="relative h-[100dvh] flex items-center justify-center overflow-hidden bg-slate-900 pt-20">
        {/* Background Slides */}
        <div className="absolute inset-0 z-0">
          {heroSlides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              {slide.type === "youtube" ? (
                <iframe
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full object-cover scale-[4] sm:scale-[2] md:scale-125 lg:scale-110 pointer-events-none"
                  src={`https://www.youtube.com/embed/${slide.videoId}?autoplay=1&mute=1&loop=1&playlist=${slide.videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : slide.type === "video" ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  src={slide.src}
                />
              ) : (
                <img
                  alt={`Saigon Waterbus Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                  src={slide.src}
                />
              )}
            </div>
          ))}
          <div className="absolute inset-0 hero-gradient z-20"></div>
        </div>

        {/* Nội dung chính chia 2 cột */}
        <div className="container mx-auto px-6 md:px-12 relative z-30 flex flex-col lg:flex-row items-center justify-between gap-12 w-full">
          {/* Cột Trái: Title */}
          <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start gsap-reveal">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline font-bold text-white tracking-tighter leading-tight drop-shadow-lg">
              <span className="text-white italic block mb-2">
                {lang === "VN" ? "Chào mừng tới" : "Welcome to"}
              </span>
              <div className="text-white italic text-primary-container">
                WaterBus
              </div>
            </h1>
            <p className="text-white/80 font-body text-lg mt-6 max-w-lg hidden md:block">
              {lang === "VN"
                ? "Trải nghiệm ngắm nhìn Sài Gòn tuyệt đẹp trên những chuyến tàu hiện đại, an toàn và đúng giờ."
                : "Experience the beautiful views of Saigon on modern, safe, and punctual river buses."}
            </p>
          </div>

          {/* Cột Phải: Booking Block */}
          <div
            className="flex-1 w-full flex justify-center lg:justify-end gsap-reveal"
            id="booking-section"
          >
            <div className="w-full max-w-md bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 border border-white/20 dark:border-slate-700/50 transition-colors duration-300">
              {/* Tabs Khứ hồi / Một chiều */}
              <div className="flex gap-2 p-1.5 bg-surface-container-highest dark:bg-slate-700/50 rounded-2xl w-full mb-6">
                <button className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-600 shadow-sm text-primary dark:text-yellow-400 transition-colors">
                  {lang === "VN" ? "Một chiều" : "One way"}
                </button>
                <button className="flex-1 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant dark:text-white/70 hover:text-primary dark:hover:text-yellow-400 transition-colors">
                  {lang === "VN" ? "Khứ hồi" : "Round trip"}
                </button>
              </div>

              {/* Form Lưới vuông (2x2) */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60 ml-1">
                    {lang === "VN" ? "Nơi đi" : "Where to go"}
                  </label>
                  <select className="w-full bg-surface-container-low dark:bg-slate-700 dark:text-white border-none rounded-2xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none px-4 py-3.5 cursor-pointer appearance-none">
                    <option>Bạch Đằng</option>
                    <option>Thủ thiêm</option>
                    <option>Bình An</option>
                    <option>Thanh Đa</option>
                    <option>Linh Đông</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60 ml-1">
                    {lang === "VN" ? "Nơi đến" : "Destination"}
                  </label>
                  <select className="w-full bg-surface-container-low dark:bg-slate-700 dark:text-white border-none rounded-2xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none px-4 py-3.5 cursor-pointer appearance-none">
                    <option>Thủ thiêm</option>
                    <option>Bạch Đằng</option>
                    <option>Bình An</option>
                    <option>Thanh Đa</option>
                    <option>Linh Đông</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60 ml-1">
                    {lang === "VN" ? "Ngày đi" : "Departure"}
                  </label>
                  <input
                    className="w-full bg-surface-container-low dark:bg-slate-700 dark:text-white border-none rounded-2xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none px-4 py-3.5 cursor-pointer"
                    type="date"
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60 ml-1">
                    {lang === "VN" ? "Ngày về" : "Return"}
                  </label>
                  <input
                    className="w-full bg-surface-container-low dark:bg-slate-700 dark:text-white/50 border-none rounded-2xl font-headline font-bold focus:ring-2 ring-primary transition-colors outline-none px-4 py-3.5 cursor-not-allowed opacity-60"
                    type="date"
                    disabled
                  />
                </div>
              </div>

              {/* Nút Tìm kiếm */}
              <button className="w-full bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 py-4 rounded-2xl font-bold font-label hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg">
                <span className="material-symbols-outlined">search</span>
                {lang === "VN" ? "Tìm chuyến" : "Search Trips"}
              </button>
            </div>
          </div>
        </div>

        {/* Nút Scroll Down (Đặt tuyệt đối ở giữa cạnh dưới màn hình) */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 hidden md:block">
          <a
            href="#mission-section"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#mission-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="inline-flex flex-col items-center gap-3 gsap-reveal cursor-pointer opacity-70 hover:opacity-100 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-8 h-[50px] border-2 border-white rounded-full flex justify-center items-start p-1.5">
              <div className="w-1 h-3 bg-white rounded-full animate-bounce mt-1"></div>
            </div>
            <span className="text-white text-[10px] font-label uppercase tracking-widest font-bold">
              {lang === "VN" ? "Khám phá thêm" : "Scroll Down"}
            </span>
          </a>
        </div>

        {/* Nút chấm chuyển Slide */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "bg-primary-container w-8"
                  : "bg-white/50 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Mission Section */}
      <section
        id="mission-section"
        className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300"
      >
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="gsap-reveal">
            <span className="text-primary dark:text-yellow-400 font-bold text-sm tracking-[0.2em] uppercase mb-4 block">
              {lang === "VN" ? "Sứ Mệnh Của Chúng Tôi" : "Our Mission"}
            </span>
            <h2 className="text-5xl font-headline font-bold mb-8 leading-tight dark:text-white">
              {lang === "VN"
                ? "Nâng tầm di chuyển đô thị bằng hệ thống giao thông thủy bền vững."
                : "Elevating Urban Mobility Through Sustainable Water Transit."}
            </h2>
            <p className="text-on-surface-variant dark:text-white/80 text-lg leading-relaxed mb-10 font-body">
              {lang === "VN"
                ? "Waterbus đang định hình lại cách người dân TPHCM di chuyển. Kết hợp công nghệ hàng hải tiên tiến với thẩm mỹ cổ điển, chúng tôi mang đến một trải nghiệm di chuyển đáng tin cậy và ngoạn mục."
                : "Waterbus is redefining how Ho Chi Minh City moves. By combining cutting-edge hydro-sonic engineering with a classic maritime aesthetic, we offer a transit experience that is as reliable as it is breathtaking."}
            </p>
            <div className="grid grid-cols-2 gap-8 border-t border-surface-variant dark:border-slate-700 pt-10">
              <div>
                <div className="text-4xl font-headline font-bold text-primary dark:text-yellow-400">
                  15 min
                </div>
                <p className="text-xs font-bold text-outline dark:text-white/60 uppercase mt-2">
                  {lang === "VN" ? "Tần suất cao điểm" : "Peak frequency"}
                </p>
              </div>
              <div>
                <div className="text-4xl font-headline font-bold text-primary dark:text-yellow-400">
                  100%
                </div>
                <p className="text-xs font-bold text-outline dark:text-white/60 uppercase mt-2">
                  {lang === "VN" ? "Năng lượng sạch" : "Clean Energy Goal"}
                </p>
              </div>
            </div>
          </div>
          <div className="relative gsap-reveal group cursor-pointer">
            <div className="absolute -inset-4 bg-primary/10 dark:bg-yellow-400/10 rounded-[3rem] -rotate-3 transition-all duration-700 group-hover:rotate-0 group-hover:scale-105 group-hover:bg-primary/20 dark:group-hover:bg-yellow-400/20"></div>
            <div className="relative overflow-hidden rounded-[2.5rem] shadow-2xl">
              <img
                alt="Fleet"
                className="w-full transition-all duration-700 ease-out group-hover:scale-110 group-hover:brightness-110"
                src="https://res.cloudinary.com/dygipvoal/image/upload/v1776076390/x2bpvdexfabamjssoeno.webp"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Guidline Section */}
      <section className="py-24 dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-headline font-bold dark:text-white">
              {lang === "VN" ? "Quy Trình Đặt Vé" : "Booking Process"}
            </h2>
            <p className="text-on-surface-variant dark:text-white/80 mt-2 font-label">
              {lang === "VN"
                ? "Đơn giản hóa hành trình của bạn với 4 bước"
                : "Simplifying your commute in four easy steps"}
            </p>
          </div>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Step 1 */}
              <div className="flex-1 w-full relative group cursor-pointer">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 text-center transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:bg-primary/5 dark:group-hover:bg-yellow-400/10 group-hover:border-primary/50 dark:group-hover:border-yellow-400/50 relative overflow-hidden">
                  <div className="absolute top-2 right-6 text-7xl font-bold text-primary/5 dark:text-white/5 font-headline pointer-events-none transition-colors duration-500 group-hover:text-primary/20 dark:group-hover:text-yellow-400/20">
                    01
                  </div>
                  <div className="w-16 h-16 bg-primary/10 dark:bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:bg-primary dark:group-hover:bg-yellow-400 group-hover:scale-110 group-hover:rotate-12">
                    <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl transition-colors duration-500 group-hover:text-white dark:group-hover:text-slate-900">
                      route
                    </span>
                  </div>
                  <h4 className="font-bold text-lg mb-2 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Chọn Tuyến" : "Choose Route"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70">
                    {lang === "VN"
                      ? "Chọn điểm khởi hành và điểm đến."
                      : "Pick your departure and arrival stations."}
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex items-center text-primary/30 dark:text-white/20">
                <span className="material-symbols-outlined text-4xl">east</span>
              </div>

              {/* Step 2 */}
              <div className="flex-1 w-full relative group cursor-pointer">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 text-center transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:bg-primary/5 dark:group-hover:bg-yellow-400/10 group-hover:border-primary/50 dark:group-hover:border-yellow-400/50 relative overflow-hidden">
                  <div className="absolute top-2 right-6 text-7xl font-bold text-primary/5 dark:text-white/5 font-headline pointer-events-none transition-colors duration-500 group-hover:text-primary/20 dark:group-hover:text-yellow-400/20">
                    02
                  </div>
                  <div className="w-16 h-16 bg-primary/10 dark:bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:bg-primary dark:group-hover:bg-yellow-400 group-hover:scale-110 group-hover:rotate-12">
                    <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl transition-colors duration-500 group-hover:text-white dark:group-hover:text-slate-900">
                      event_seat
                    </span>
                  </div>
                  <h4 className="font-bold text-lg mb-2 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Chọn Ghế" : "Select Seat"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70">
                    {lang === "VN"
                      ? "Lựa chọn vị trí ngồi ưa thích của bạn."
                      : "Browse available seats and select your preference."}
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex items-center text-primary/30 dark:text-white/20">
                <span className="material-symbols-outlined text-4xl">east</span>
              </div>

              {/* Step 3 */}
              <div className="flex-1 w-full relative group cursor-pointer">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 text-center transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:bg-primary/5 dark:group-hover:bg-yellow-400/10 group-hover:border-primary/50 dark:group-hover:border-yellow-400/50 relative overflow-hidden">
                  <div className="absolute top-2 right-6 text-7xl font-bold text-primary/5 dark:text-white/5 font-headline pointer-events-none transition-colors duration-500 group-hover:text-primary/20 dark:group-hover:text-yellow-400/20">
                    03
                  </div>
                  <div className="w-16 h-16 bg-primary/10 dark:bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:bg-primary dark:group-hover:bg-yellow-400 group-hover:scale-110 group-hover:rotate-12">
                    <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl transition-colors duration-500 group-hover:text-white dark:group-hover:text-slate-900">
                      payments
                    </span>
                  </div>
                  <h4 className="font-bold text-lg mb-2 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Thanh Toán" : "Payment"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70">
                    {lang === "VN"
                      ? "Thanh toán an toàn qua nhiều phương thức."
                      : "Secure checkout with various payment methods."}
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex items-center text-primary/30 dark:text-white/20">
                <span className="material-symbols-outlined text-4xl">east</span>
              </div>

              {/* Step 4 */}
              <div className="flex-1 w-full relative group cursor-pointer">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 text-center transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:bg-primary/5 dark:group-hover:bg-yellow-400/10 group-hover:border-primary/50 dark:group-hover:border-yellow-400/50 relative overflow-hidden">
                  <div className="absolute top-2 right-6 text-7xl font-bold text-primary/5 dark:text-white/5 font-headline pointer-events-none transition-colors duration-500 group-hover:text-primary/20 dark:group-hover:text-yellow-400/20">
                    04
                  </div>
                  <div className="w-16 h-16 bg-primary/10 dark:bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:bg-primary dark:group-hover:bg-yellow-400 group-hover:scale-110 group-hover:rotate-12">
                    <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl transition-colors duration-500 group-hover:text-white dark:group-hover:text-slate-900">
                      confirmation_number
                    </span>
                  </div>
                  <h4 className="font-bold text-lg mb-2 font-headline text-slate-900 dark:text-white">
                    {lang === "VN" ? "Nhận Vé" : "Get Ticket"}
                  </h4>
                  <p className="text-sm text-on-surface-variant dark:text-white/70">
                    {lang === "VN"
                      ? "Nhận vé điện tử ngay lập tức qua email."
                      : "Receive your e-ticket instantly via app/email."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stations Section */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
            <div>
              <h2 className="text-4xl font-headline font-bold dark:text-white">
                {lang === "VN" ? "Hệ Thống Bến Tàu" : "Station System"}
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 mt-2 font-label uppercase tracking-widest text-xs font-bold">
                {lang === "VN" ? "Bản đồ tuyến đường thủy" : "Water route map"}
              </p>
            </div>
          </div>

          {/* Bản đồ tương tác */}
          <div className="relative w-full rounded-[3rem] overflow-hidden shadow-2xl border border-surface-variant dark:border-slate-700 gsap-reveal bg-slate-100 dark:bg-slate-800">
            {/* Hình nền bản đồ (Dùng w-full h-auto để ảnh không bao giờ bị cắt xén) */}
            <img
              src="https://res.cloudinary.com/dygipvoal/image/upload/v1776757476/luzqh5q31dxxqvnpovir.png"
              alt="Saigon River Route Map"
              className="w-full h-auto block opacity-90 dark:opacity-60 dark:invert dark:hue-rotate-180 transition-all duration-500"
            />

            {/* Các điểm đánh dấu trạm (Markers) */}
            {mapStations.map((station) => (
              <Link
                key={station.id}
                to={`/stations/${station.id}`}
                className="absolute group flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 hover:z-30"
                style={{ top: station.top, left: station.left }}
              >
                {/* Khối Tooltip hiện khi trỏ chuột */}
                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
                  <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-sm font-bold font-headline whitespace-nowrap shadow-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary dark:text-yellow-500">
                      directions_boat
                    </span>
                    {lang === "VN" ? station.nameVN : station.nameEN}
                  </div>
                  {/* Tam giác nhỏ trỏ xuống */}
                  <div className="w-3 h-3 bg-slate-900 dark:bg-white rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                </div>

                {/* Chấm tròn nhấp nháy trên bản đồ (Đã thu nhỏ lại một chút để vừa với map mới) */}
                <div className="relative flex items-center justify-center w-6 h-6">
                  {/* Vòng tròn lan tỏa (Radar ping) */}
                  <div className="absolute w-full h-full bg-red-500/50 dark:bg-yellow-400/50 rounded-full animate-ping"></div>
                  {/* Lõi chấm tròn cứng */}
                  <div className="relative w-3.5 h-3.5 bg-red-500 dark:bg-yellow-400 border-2 border-white dark:border-slate-900 rounded-full shadow-lg group-hover:scale-150 transition-transform duration-300"></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Schedules Section */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="gsap-reveal">
              <h2 className="text-4xl font-headline font-bold mb-6 dark:text-white">
                {lang === "VN" ? "Lịch Trình Hàng Tuần" : "Weekly Schedules"}
              </h2>
              <p className="text-on-surface-variant dark:text-white/80 mb-8 leading-relaxed">
                {lang === "VN"
                  ? "Luôn đúng giờ với dịch vụ tần suất cao của chúng tôi. Các chuyến tàu khởi hành mỗi 15-30 phút trong giờ cao điểm."
                  : "Stay on track with our high-frequency service. We run every 15-30 minutes during peak hours to ensure you're never late."}
              </p>
              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center py-4 border-b border-surface-variant dark:border-slate-700">
                  <span className="font-bold dark:text-white">
                    {lang === "VN" ? "Giờ cao điểm" : "Weekday Peak"}
                  </span>
                  <span className="text-primary dark:text-yellow-400 font-headline">
                    {lang === "VN" ? "15 phút" : "Every 15 mins"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-surface-variant dark:border-slate-700">
                  <span className="font-bold dark:text-white">
                    {lang === "VN" ? "Giờ thấp điểm" : "Weekday Off-Peak"}
                  </span>
                  <span className="text-primary dark:text-yellow-400 font-headline">
                    {lang === "VN" ? "30 phút" : "Every 30 mins"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-surface-variant dark:border-slate-700">
                  <span className="font-bold dark:text-white">
                    {lang === "VN"
                      ? "Cuối tuần / Ngày lễ"
                      : "Weekend / Holiday"}
                  </span>
                  <span className="text-primary dark:text-yellow-400 font-headline">
                    {lang === "VN" ? "20 phút" : "Every 20 mins"}
                  </span>
                </div>
              </div>
              <button className="bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                {lang === "VN" ? "Xem chi tiết lịch" : "View Full Schedule"}
                <span className="material-symbols-outlined text-sm">
                  open_in_new
                </span>
              </button>
            </div>
            <div className="gsap-reveal flex justify-center lg:justify-end">
              <img
                src="https://res.cloudinary.com/dygipvoal/image/upload/v1776076502/blwmejqkkpkfclbx0l96.jpg"
                alt="Waterbus Schedule"
                className="w-full max-w-xl rounded-[2rem] shadow-2xl object-contain border border-surface-variant dark:border-slate-700 transition-transform duration-500 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROMOTIONS SECTION */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Header & View All Link */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
            <div>
              <h2 className="text-4xl font-headline font-bold dark:text-white">
                {lang === "VN" ? "Ưu Đãi Nổi Bật" : "Featured Promotions"}
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 mt-2 font-label uppercase tracking-widest text-xs font-bold">
                {lang === "VN"
                  ? "Khám phá các chương trình khuyến mãi"
                  : "Discover our latest offers"}
              </p>
            </div>
            <Link
              to="/promotions"
              className="text-primary dark:text-yellow-400 font-bold flex items-center gap-2 hover:gap-4 transition-all whitespace-nowrap"
            >
              {lang === "VN" ? "Xem tất cả" : "View All"}
              <span className="material-symbols-outlined">east</span>
            </Link>
          </div>

          {/* Slider Khuyến Mãi (Cuộn ngang - Dạng Card Hình Vuông) */}
          <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory no-scrollbar -mx-6 px-6 md:mx-0 md:px-0">
            {promoCards.map((promo) => (
              <Link
                key={promo.id}
                to="/promotions"
                className="w-[85vw] sm:w-[320px] aspect-square shrink-0 snap-center group bg-white dark:bg-slate-800 rounded-[2.5rem] p-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-surface-variant dark:border-slate-700 flex flex-col"
              >
                <div className="relative flex-1 rounded-[2rem] overflow-hidden mb-4">
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={promo.title[lang === "VN" ? "vn" : "en"]}
                    src={promo.img}
                  />
                  {/* Nhãn tag nổi */}
                  <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold text-primary dark:text-yellow-400 uppercase shadow-sm">
                    {promo.tag[lang === "VN" ? "vn" : "en"]}
                  </div>
                </div>

                <div className="px-2 pb-1 shrink-0">
                  <h3 className="text-lg font-bold font-headline mb-1.5 tracking-tight text-slate-900 dark:text-white group-hover:text-primary dark:group-hover:text-yellow-400 transition-colors line-clamp-1">
                    {promo.title[lang === "VN" ? "vn" : "en"]}
                  </h3>
                  <p className="text-on-surface-variant dark:text-white/70 text-xs line-clamp-2 leading-relaxed">
                    {promo.desc[lang === "VN" ? "vn" : "en"]}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* User Testimonials Section */}
      <section className="py-24 overflow-hidden bg-surface-container-low dark:bg-slate-900 transition-colors duration-300">
        <div className="container text-center mx-auto px-6 mb-12">
          <h2 className="text-4xl font-headline font-bold dark:text-white">
            {lang === "VN" ? "Đánh Giá Của Khách Hàng" : "User Testimonials"}
          </h2>
          <p className="text-on-surface-variant dark:text-white/80 mt-2">
            {lang === "VN"
              ? "Những du khách thường xuyên nói gì về chúng tôi"
              : "What our frequent travelers are saying"}
          </p>
        </div>
        <div className="relative flex overflow-x-hidden group">
          <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
            <div className="flex gap-8 px-4 shrink-0 py-4">
              {testimonials.map((item, index) => (
                <div
                  key={`set1-${index}`}
                  className="w-[350px] whitespace-normal bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-surface-variant dark:border-slate-700 flex flex-col justify-between transition-all duration-500 cursor-pointer hover:scale-110 hover:shadow-2xl hover:z-10 hover:border-primary/50 dark:hover:border-yellow-400/50"
                >
                  <div>
                    <p className="italic text-on-surface-variant dark:text-white/80 leading-relaxed mb-8">
                      "{item.quote}"
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <img
                      alt={item.name}
                      className="w-12 h-12 rounded-full bg-surface-container-high dark:bg-slate-700"
                      src={item.avatar}
                    />
                    <div>
                      <h5 className="font-bold text-sm dark:text-white">
                        {item.name}
                      </h5>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-8 px-4 shrink-0 py-4">
              {testimonials.map((item, index) => (
                <div
                  key={`set2-${index}`}
                  className="w-[350px] whitespace-normal bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-surface-variant dark:border-slate-700 flex flex-col justify-between transition-all duration-500 cursor-pointer hover:scale-110 hover:shadow-2xl hover:z-10 hover:border-primary/50 dark:hover:border-yellow-400/50"
                >
                  <div>
                    <p className="italic text-on-surface-variant dark:text-white/80 leading-relaxed mb-8">
                      "{item.quote}"
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <img
                      alt={item.name}
                      className="w-12 h-12 rounded-full bg-surface-container-high dark:bg-slate-700"
                      src={item.avatar}
                    />
                    <div>
                      <h5 className="font-bold text-sm dark:text-white">
                        {item.name}
                      </h5>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto bg-slate-900 dark:bg-slate-800 rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-2xl transition-colors">
            <div className="md:w-1/2 p-12 lg:p-16">
              <h2 className="text-4xl font-headline font-bold text-white mb-6">
                {lang === "VN" ? "Kết Nối Với Chúng Tôi" : "Connect with Us"}
              </h2>
              <p className="text-white/60 mb-10">
                {lang === "VN"
                  ? "Bạn có câu hỏi về tuyến đường hoặc thuê tàu riêng? Hãy liên hệ và đội ngũ của chúng tôi sẽ hỗ trợ trong vòng 24 giờ."
                  : "Have questions about our routes or private charters? Reach out and our team will assist you within 24 hours."}
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-white">
                  <span className="material-symbols-outlined text-primary dark:text-yellow-400">
                    phone_in_talk
                  </span>
                  <span className="font-medium">+84 (0) 28 3822 0000</span>
                </div>
                <div className="flex items-center gap-4 text-white">
                  <span className="material-symbols-outlined text-primary dark:text-yellow-400">
                    mail
                  </span>
                  <span className="font-medium">hello@rivernav.vn</span>
                </div>
                <div className="flex items-center gap-4 text-white">
                  <span className="material-symbols-outlined text-primary dark:text-yellow-400">
                    location_on
                  </span>
                  <span className="font-medium">
                    10B Ton Duc Thang, Dist. 1, HCMC
                  </span>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 bg-white dark:bg-slate-700 p-12 lg:p-16 transition-colors">
              <form className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/70">
                      {lang === "VN" ? "Họ và Tên" : "Full Name"}
                    </label>
                    <input
                      className="w-full bg-surface-container-low dark:bg-slate-600 dark:text-white border-none rounded-xl focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none"
                      type="text"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/70">
                      Email
                    </label>
                    <input
                      className="w-full bg-surface-container-low dark:bg-slate-600 dark:text-white border-none rounded-xl focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none"
                      type="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/70">
                    {lang === "VN" ? "Tin Nhắn" : "Message"}
                  </label>
                  <textarea
                    className="w-full bg-surface-container-low dark:bg-slate-600 dark:text-white border-none rounded-xl focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none"
                    rows="4"
                  ></textarea>
                </div>
                <button className="w-full bg-primary dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 py-4 rounded-xl font-bold font-label hover:brightness-110 transition-all">
                  {lang === "VN" ? "Gửi Tin Nhắn" : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL QUẢNG CÁO */}
      {showPromoModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl animate-[fadeIn_0.4s_ease-out]">
            {/* Nút đóng */}
            <button
              className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md transition-colors"
              onClick={() => setShowPromoModal(false)}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>

            {/* Slider Hình ảnh (Tỷ lệ 4:5 dọc) */}
            <div className="relative w-full aspect-[4/5] bg-slate-100 dark:bg-slate-800">
              {promoPosters.map((poster, index) => (
                <img
                  key={index}
                  src={poster}
                  alt="Promotion"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    index === promoSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                />
              ))}
              {/* Lớp gradient làm nền cho chữ dễ đọc hơn */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent z-20"></div>
            </div>

            {/* Nội dung & Nút bấm (Nằm đè lên phần dưới của ảnh) */}
            <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center text-center z-30">
              <span className="inline-block px-3 py-1 bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 text-[10px] font-bold rounded-full mb-3 uppercase tracking-widest">
                {lang === "VN" ? "Ưu đãi giới hạn" : "Limited Offer"}
              </span>
              <h3 className="text-2xl font-headline font-bold text-white mb-6 shadow-sm">
                {lang === "VN"
                  ? "Nhận Deal hấp dẫn cùng WaterBus"
                  : "Get attractive deals with WaterBus"}
              </h3>

              <Link
                to="/promotions"
                className="w-full bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 py-4 rounded-xl font-headline font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg"
              >
                {lang === "VN"
                  ? "Xem chi tiết ưu đãi"
                  : "View Promotion Details"}
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </Link>
            </div>

            {/* Nút chuyển slide nhỏ (Dots) ở góc trên */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {promoPosters.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === promoSlide ? "w-4 bg-white" : "w-1.5 bg-white/50"
                  }`}
                ></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
