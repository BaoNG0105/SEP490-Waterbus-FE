import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchAllStations } from "../../services/stationService";
import { WaterwayMap } from "../../components/WaterwayMap";
import { fetchPublishedBlogPosts } from "../../services/blogService";

import {
  promoPosters,
  heroSlides,
  guidelines,
  promoData,
  testimonialsData,
  appImages
} from "../../data/homeData";

export const Home = () => {
  const { lang } = useApp(); // Lấy ngôn ngữ hiện tại từ context để hiển thị nội dung phù hợp
  const navigate = useNavigate(); // Khởi tạo navigate để chuyển hướng khi nhấn nút Đặt vé

  // Khai báo state quản lý danh sách nhà ga gọi từ API
  const [stationPoints, setStationPoints] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);

  // State quản lý danh sách Blog
  const [blogs, setBlogs] = useState([]);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);


  // State quản lý Form Đặt vé Hero
  const [isRoundTrip, setIsRoundTrip] = useState(false); // false: Một chiều, true: Khứ hồi
  const [passengerCount, setPassengerCount] = useState(1);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [fromWharf, setFromWharf] = useState("");
  const [toWharf, setToWharf] = useState("");

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

  // Hero Slide tự động chạy sau mỗi 5 giây
  useEffect(() => {
    const heroTimer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000); // Bạn có thể chỉnh 5000 (5 giây) thành thời gian bạn muốn
    return () => clearInterval(heroTimer);
  }, []);

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

  // Hiển thị Modal Quảng Cáo sau 3 giây
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

  // Tự động chuyển slide trong Modal Quảng Cáo khi nó đang hiển thị
  useEffect(() => {
    if (!showPromoModal) return;
    const slideTimer = setInterval(() => {
      setPromoSlide((prev) => (prev + 1) % promoPosters.length);
    }, 3000);
    return () => clearInterval(slideTimer);
  }, [showPromoModal]);

  // THÊM HÀM XỬ LÝ KHI BẤM NÚT TÌM KIẾM
  const handleSearchToBooking = () => {
    // Basic validation (Bắt buộc điền mới cho đi)
    if (!fromWharf || !toWharf || !departureDate || (isRoundTrip && !returnDate)) {
      alert(lang === "VN" ? "Vui lòng chọn đầy đủ bến và ngày đi!" : "Please fill in all required fields!");
      return;
    }

    // Chuyển hướng sang trang /booking và mang theo toàn bộ data
    navigate("/booking", {
      state: {
        step: 2, // Chỉ định nhảy thẳng tới Bước 2
        bookingData: {
          isRoundTrip,
          fromWharf,
          toWharf,
          departureDate,
          returnDate,
          passengerCount,
          selectedDepartureTrip: null,
          selectedReturnTrip: null,
          selectedSeatsDeparture: [],
          selectedSeatsReturn: [],
        }
      }
    });
  };

  return (
    <main className="dark:bg-slate-900 transition-colors duration-300 relative">
      {/* ===== HERO SECTION & BOOKING FORM ===== */}
      <section id="booking-section" className="relative min-h-[90vh] lg:min-h-screen flex flex-col justify-center items-center overflow-hidden select-none bg-slate-900">
        {/* Bản Slider ảnh nền Hero chạy tự động */}
        <div className="absolute inset-0 z-0">
          {heroSlides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === heroSlide ? "opacity-40 scale-100" : "opacity-0 scale-105"
                }`}
            >
              <img src={slide.src} alt="Waterbus Background" className="w-full h-full object-cover transform transition-transform duration-[4000ms]" />
            </div>
          ))}
          {/* Lớp phủ Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-900/40 to-[#124757]/30"></div>
        </div>
        {/* Khối Nội Dung Chính */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 md:px-12 pt-32 pb-20 flex flex-col items-center justify-center space-y-12">
          {/* Tiêu Đề */}
          <div className="text-center space-y-4 max-w-3xl gsap-reveal">
            <h1 className="text-4xl md:text-6xl font-headline font-black text-white leading-tight drop-shadow-md">
              {lang === "VN" ? "Welcome to" : "Chào mừng đến"}{" "}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">
                {lang === "VN" ? "Waterbus" : "Waterbus"}
              </span>
            </h1>
          </div>
          {/* KHỐI FORM ĐẶT VÉ*/}
          <div className="w-full max-w-5xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-700/50 space-y-6 transform hover:scale-[1.005] transition-all duration-300 gsap-reveal">
            {/* Chọn loại chuyến đi: Một chiều / Khứ hồi */}
            <div className="flex gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
              <button
                type="button"
                onClick={() => setIsRoundTrip(false)}
                className={`px-5 py-2 rounded-xl text-xs md:text-sm font-headline font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${!isRoundTrip
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
              >
                {lang === "VN" ? "Một chiều" : "One-Way"}
              </button>
              <button
                type="button"
                onClick={() => setIsRoundTrip(true)}
                className={`px-5 py-2 rounded-xl text-xs md:text-sm font-headline font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${isRoundTrip
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
              >
                {lang === "VN" ? "Khứ hồi" : "Round-Trip"}
              </button>
            </div>
            {/* Lưới ô điền thông tin đặt vé */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isRoundTrip ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5 items-end transition-all duration-300`}>
              {/* Ô chọn Bến đi */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">location_on</span>
                  {lang === "VN" ? "Bến xuất phát" : "Departure Wharf"}
                </label>
                <select
                  value={fromWharf}
                  onChange={(e) => setFromWharf(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all cursor-pointer shadow-inner"
                >
                  <option value="">-- {lang === "VN" ? "Chọn bến đi" : "Select Wharf"} --</option>
                  <option value="bach-dang">Bến Bạch Đằng (Q.1)</option>
                  <option value="thu-thiem">Bến Thủ Thiêm (TP.Thủ Đức)</option>
                  <option value="binh-an">Bến Bình An (Q.2)</option>
                  <option value="thanh-da">Bến Thanh Đa (Bình Thạnh)</option>
                  <option value="linh-dong">Bến Linh Đông (Thủ Đức)</option>
                </select>
              </div>
              {/* Ô chọn Bến đến */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">location_on</span>
                  {lang === "VN" ? "Bến cập bến" : "Destination Wharf"}
                </label>
                <select
                  value={toWharf}
                  onChange={(e) => setToWharf(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all cursor-pointer shadow-inner"
                >
                  <option value="">-- {lang === "VN" ? "Chọn bến đến" : "Select Wharf"} --</option>
                  <option value="bach-dang">Bến Bạch Đằng (Q.1)</option>
                  <option value="thu-thiem">Bến Thủ Thiêm (TP.Thủ Đức)</option>
                  <option value="binh-an">Bến Bình An (Q.2)</option>
                  <option value="thanh-da">Bến Thanh Đa (Bình Thạnh)</option>
                  <option value="linh-dong">Bến Linh Đông (Thủ Đức)</option>
                </select>
              </div>
              {/* Ô chọn Ngày đi */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">calendar_today</span>
                  {lang === "VN" ? "Ngày khởi hành" : "Departure Date"}
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner uppercase cursor-pointer"
                />
              </div>
              {/* Ô CHỌN NGÀY VỀ (Chỉ hiện ra khi nhấn lựa chọn Khứ hồi) */}
              {isRoundTrip && (
                <div className="space-y-2 transition-all duration-500 animate-fade-in">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">history</span>
                    {lang === "VN" ? "Ngày về" : "Return Date"}
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    min={departureDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner uppercase cursor-pointer"
                  />
                </div>
              )}
              {/* FIELD SỐ LƯỢNG HÀNH KHÁCH */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">group</span>
                  {lang === "VN" ? "Số lượng hành khách" : "Passengers"}
                </label>
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 shadow-inner">
                  <button
                    type="button"
                    disabled={passengerCount <= 1}
                    onClick={() => setPassengerCount(prev => prev - 1)}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-600 shadow-sm active:scale-95 disabled:opacity-40 transition-all outline-none"
                  >
                    -
                  </button>
                  <span className="text-base font-headline font-black text-[#124757] dark:text-white mx-2 w-6 text-center">
                    {passengerCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPassengerCount(prev => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-600 shadow-sm active:scale-95 transition-all outline-none"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
            {/* Nút Tìm Chuyến Đặt Vé Lớn Nổi Bật Dưới Cùng Form */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSearchToBooking} // Gắn hàm chuyển trang vào đây
                className="w-full md:w-auto bg-yellow-400 text-[#124757] dark:bg-yellow-400 dark:text-slate-900 px-12 py-4 rounded-2xl font-headline font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-yellow-300 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
              >
                {lang === "VN" ? "Tìm chuyến tàu ngay" : "Search Routes Now"}
                <span className="material-symbols-outlined text-xl font-bold">search</span>
              </button>
            </div>
          </div>
          {/* Dấu chấm điều hướng Slide Hero */}
          <div className="flex gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setHeroSlide(index)}
                className={`h-2 rounded-full transition-all duration-300 outline-none ${index === heroSlide ? "w-6 bg-yellow-400" : "w-2 bg-white/40 hover:bg-white/60"
                  }`}
              />
            ))}
          </div>
        </div>
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
                ? "Nâng tầm di chuyển đô thị bằng giao thông đường thủy"
                : "Elevating urban mobility through river transit"}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-body text-base leading-relaxed">
              {lang === "VN"
                ? "Waterbus đang định hình lại tương lai của giao thông đô thị bằng cách khai phá tiềm năng to lớn của mạng lưới sông ngòi Sài Gòn. Chúng tôi không chỉ cung cấp một phương tiện đi lại thông thường, mà mang đến một giải pháp di chuyển xanh, bền vững, giúp giảm tải ùn tắc đường bộ nghiêm trọng, tiết kiệm thời gian quý báu của hành khách và kiến tạo những trải nghiệm hành trình thư thái, kết nối sâu sắc con người với cảnh quan thiên nhiên tráng lệ của thành phố."
                : "Waterbus is reshaping the future of urban transportation by unlocking the immense potential of Saigon's river network. We don't just provide a standard transit method; we offer a green, sustainable mobility solution that alleviates severe road congestion, saves precious passenger time, and creates relaxed journey experiences that deeply connect people with the magnificent natural landscapes of the city."}
            </p>
            {/* Khối thông số kỹ thuật (Stats) */}
            <div className="grid grid-cols-2 gap-8 pt-6">
              {/* Tần suất cao điểm */}
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
              {/* Năng lượng sạch */}
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

      {/* ===== GUILINE SECTION ===== */}
      <section className="py-24 bg-surface dark:bg-slate-900 transition-colors duration-300 select-none">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Tiêu đề chính */}
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white text-center mb-16">
            {lang === "VN" ? "Hướng dẫn đặt vé" : "Ticketing Guide"}
          </h2>
          {/* Grid dàn ngang 4 cột trên Desktop, 2 cột trên Tablet, 1 cột trên Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {guidelines.map((guide, index) => (
              <div key={guide.id} className="flex flex-col group cursor-pointer">
                {/* Số thứ tự */}
                <div className="text-6xl font-headline font-black text-yellow-500 dark:text-yellow-400 mb-4 transition-transform duration-300 group-hover:-translate-y-2">
                  0{index + 1}
                </div>
                {/* Hình ảnh minh họa */}
                <div className="aspect-4/3 rounded-2xl overflow-hidden shadow-md mb-6">
                  <img
                    src={guide.image}
                    alt={`Guideline step ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                {/* Tiêu đề bước */}
                <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white mb-3">
                  {lang === "VN" ? guide.titleVn : guide.titleEn}
                </h3>
                {/* Mô tả chi tiết */}
                <p className="text-slate-600 dark:text-slate-400 font-body text-sm leading-relaxed">
                  {lang === "VN" ? guide.descVn : guide.descEn}
                </p>

              </div>
            ))}
          </div>
          {/* Nút Đặt vé ngay */}
          <div className="mt-16 flex justify-center">
            <a
              href="/#booking-section"
              className="bg-yellow-400 text-[#124757] px-10 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-yellow-300 hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
            </a>
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
              {lang === "VN" ? "Sơ đồ hệ thống bến ga bến tàu" : "Saigon Waterbus Pier Network"}
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
              <WaterwayMap stationsList={stationPoints} />
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
                ? "Lịch trình khởi hành linh hoạt mỗi ngày"
                : "Flexible Departure Schedules Daily"}
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
              {lang === "VN" ? "Ưu đãi & Khuyến mãi độc quyền" : "Exclusive Deals & Promotions"}
            </h2>
          </div>
          {/* Grid danh sách các thẻ Khuyến mại thiết kế lại theo ảnh mẫu */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {promoData.map((promo) => (  // <--- Sử dụng promoData ở đây
              <div
                key={promo.id}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-4xl overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Phần ảnh phía trên tích hợp Badge nổi */}
                <div className="aspect-16/10 relative overflow-hidden shrink-0">
                  <img
                    src={promo.image}
                    alt={promo.titleVn}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-900/40 to-transparent"></div>
                  {/* Badge tag góc trái ảnh */}
                  <span className="absolute top-4 left-4 bg-[#124757] text-white font-headline text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm">
                    {lang === "VN" ? promo.tagVn : promo.tagEn}
                  </span>
                </div>
                {/* Nội dung chi tiết của Card khuyến mại */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {lang === "VN" ? promo.expiryVn : promo.expiryEn}
                    </div>
                    <h3 className="text-xl font-headline font-bold text-slate-800 dark:text-white leading-snug line-clamp-2 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors">
                      {lang === "VN" ? promo.titleVn : promo.titleEn}
                    </h3>
                  </div>
                  {/* Khu vực hiển thị mã Code và nút bấm đặt vé */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                    <div className="bg-slate-200/70 dark:bg-slate-700 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 select-all cursor-pointer" title="Click to copy">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mr-1.5">Code:</span>
                      <span className="text-sm font-black font-headline text-[#124757] dark:text-yellow-400 tracking-wider">{promo.code}</span>
                    </div>
                    <a
                      href="/#booking-section"
                      className="bg-yellow-400 text-[#124757] w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:bg-yellow-300 hover:scale-110 transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg font-bold">arrow_forward</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              {lang === "VN" ? "Cập nhật thông tin mới nhất" : "Latest Updates & News"}
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
                        {blogs[heroSlide].category}
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
                      className="inline-flex items-center gap-2 text-sm font-headline font-black text-[#124757] dark:text-yellow-400 group/btn transition-colors w-max uppercase tracking-wider text-xs"
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
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20 min-h-[500px]">
          {/* CỘT TRÁI: Slide Hình Ảnh App (Thiết kế xếp chồng) */}
          <div className="relative w-full h-[350px] md:h-[500px] flex items-center justify-center lg:justify-end">
            {/* Lớp trang trí phát sáng phía sau */}
            <div className="absolute w-[250px] md:w-[350px] h-[250px] md:h-[350px] bg-yellow-400/20 rounded-full blur-[80px]"></div>
            {/* Khung chứa các Slide Ảnh */}
            <div className="relative w-[220px] md:w-[280px] h-[450px] md:h-[580px] mt-10 md:mt-24 lg:mt-32">
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
                    className="w-full h-full object-cover rounded-[2rem] border-[6px] border-slate-900 shadow-2xl"
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
                {lang === "VN" ? "Mua vé nhanh chóng," : "Fast Ticketing,"}
                <br />
                <span className="text-yellow-400">
                  {lang === "VN" ? "thanh toán dễ dàng!" : "Easy Payment!"}
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
              {lang === "VN" ? "Khách hàng nói gì về WaterBus?" : "What Our Passengers Say"}
            </h2>
          </div>
          {/* Khung Slider chính */}
          <div className="relative w-full bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-14 shadow-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
            {/* Icon Dấu ngoặc kép trang trí lớn tinh tế */}
            <span className="material-symbols-outlined text-6xl md:text-7xl text-[#124757]/10 dark:text-yellow-400/10 absolute top-8 left-8 md:top-10 md:left-12 pointer-events-none font-black">
              format_quote
            </span>
            {/* Nội dung Review chuyển đổi slide mượt mà */}
            <div className="w-full text-center space-y-6 relative min-h-[160px] flex flex-col justify-center items-center">
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
              {lang === "VN" ? "Chúng tôi luôn sẵn sàng hỗ trợ bạn" : "We Are Here To Help You"}
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
            <div className="lg:col-span-7 bg-[#124757] dark:bg-slate-800 border border-white/10 dark:border-slate-700/50 p-8 md:p-10 rounded-[2.5rem] shadow-xl">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {/* Grid Họ tên & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Họ và tên */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
                      {lang === "VN" ? "Họ và tên *" : "Full Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === "VN" ? "Nhập họ tên của bạn" : "Enter your full name"}
                      className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner"
                    />
                  </div>
                  {/* Địa chỉ Email */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
                      {lang === "VN" ? "Địa chỉ Email *" : "Email Address *"}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="example@domain.com"
                      className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner"
                    />
                  </div>
                </div>
                {/* Tiêu đề tin nhắn */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
                    {lang === "VN" ? "Tiêu đề liên hệ" : "Subject"}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === "VN" ? "Nhập tiêu đề nội dung" : "What is this regarding?"}
                    className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner"
                  />
                </div>
                {/* Khối nội dung nhập tin nhắn dài */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
                    {lang === "VN" ? "Nội dung lời nhắn *" : "Message Contents *"}
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder={lang === "VN" ? "Viết nội dung tin nhắn của bạn tại đây..." : "Type your message details here..."}
                    className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner resize-none"
                  ></textarea>
                </div>
                {/* Nút hành động gửi thông tin màu trắng để tương phản cực tốt trên nền xanh */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-white text-[#124757] dark:bg-yellow-400 dark:text-slate-900 px-10 py-4 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-md hover:bg-slate-100 dark:hover:bg-yellow-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {lang === "VN" ? "Gửi lời nhắn ngay" : "Send Message"}
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </form>
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
                {promoPosters.map((poster, index) => (
                  <img
                    key={index}
                    src={poster}
                    alt="Promotion"
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
              <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                {promoPosters.map((_, index) => (
                  <div
                    key={index}
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