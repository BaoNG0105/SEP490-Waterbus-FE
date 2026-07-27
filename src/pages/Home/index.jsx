import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import 'leaflet/dist/leaflet.css';
import { fetchAllStations } from "../../services/stationService";
import { WaterwayMap } from "../../components/WaterwayMap";
import { fetchPublishedBlogPosts, labelBlogCategory } from "../../services/blogService";
import { fetchPublicPromotions } from "../../services/promotionService";
import { ContactForm } from "../../components/ContactForm";

const heroVideo = "https://res.cloudinary.com/dygipvoal/video/upload/v1783865624/q7gde8dluohboeqjzdtx.mp4";
const fallbackPromoImg = "https://res.cloudinary.com/dygipvoal/image/upload/v1782999909/xpsin48malhqhy5c53oi.png";

import {
  testimonialsData,
  appImages
} from "../../data/homeData";


// Khoảng thời gian phát của video Hero
const HERO_VIDEO_START = 6;
const HERO_VIDEO_END = 139;

export const Home = () => {
  const { lang } = useApp(); // Lấy ngôn ngữ hiện tại từ context để hiển thị nội dung phù hợp

  // Ref tham chiếu tới video nền Hero để điều khiển đoạn phát
  const heroVideoRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  // Đặt video bắt đầu từ giây HERO_VIDEO_START khi vừa tải xong metadata
  const handleHeroVideoLoadedMetadata = () => {
    if (heroVideoRef.current) {
      heroVideoRef.current.currentTime = HERO_VIDEO_START;
    }
  };

  // Khi phát tới giây HERO_VIDEO_END thì quay lại HERO_VIDEO_START để lặp lại đúng đoạn mong muốn
  const handleHeroVideoTimeUpdate = () => {
    if (heroVideoRef.current && heroVideoRef.current.currentTime >= HERO_VIDEO_END) {
      heroVideoRef.current.currentTime = HERO_VIDEO_START;
    }
  };

  // Khai báo state quản lý danh sách nhà ga gọi từ API
  const [stationPoints, setStationPoints] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);

  // Khối xử lý lọc riêng các trạm Waterbus chính thức (isWaterbusStation: true)
  const waterbusStations = useMemo(() => {
    return stationPoints.filter(st => st.isWaterbusStation === true);
  }, [stationPoints]);

  // State quản lý danh sách Blog
  const [blogs, setBlogs] = useState([]);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);

  // State quản lý danh sách Khuyến mãi công khai
  const [promotions, setPromotions] = useState([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);

  // Danh sách khuyến mãi có ảnh, dùng làm poster cho Modal Quảng Cáo (dữ liệu thật thay cho mock)
  const promoPosterSlides = useMemo(
    () => promotions.filter((promo) => promo.imageUrl),
    [promotions]
  );

  // Các state hiển thị
  const [heroSlide, setHeroSlide] = useState(0);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoSlide, setPromoSlide] = useState(0);

  // Quản lý Slide ảnh của App Download Section
  const [appSlide, setAppSlide] = useState(0);

  // Quản lý Slide chạy tự động cho phần Testimonials
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Hàm chuyển testimonial tiếp theo và trước đó
  const nextTestimonial = () => setCurrentTestimonial((prev) => (prev + 1) % testimonialsData.length);
  const prevTestimonial = () => setCurrentTestimonial((prev) => (prev === 0 ? testimonialsData.length - 1 : prev - 1));

  // Blog Slide tự động chạy sau mỗi 5 giây
  useEffect(() => {
    if (blogs.length === 0) return;
    const heroTimer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % blogs.length);
    }, 5000); // Bạn có thể chỉnh 5000 (5 giây) thành thời gian bạn muốn
    return () => clearInterval(heroTimer);
  }, [blogs.length]);

  // useEffect tải dữ liệu nhà ga
  useEffect(() => {
    const loadStationsData = async () => {
      try {
        setIsLoadingStations(true);
        const data = await fetchAllStations();
        setStationPoints(data || []);
      } catch (error) {
        console.error("Lỗi tải sơ đồ nhà ga trang chủ:", error);
      } finally {
        setIsLoadingStations(false);
      }
    };
    loadStationsData();
  }, []);

  // useEffect tự động gọi API lấy Blog khi vào trang Home
  useEffect(() => {
    const loadBlogs = async () => {
      try {
        setIsLoadingBlogs(true);
        const data = await fetchPublishedBlogPosts();
        // API đã trả về đúng các bài viết mới nhất (theo PublishedAt), nên ta chỉ việc set state
        setBlogs(data || []);
      } catch (error) {
        console.error("Lỗi khi tải danh sách blog:", error);
      } finally {
        setIsLoadingBlogs(false);
      }
    };
    loadBlogs();
  }, []);

  // useEffect tự động gọi API lấy Khuyến mãi công khai khi vào trang Home
  useEffect(() => {
    const loadPromotions = async () => {
      try {
        setIsLoadingPromotions(true);
        const data = await fetchPublicPromotions();
        setPromotions(data || []);
      } catch (error) {
        console.error("Lỗi khi tải danh sách khuyến mãi:", error);
      } finally {
        setIsLoadingPromotions(false);
      }
    };
    loadPromotions();
  }, []);

  // Testimonials tự động chạy sau mỗi 6 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonialsData.length);
    }, 6000); // Tự động trượt sau mỗi 6 giây
    return () => clearInterval(timer);
  }, []);

  // Auto-cycle cho App Download Section
  useEffect(() => {
    const timer = setInterval(() => {
      setAppSlide((prev) => (prev + 1) % appImages.length);
    }, 4000);
    return () => clearInterval(timer);
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

  // Hiển thị Modal Quảng Cáo sau 3 giây (chỉ khi đã có ảnh khuyến mãi thật để hiển thị)
  useEffect(() => {
    const hasSeenPromo = sessionStorage.getItem("hasSeenPromo");
    if (!hasSeenPromo && promoPosterSlides.length > 0) {
      const timer = setTimeout(() => {
        setShowPromoModal(true);
        sessionStorage.setItem("hasSeenPromo", "true");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [promoPosterSlides.length]);

  // Tự động chuyển slide trong Modal Quảng Cáo khi nó đang hiển thị
  useEffect(() => {
    if (!showPromoModal || promoPosterSlides.length === 0) return;
    const slideTimer = setInterval(() => {
      setPromoSlide((prev) => (prev + 1) % promoPosterSlides.length);
    }, 3000);
    return () => clearInterval(slideTimer);
  }, [showPromoModal, promoPosterSlides.length]);

  // Icon cuộn hero: thấp ở đáy — ẩn khi đã lướt xuống
  useEffect(() => {
    const onScroll = () => {
      setShowScrollHint(window.scrollY < 48);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="dark:bg-slate-900 transition-colors duration-300 relative">
      {/* ===== HERO SECTION & BOOKING FORM ===== */}
      <section id="booking-section" className="relative min-h-[90vh] lg:min-h-screen flex flex-col justify-center items-center overflow-hidden select-none bg-slate-900">
        {/* Video nền Hero tự động phát, lặp lại, tắt tiếng */}
        <div className="absolute inset-0 z-0">
          <video
            ref={heroVideoRef}
            src={heroVideo}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={handleHeroVideoLoadedMetadata}
            onTimeUpdate={handleHeroVideoTimeUpdate}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          {/* Lớp phủ Gradient */}
          <div className="absolute inset-0 bg-linear-to-b from-slate-950/50 via-slate-900/40 to-[#124757]/30"></div>
        </div>
        {/* Khối Nội Dung Chính */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 md:px-12 pt-32 pb-28 flex flex-col items-center justify-center space-y-12">
          {/* Tiêu Đề */}
          <div className="text-center space-y-4 max-w-4xl gsap-reveal">
            <h1 className="text-6xl md:text-8xl font-headline font-black text-white leading-tight drop-shadow-md">
              {lang === "VN" ? "Welcome to" : "Chào mừng đến"}{" "}
              <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-amber-300">
                {lang === "VN" ? "Waterbus" : "Waterbus"}
              </span>
            </h1>
          </div>
        </div>

        {/* Mũi tên chuột cuộn xuống — neo đáy hero, biến mất khi scroll */}
        <a
          href="/#services-section"
          aria-label={lang === "VN" ? "Khám phá dịch vụ" : "Explore Services"}
          aria-hidden={!showScrollHint}
          tabIndex={showScrollHint ? 0 : -1}
          className={`absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80 transition-all duration-300 hover:text-yellow-400 md:bottom-10 ${
            showScrollHint
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0"
          }`}
        >
          <span className="flex h-11 w-7 justify-center rounded-full border-2 border-current pt-2">
            <span className="h-2 w-1 rounded-full bg-current animate-scroll-wheel"></span>
          </span>
          <span className="material-symbols-outlined text-xl">
            keyboard_arrow_down
          </span>
        </a>
      </section>

      {/* ===== MiSSON SECTION ===== */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Khối Nội Dung Bên Trái */}
          <div className="space-y-6">
            <span className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Sứ mệnh của chúng tôi" : "Our Mission"}
            </span>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white leading-tight">
              {lang === "VN"
                ? "Kiến tạo chuẩn mực mới cho di chuyển đô thị"
                : "Redefining The Standard Of Urban Mobility"}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-body text-base leading-relaxed">
              {lang === "VN"
                ? "Waterbus đang định hình lại tương lai của giao thông đô thị bằng cách khai phá tiềm năng to lớn của mạng lưới sông ngòi Sài Gòn. Chúng tôi không chỉ cung cấp một phương tiện đi lại thông thường, mà mang đến một giải pháp di chuyển xanh, bền vững, giúp giảm tải ùn tắc đường bộ nghiêm trọng, tiết kiệm thời gian quý báu của hành khách và kiến tạo những trải nghiệm hành trình thư thái, kết nối sâu sắc con người với cảnh quan thiên nhiên tráng lệ của thành phố."
                : "Waterbus is reshaping the future of urban transportation by unlocking the immense potential of Saigon's river network. We don't just provide a standard transit method; we offer a green, sustainable mobility solution that alleviates severe road congestion, saves precious passenger time, and creates relaxed journey experiences that deeply connect people with the magnificent natural landscapes of the city."}
            </p>
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-headline font-black text-yellow-500 dark:text-yellow-400">
                  15min
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {lang === "VN" ? "Tần suất cao điểm" : "Peak frequency"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "VN" ? "Các chuyến tàu chạy liên tục không lo chờ đợi" : "Continuous trips with zero waiting time"}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-headline font-black text-yellow-500 dark:text-yellow-400">
                  100%
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {lang === "VN" ? "Năng lượng sạch" : "Clean energy"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "VN" ? "Hướng tới hệ sinh thái giao thông không phát thải" : "Towards a zero-emission transit ecosystem"}
                </p>
              </div>
            </div>
          </div>
          {/* Khối Hình Ảnh Bên Phải */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-video lg:aspect-square">
            <img
              src="https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg"
              alt="Waterbus Mission Visual"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-900/40 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section id="services-section" className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300 select-none">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Tiêu đề & Subtitle */}
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Đặt vé trực tuyến" : "Online Booking"}
            </p>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Hành trình dành riêng cho bạn" : "Journeys Crafted For You"}
            </h2>
          </div>
          {/* Grid 3 thẻ điều hướng dịch vụ đặt vé */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 gsap-reveal">
            {/* Thẻ điều hướng: Đặt vé Waterbus*/}
            <Link
              to="/waterbus-booking"
              className="group flex flex-col bg-white dark:bg-slate-800 rounded-4xl shadow-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
            >
              <div className="relative aspect-4/3 overflow-hidden shrink-0">
                <img
                  src="https://res.cloudinary.com/dygipvoal/image/upload/v1783792724/cqi2n26pl7etht4ad5q3.webp"
                  alt={lang === "VN" ? "Đặt vé Waterbus" : "Waterbus Booking"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 via-slate-900/10 to-transparent"></div>
              </div>
              <div className="flex flex-col justify-between flex-1 p-7 space-y-3">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                    {lang === "VN" ? "Tuyến cố định" : "Scheduled Route"}
                  </span>
                  <h3 className="text-2xl font-headline font-black text-[#124757] dark:text-white leading-snug">
                    {lang === "VN" ? "Đặt vé Waterbus" : "Waterbus Booking"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === "VN"
                      ? "Di chuyển nhanh chóng theo lịch trình cố định giữa các bến tàu."
                      : "Travel quickly along fixed schedules between wharves."}
                  </p>
                </div>
                <div className="pt-5 flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                    {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700 group-hover:bg-yellow-400 transition-colors duration-300"></span>
                </div>
              </div>
            </Link>
            {/* Thẻ điều hướng: Đặt vé WaterSightseeing */}
            <Link
              to="/watersightseeing-booking"
              className="group flex flex-col bg-white dark:bg-slate-800 rounded-4xl shadow-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
            >
              <div className="relative aspect-4/3 overflow-hidden shrink-0">
                <img
                  src="https://res.cloudinary.com/dygipvoal/image/upload/v1783792723/qozuixs81skui0fwokvm.webp"
                  alt={lang === "VN" ? "Đặt vé WaterSightseeing" : "WaterSightseeing Booking"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 via-slate-900/10 to-transparent"></div>
              </div>
              <div className="flex flex-col justify-between flex-1 p-7 space-y-3">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                    {lang === "VN" ? "Trải nghiệm ngắm cảnh" : "Scenic Experience"}
                  </span>
                  <h3 className="text-2xl font-headline font-black text-[#124757] dark:text-white leading-snug">
                    {lang === "VN" ? "Đặt vé WaterSightseeing" : "WaterSightseeing Booking"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === "VN"
                      ? "Tận hưởng hành trình ngắm cảnh thành phố dọc theo dòng sông."
                      : "Enjoy a leisurely sightseeing journey along the river."}
                  </p>
                </div>
                <div className="pt-5 flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                    {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700 group-hover:bg-yellow-400 transition-colors duration-300"></span>
                </div>
              </div>
            </Link>
            {/* Thẻ điều hướng: Dịch vụ thuê tàu (Charter) */}
            <Link
              to="/charter-booking"
              className="group flex flex-col bg-white dark:bg-slate-800 rounded-4xl shadow-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
            >
              <div className="relative aspect-4/3 overflow-hidden shrink-0">
                <img
                  src="https://res.cloudinary.com/dygipvoal/image/upload/v1784048440/vmxcyra8r6ykzkonjbaz.jpg"
                  alt={lang === "VN" ? "Dịch vụ thuê tàu" : "Request Booking"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 via-slate-900/10 to-transparent"></div>
              </div>
              <div className="flex flex-col justify-between flex-1 p-7 space-y-3">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                    {lang === "VN" ? "Riêng tư & Linh hoạt" : "Private & Flexible"}
                  </span>
                  <h3 className="text-2xl font-headline font-black text-[#124757] dark:text-white leading-snug">
                    {lang === "VN" ? "Dịch vụ thuê tàu" : "Request Booking"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === "VN"
                      ? "Thiết kế hành trình riêng theo yêu cầu cho nhóm hoặc sự kiện."
                      : "Design a private journey tailored for groups or events."}
                  </p>
                </div>
                <div className="pt-5 flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                    {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700 group-hover:bg-yellow-400 transition-colors duration-300"></span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* STATION SECTION */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Tiêu đề & Subtitle */}
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Mạng lưới bến tàu" : "Operational Grid"}
            </p>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Mạng lưới bến tàu kết nối khắp thành phố" : "A City-Wide Network Of Waterway Stations"}
            </h2>
          </div>
          {/* Bản đồ */}
          <div className="w-full h-125 md:h-145 relative">
            {isLoadingStations ? (
              <div className="w-full h-full bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center border border-dashed border-slate-200">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
              </div>
            ) : (
              // Gọi tấm bản đồ số truyền mảng dữ liệu động từ API trạm bến
              <WaterwayMap
                stationsList={waterbusStations}
                stationAsFlag
                showStationLabels
                showStationImages
              />
            )}
          </div>
        </div>
      </section>

      {/* ===== SCHEDULE SECTION ===== */}
      <section className="py-24 bg-surface-container-low dark:bg-slate-900 transition-colors duration-300 select-none">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Khối Thông Tin Bên Trái */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-32">
            <span className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Thời gian hoạt động" : "Operation Hours"}
            </span>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white leading-tight">
              {lang === "VN"
                ? "Lịch trình linh hoạt, sẵn sàng cho mọi hành trình"
                : "Flexible Schedules, Ready For Every Journey"}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-body text-base leading-relaxed">
              {lang === "VN"
                ? "Hệ thống vận hành liên tục từ sáng sớm đến tối muộn với tần suất tối ưu, đảm bảo đáp ứng trọn vẹn mọi nhu cầu di chuyển đi làm hay tham quan ngắm cảnh của quý khách."
                : "The system operates continuously from early morning until late at night with optimized frequency, fully meeting your daily commuting or sightseeing needs."}
            </p>
            <div className="pt-4">
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 text-[#124757] dark:text-yellow-400 border border-slate-200 dark:border-slate-700 px-8 py-3.5 rounded-full font-headline font-bold text-sm shadow-md hover:bg-yellow-400 hover:text-[#124757] dark:hover:bg-yellow-400 dark:hover:text-slate-900 hover:border-transparent transition-all duration-300 group"
              >
                {lang === "VN" ? "Xem chi tiết lịch trình" : "View Detailed Schedule"}
                <span className="material-symbols-outlined text-lg transition-transform duration-300 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>
          {/* CỘT PHẢI: CÁC KHỐI SỐ LIỆU */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 gsap-reveal">
            {/* Khối 1: Giờ Cao Điểm */}
            <div className="sm:col-span-2 bg-linear-to-br from-[#124757] to-[#1a657c] dark:from-yellow-400 dark:to-yellow-600 p-8 md:p-10 rounded-[2.5rem] shadow-xl text-white dark:text-slate-900 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 cursor-default">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-20 transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-12">
                <span className="material-symbols-outlined text-[180px]">directions_boat</span>
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold uppercase tracking-widest opacity-90">
                    {lang === "VN" ? "Giờ cao điểm (T2 - T6)" : "Weekday Peak Hours"}
                  </p>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-8xl md:text-9xl font-black font-headline tracking-tighter leading-none drop-shadow-md">
                    15
                  </span>
                  <span className="text-2xl md:text-3xl font-bold opacity-90">
                    {lang === "VN" ? "phút/chuyến" : "mins/trip"}
                  </span>
                </div>
              </div>
            </div>
            {/* Khối 2: Giờ Thấp Điểm */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col gap-6 group hover:border-[#124757]/50 dark:hover:border-yellow-400/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-default">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <p className="text-xs font-bold uppercase tracking-widest">
                  {lang === "VN" ? "Giờ thấp điểm" : "Off-Peak"}
                </p>
              </div>
              <div className="flex items-baseline gap-2 text-slate-900 dark:text-white group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors duration-300">
                <span className="text-6xl md:text-7xl font-black font-headline tracking-tighter leading-none">
                  30
                </span>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400">
                  {lang === "VN" ? "phút" : "mins"}
                </span>
              </div>
            </div>
            {/* Khối 3: Cuối Tuần & Lễ */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col gap-6 group hover:border-[#124757]/50 dark:hover:border-yellow-400/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-default">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <p className="text-xs font-bold uppercase tracking-widest">
                  {lang === "VN" ? "Cuối tuần & Lễ" : "Weekend/Holiday"}
                </p>
              </div>
              <div className="flex items-baseline gap-2 text-slate-900 dark:text-white group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors duration-300">
                <span className="text-6xl md:text-7xl font-black font-headline tracking-tighter leading-none">
                  20
                </span>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400">
                  {lang === "VN" ? "phút" : "mins"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROMOTION SECTIONS ===== */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300 select-none">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Tiêu đề & Subtitle */}
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Chương trình ưu đãi" : "Exclusive Offers"}
            </p>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Đặc quyền dành riêng cho hành khách" : "Exclusive Privileges For Our Passengers"}
            </h2>
          </div>
          {/* Grid danh sách các thẻ Khuyến mại (dữ liệu thật từ API getPublicPromotions) */}
          {isLoadingPromotions ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-medium">
              {lang === "VN" ? "Hiện chưa có khuyến mãi công khai." : "No public promotions right now."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {promotions.slice(0, 3).map((promo) => (
                <Link
                  key={promo.promotionCode}
                  to={`/promotions/${promo.promotionCode}`}
                  className="group relative aspect-3/4 rounded-4xl overflow-hidden shadow-lg block"
                >
                  <img
                    src={promo.imageUrl || fallbackPromoImg}
                    alt={promo.promotionName}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Lớp phủ chỉ hiện tên khuyến mãi khi hover */}
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/60 transition-colors duration-300 flex items-center justify-center p-8">
                    <h3 className="text-xl md:text-2xl font-headline font-bold text-white text-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      {promo.promotionName}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {/* Nút "Xem tất cả" */}
          <div className="mt-16 flex justify-center">
            <Link
              to="/promotions"
              className="bg-yellow-400 text-[#124757] px-10 py-3.5 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-yellow-300 hover:scale-105 hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              {lang === "VN" ? "Xem tất cả ưu đãi" : "View All Offers"}
              <span className="material-symbols-outlined text-lg">arrow_right_alt</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== BLOG SECTIONS ===== */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Tiêu đề & Subtitle */}
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Tin tức & Sự kiện" : "News & Events"}
            </p>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Những câu chuyện đáng đọc" : "Stories Worth Reading"}
            </h2>
          </div>

          {isLoadingBlogs ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : blogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-medium">
              {lang === "VN" ? "Hiện chưa có bài viết nào được xuất bản." : "No published articles available at the moment."}
            </div>
          ) : (
            <div className="relative group">
              {/* KHỐI SLIDER CHÍNH */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center min-h-100">
                {/* KHỐI TRÁI (5/12): TIÊU ĐỀ, TÓM TẮT, ACTION BUTTON */}
                <div className="order-2 lg:order-1 lg:col-span-5 flex flex-col justify-center space-y-6 animate-fade-in duration-500">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                      <span className="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2.5 py-1 rounded-md uppercase tracking-wider text-[10px]">
                        {labelBlogCategory(blogs[heroSlide].category, lang)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        {new Date(blogs[heroSlide].publishedAt).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US")}
                      </span>
                    </div>
                    {/* Tiêu đề */}
                    <h3 className="text-2xl md:text-4xl font-headline font-black text-[#124757] dark:text-white leading-tight tracking-tight hover:text-yellow-500 transition-colors">
                      <Link to={`/blog/${blogs[heroSlide].slug}`}>
                        {blogs[heroSlide].title}
                      </Link>
                    </h3>
                  </div>
                  {/* Summary */}
                  <p className="text-slate-600 dark:text-slate-400 font-body text-sm md:text-base leading-relaxed line-clamp-4">
                    {blogs[heroSlide].summary}
                  </p>
                  {/* Nút xem chi tiết */}
                  <div className="pt-2">
                    <Link
                      to={`/blog/${blogs[heroSlide].slug}`}
                      className="inline-flex items-center gap-2 font-headline font-black text-[#124757] dark:text-yellow-400 group/btn transition-colors w-max uppercase tracking-wider text-xs"
                    >
                      <span>{lang === "VN" ? "Xem chi tiết" : "Read Full Story"}</span>
                      <span className="material-symbols-outlined text-lg transition-transform duration-300 group-hover/btn:translate-x-1.5">
                        arrow_right_alt
                      </span>
                    </Link>
                  </div>
                </div>
                {/* KHỐI PHẢI (7/12): ẢNH */}
                <div className="order-1 lg:order-2 lg:col-span-7 relative aspect-16/10 sm:aspect-video w-full overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-500">
                  <img
                    src={blogs[heroSlide].imageUrl || "https://res.cloudinary.com/dygipvoal/image/upload/v1782999909/xpsin48malhqhy5c53oi.png"}
                    alt={blogs[heroSlide].title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* THANH ĐIỀU HƯỚNG DƯỚI ĐÁY: PHÂN TRANG DOTS VÀ NÚT NEXT/PREV */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-slate-200/60 dark:border-slate-800">
                {/* Các dấu chấm chỉ số slide (Dots indicator) */}
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full shadow-inner">
                  {blogs.slice(0, 6).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setHeroSlide(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${index === heroSlide
                        ? "w-6 bg-[#124757] dark:bg-yellow-400"
                        : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"
                        }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
                {/* Bộ nút mũi tên click chuyển dịch slide tuần hoàn */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setHeroSlide((prev) => (prev === 0 ? blogs.length - 1 : prev - 1))}
                    className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition-all shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined font-bold">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroSlide((prev) => (prev === blogs.length - 1 ? 0 : prev + 1))}
                    className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition-all shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined font-bold">chevron_right</span>
                  </button>
                </div>
              </div>
              {/* Nút "Xem tất cả" */}
              <div className="mt-16 flex justify-center">
                <Link
                  to="/blog"
                  className="bg-yellow-400 text-[#124757] px-10 py-3.5 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-yellow-300 hover:scale-105 hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  {lang === "VN" ? "Xem tất cả bài viết" : "View All Blogs"}
                  <span className="material-symbols-outlined text-lg">arrow_right_alt</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* App Download Section */}
      <section className="bg-[#124757] dark:bg-slate-900 py-16 md:py-0 overflow-hidden select-none border-t border-white/10 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20 min-h-125">
          {/* CỘT TRÁI: Slide Hình Ảnh App (Thiết kế xếp chồng) */}
          <div className="relative w-full h-87.5 md:h-125 flex items-center justify-center lg:justify-end">
            {/* Lớp trang trí phát sáng phía sau */}
            <div className="absolute w-62.5 md:w-87.5 h-62.5 md:h-87.5 bg-yellow-400/20 rounded-full blur-[80px]"></div>
            {/* Khung chứa các Slide Ảnh */}
            <div className="relative w-55 md:w-70 h-112.5 md:h-125 mt-10 md:mt-24 lg:mt-32">
              {appImages.map((img, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-all duration-1000 ease-in-out origin-bottom ${index === appSlide
                    ? "opacity-100 scale-100 z-20 rotate-0"
                    : "opacity-0 scale-95 z-0 translate-y-10 rotate-3"
                    }`}
                >
                  <img
                    src={img}
                    alt={`WaterBus App Screen ${index + 1}`}
                    className="w-full h-full object-cover rounded-4xl border-[6px] border-slate-900 shadow-2xl"
                    style={{
                      maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)"
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI: Nội dung Text & Mã QR */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-8 lg:py-24">
            {/* Tiêu đề & Subtitle */}
            <div className="space-y-4">
              <span className="text-sm font-bold uppercase tracking-widest text-yellow-400">
                {lang === "VN" ? "Tải ứng dụng WaterBus" : "Download WaterBus App"}
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-headline font-bold text-white leading-tight">
                {lang === "VN" ? "Đặt vé chỉ trong vài chạm," : "Book In Just A Tap,"}
                <br />
                <span className="text-yellow-400">
                  {lang === "VN" ? "thanh toán tức thì!" : "Pay With Effortless Ease!"}
                </span>
              </h2>
              <p className="text-white/70 font-body text-base md:text-lg max-w-lg leading-relaxed pt-2">
                {lang === "VN"
                  ? "Trải nghiệm tiện ích đặt vé, chọn ghế và nhận vé điện tử (QR Code) ngay trên điện thoại của bạn. Không cần xếp hàng, không lo hết vé."
                  : "Experience the convenience of booking, choosing seats, and receiving e-tickets (QR Code) right on your phone. No lines, no sold-out worries."}
              </p>
            </div>
            {/* Khối quét mã QR & Download Badges */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
              {/* Hình ảnh QR Code */}
              <div className="bg-white p-3 rounded-2xl shadow-lg shrink-0 hover:scale-105 transition-transform">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"
                  alt="QR Code"
                  className="w-24 h-24 object-contain"
                />
              </div>

              {/* Text hướng dẫn & Nút tải Store */}
              <div className="space-y-4 text-center sm:text-left">
                <p className="text-sm font-bold text-white/90 font-headline uppercase tracking-wide">
                  {lang === "VN" ? "Quét để tải ngay!" : "Scan to download!"}
                </p>
                <div className="flex gap-3">
                  <a href="#" className="hover:opacity-80 transition-opacity hover:-translate-y-1 transform duration-300">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                      alt="Download on App Store"
                      className="h-10 w-auto"
                    />
                  </a>
                  <a href="#" className="hover:opacity-80 transition-opacity hover:-translate-y-1 transform duration-300">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                      alt="Get it on Google Play"
                      className="h-10 w-auto"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Testimonials Section ===== */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300 select-none overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col items-center">
          {/* Khối tiêu đề căn giữa đồng bộ */}
          <div className="text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Đánh giá từ hành khách" : "Passenger Reviews"}
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Tiếng nói từ những hành khách của chúng tôi" : "Voices Of Our Passengers"}
            </h2>
          </div>
          {/* Khung Slider chính */}
          <div className="relative w-full bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-14 shadow-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
            {/* Icon Dấu ngoặc kép trang trí lớn tinh tế */}
            <span className="material-symbols-outlined text-6xl md:text-7xl text-[#124757]/10 dark:text-yellow-400/10 absolute top-8 left-8 md:top-10 md:left-12 pointer-events-none font-black">
              format_quote
            </span>
            {/* Nội dung Review chuyển đổi slide mượt mà */}
            <div className="w-full text-center space-y-6 relative min-h-40 flex flex-col justify-center items-center">
              {testimonialsData.map((item, index) => (
                <div
                  key={item.id}
                  className={`transition-all duration-700 ease-in-out flex flex-col items-center space-y-6 ${index === currentTestimonial
                    ? "opacity-100 scale-100 relative z-10"
                    : "opacity-0 scale-95 absolute z-0 pointer-events-none"
                    }`}
                >
                  {/* Lời trích dẫn của khách hàng */}
                  <p className="text-lg md:text-xl font-medium font-body text-slate-700 dark:text-slate-200 leading-relaxed max-w-3xl italic">
                    "{lang === "VN" ? item.quoteVn : item.quoteEn}"
                  </p>
                  {/* Khối thông tin Người đánh giá */}
                  <div className="flex items-center gap-3.5 pt-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#124757] dark:border-yellow-400 shadow-md shrink-0">
                      <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-headline font-bold text-base text-[#124757] dark:text-white leading-none">
                        {item.name}
                      </h4>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Nút mũi tên điều hướng Trái / Phải phẳng cao cấp */}
            <div className="absolute top-1/2 -translate-y-1/2 left-3 md:-left-6 right-3 md:-right-6 flex justify-between pointer-events-none z-30">
              <button
                onClick={prevTestimonial}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-slate-700 text-[#124757] dark:text-white border border-slate-200/60 dark:border-slate-600 shadow-md flex items-center justify-center pointer-events-auto hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 hover:scale-105 transition-all outline-none"
              >
                <span className="material-symbols-outlined text-xl font-bold">chevron_left</span>
              </button>
              <button
                onClick={nextTestimonial}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-slate-700 text-[#124757] dark:text-white border border-slate-200/60 dark:border-slate-600 shadow-md flex items-center justify-center pointer-events-auto hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 hover:scale-105 transition-all outline-none"
              >
                <span className="material-symbols-outlined text-xl font-bold">chevron_right</span>
              </button>
            </div>
          </div>
          {/* Hệ thống các chấm nhỏ Pagination hiển thị trạng thái slide hiện tại */}
          <div className="flex gap-2 mt-8 z-20">
            {testimonialsData.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`h-2 rounded-full transition-all duration-300 outline-none ${index === currentTestimonial
                  ? "w-6 bg-[#124757] dark:bg-yellow-400"
                  : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"
                  }`}
                title={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT SECTION ===== */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300 select-none">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Khối tiêu đề chính & phụ căn giữa hệ thống */}
          <div className="flex flex-col items-center text-center mb-16 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Liên hệ với chúng tôi" : "Get In Touch"}
            </p>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Luôn lắng nghe, luôn đồng hành cùng bạn" : "Always Here, Always Listening"}
            </h2>
          </div>
          {/* Chia layout 2 cột bất đối xứng */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* CỘT TRÁI (Tỷ lệ 5/12): THÔNG TIN LIÊN HỆ TRỰC TIẾP */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-headline font-bold text-slate-800 dark:text-white">
                  {lang === "VN" ? "Thông tin liên hệ" : "Contact Information"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-body leading-relaxed max-w-sm">
                  {lang === "VN"
                    ? "Mọi thắc mắc, phản hồi hoặc yêu cầu hỗ trợ kỹ thuật đặt vé, xin vui lòng kết nối trực tiếp với tổng đài đắc lực của chúng tôi."
                    : "For any inquiries, feedback, or technical assistance with booking, please feel free to reach out to our dedicated support center."}
                </p>
              </div>
              {/* Danh sách các khối thẻ thông tin */}
              <div className="space-y-6">
                {/* Hotline hỗ trợ */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757]">
                    <span className="material-symbols-outlined text-[22px]">call</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {lang === "VN" ? "Hotline hỗ trợ 24/7" : "Support Hotline"}
                    </p>
                    <p className="text-lg font-headline font-black text-[#124757] dark:text-white">
                      1900 636830
                    </p>
                  </div>
                </div>
                {/* Hộp thư điện tử */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757]">
                    <span className="material-symbols-outlined text-[22px]">mail</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {lang === "VN" ? "Email giao dịch" : "Email Address"}
                    </p>
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                      info@thuongnhat.com
                    </p>
                  </div>
                </div>
                {/* Trụ sở chính */}
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757] mt-0.5">
                    <span className="material-symbols-outlined text-[22px]">location_on</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {lang === "VN" ? "Trụ sở điều hành chính" : "Main Office"}
                    </p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed max-w-xs">
                      10B Tôn Đức Thắng, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* CỘT PHẢI (Tỷ lệ 7/12): FORM GỬI TIN NHẮN */}
            <div className="lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ===== MODAL QUẢNG CÁO ===== */}
      {
        showPromoModal && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-4xl overflow-hidden shadow-2xl animate-[fadeIn_0.4s_ease-out]">
              <button
                className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md transition-colors"
                onClick={() => setShowPromoModal(false)}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
              <div className="relative w-full aspect-4/5 bg-slate-100 dark:bg-slate-800">
                {promoPosterSlides.map((promo, index) => (
                  <img
                    key={promo.promotionCode}
                    src={promo.imageUrl}
                    alt={promo.promotionName}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === promoSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                      }`}
                  />
                ))}
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/20 to-transparent z-20"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center text-center z-30">
                <span className="inline-block px-3 py-1 bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 text-[10px] font-bold rounded-full mb-3 uppercase tracking-widest">
                  {lang === "VN" ? "Ưu đãi giới hạn" : "Limited Offer"}
                </span>
                <h3 className="text-2xl font-headline font-bold text-white mb-6 shadow-sm line-clamp-2">
                  {promoPosterSlides[promoSlide]?.promotionName ||
                    (lang === "VN"
                      ? "Nhận Deal hấp dẫn cùng WaterBus"
                      : "Get attractive deals with WaterBus")}
                </h3>
                <Link
                  to={
                    promoPosterSlides[promoSlide]
                      ? `/promotions/${promoPosterSlides[promoSlide].promotionCode}`
                      : "/promotions"
                  }
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
              <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                {promoPosterSlides.map((promo, index) => (
                  <div
                    key={promo.promotionCode}
                    className={`h-1.5 rounded-full transition-all duration-300 ${index === promoSlide ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        )
      }
    </main >
  );
};