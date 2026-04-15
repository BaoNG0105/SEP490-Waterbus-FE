import { useEffect, useState } from "react";
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

  // Gọi lang từ Context
  const { lang } = useApp();

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
      {/* Hero Section */}
      <section className="relative h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-slate-900">
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

        <div className="container mx-auto px-6 relative z-30 flex flex-col items-center text-center">
          <div className="max-w-4xl">
            {/* Title */}
            <h1 className="text-6xl md:text-9xl font-headline font-bold text-white tracking-tighter leading-none mb-8 gsap-reveal">
              <span className="text-white italic">
                {lang === "VN" ? "Chào mừng tới" : "Welcome to"}
              </span>
              <div className="text-white italic">Waterbus</div>
            </h1>
            {/* Nút Scroll Down */}
            <a
              href="#booking-section"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("#booking-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="inline-flex flex-col items-center gap-3 gsap-reveal cursor-pointer opacity-70 hover:opacity-100 hover:-translate-y-1 transition-all duration-300 mt-4"
            >
              {/* Vỏ ngoài con chuột */}
              <div className="w-8 h-[50px] border-2 border-white rounded-full flex justify-center items-start p-1.5">
                {/* Con lăn (Scroll wheel) với hiệu ứng nảy (bounce) của Tailwind */}
                <div className="w-1 h-3 bg-white rounded-full animate-bounce mt-1"></div>
              </div>

              {/* Chữ chú thích nhỏ */}
              <span className="text-white text-[10px] font-label uppercase tracking-widest font-bold">
                {lang === "VN" ? "Khám phá tuyến đường" : "Explore Routes"}
              </span>
            </a>
          </div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "bg-primary w-8"
                  : "bg-white/50 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Booking Section */}
      <section
        className="relative z-20 py-20 px-6 bg-white dark:bg-slate-900 transition-colors duration-300"
        id="booking-section"
      >
        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-surface-variant dark:border-slate-700 gsap-reveal transition-colors duration-300">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div className="flex gap-4 p-1 bg-surface-container-low dark:bg-slate-700 rounded-xl w-fit transition-colors">
                <button className="px-6 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-600 shadow-sm text-primary dark:text-yellow-400 transition-colors">
                  {lang === "VN" ? "Một chiều" : "One way"}
                </button>
                <button className="px-6 py-2 rounded-lg text-sm font-bold text-on-surface-variant dark:text-white/70 hover:text-primary dark:hover:text-yellow-400 transition-colors">
                  {lang === "VN" ? "Khứ hồi" : "Round trip"}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60">
                    {lang === "VN" ? "Nơi đi" : "Where to go"}
                  </label>
                  <select className="w-full bg-surface-container-lowest dark:bg-slate-700 dark:text-white border-none rounded-xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none">
                    <option>Bạch Đằng</option>
                    <option>Thủ thiêm</option>
                    <option>Bình An</option>
                    <option>Thanh Đa</option>
                    <option>Linh Đông</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60">
                    {lang === "VN" ? "Nơi đến" : "Destination"}
                  </label>
                  <select className="w-full bg-surface-container-lowest dark:bg-slate-700 dark:text-white border-none rounded-xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none">
                    <option>Bạch Đằng</option>
                    <option>Thủ thiêm</option>
                    <option>Bình An</option>
                    <option>Thanh Đa</option>
                    <option>Linh Đông</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60">
                    {lang === "VN" ? "Ngày đi" : "Departure date"}
                  </label>
                  <input
                    className="w-full bg-surface-container-lowest dark:bg-slate-700 dark:text-white border-none rounded-xl font-headline font-bold focus:ring-2 ring-primary dark:ring-yellow-400 transition-colors outline-none"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline dark:text-white/60">
                    {lang === "VN" ? "Ngày về" : "Return date"}
                  </label>
                  <input
                    className="w-full bg-surface-container-lowest dark:bg-slate-700 dark:text-white/50 border-none rounded-xl font-headline font-bold focus:ring-2 ring-primary transition-colors outline-none"
                    type="date"
                    disabled
                  />
                </div>
              </div>
            </div>
            <div className="flex items-end">
              <button className="w-full md:w-auto bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 px-12 py-4 rounded-2xl font-bold font-label hover:brightness-105 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">search</span>
                {lang === "VN" ? "Tìm vé" : "Search"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 bg-surface-container-lowest dark:bg-slate-900 transition-colors duration-300">
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
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-headline font-bold dark:text-white">
                {lang === "VN" ? "Hệ Thống Bến Tàu" : "Station System"}
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 mt-2 font-label uppercase tracking-widest text-xs font-bold">
                {lang === "VN"
                  ? "Kết nối các đô thị trọng điểm"
                  : "Connecting key urban hubs"}
              </p>
            </div>
            <button className="text-primary dark:text-yellow-400 font-bold flex items-center gap-2 hover:gap-4 transition-all">
              {lang === "VN" ? "Xem tất cả" : "View All"}{" "}
              <span className="material-symbols-outlined">east</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group relative rounded-3xl overflow-hidden aspect-4/3 bg-surface-container-highest dark:bg-slate-800 gsap-reveal">
              <img
                alt="Bach Dang"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                src="https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white text-2xl font-headline font-bold">
                      Bạch Đằng Station
                    </h4>
                    <p className="text-white/70 text-sm">
                      District 1 Central Hub
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Active
                  </span>
                </div>
              </div>
            </div>
            <div className="group relative rounded-3xl overflow-hidden aspect-4/3 bg-surface-container-highest dark:bg-slate-800 gsap-reveal">
              <img
                alt="Binh An"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                src="https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/its6iygj6rnx6b0ol9yh.jpg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white text-2xl font-headline font-bold">
                      Bình An Port
                    </h4>
                    <p className="text-white/70 text-sm">Thu Duc Tech Hub</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Active
                  </span>
                </div>
              </div>
            </div>
            <div className="group relative rounded-3xl overflow-hidden aspect-4/3 bg-surface-container-highest dark:bg-slate-800 gsap-reveal">
              <img
                alt="Thu Thiem"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                src="https://res.cloudinary.com/dygipvoal/image/upload/v1776077168/yid6qxpyukbxgtd6k5i7.webp"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white text-2xl font-headline font-bold">
                      Thu Thiem Port
                    </h4>
                    <p className="text-white/70 text-sm">
                      Thu Thiem New Urban Area
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Maintenance
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedules Section */}
      <section className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300">
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

      {/* User Testimonials Section */}
      <section className="py-24 overflow-hidden bg-surface-container-low dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-6 mb-12">
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
                    <div className="flex text-primary dark:text-yellow-400 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined fill-1"
                        >
                          star
                        </span>
                      ))}
                    </div>
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
                    <div className="flex text-primary dark:text-yellow-400 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined fill-1"
                        >
                          star
                        </span>
                      ))}
                    </div>
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
      <section className="py-24 dark:bg-slate-900 transition-colors duration-300">
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

      {/* Floating Actions */}
      <div className="fixed right-6 bottom-6 flex flex-col gap-4 z-100">
        <button className="w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform text-white font-bold text-[10px]">
          ZALO
        </button>
        <button className="w-14 h-14 bg-primary dark:bg-yellow-400 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform text-on-primary-fixed dark:text-slate-900">
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
        </button>
      </div>
    </main>
  );
};
