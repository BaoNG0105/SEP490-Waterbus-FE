import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../context/AppContext";
import { createMyCharterBooking } from "../../services/charterBookingService";
import { getApiErrorMessage } from "../../utils/apiError";
import { createEmptyBoatRequest, getMinDepartureDate } from "../../utils/charterRequestForm";
import { CharterRequestForm } from "../../components/CharterRequestForm";

export function CharterBooking() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const initialFormData = {
    customerName: user?.fullName || "",
    contactPhone: user?.phoneNumber || user?.phone || "",
    contactEmail: user?.email || "",
    departureDate: getMinDepartureDate(),
    rentalUnit: "Day",
    durationValue: 1,
    adultCount: 1,
    childCount: 0,
    startTime: "08:00",
    fromStationId: "",
    toStationId: "",
    requestedBoats: [createEmptyBoatRequest()],
    itineraryStops: [],
    specialRequests: "",
  };

  const handleUnauthenticated = () => {
    Swal.fire({
      icon: "info",
      title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
      text: lang === "VN" ? "Vui lòng đăng nhập để gửi yêu cầu thuê tàu." : "Please sign in before creating a charter request.",
      confirmButtonColor: "#124757",
    }).then(() => navigate("/login"));
  };

  const handleSubmit = async (payload) => {
    try {
      const savedResponse = await createMyCharterBooking(payload);
      const createdBooking = savedResponse || payload;
      const bookingId = createdBooking?.id || createdBooking?.charterBookingId || createdBooking?.bookingId;
      const bookingCode = createdBooking?.bookingCode || createdBooking?.code || "--";
      const savedBooking = {
        ...createdBooking,
        id: bookingId,
        bookingCode,
        bookingStatus: createdBooking?.bookingStatus || createdBooking?.status || "PendingQuote",
      };

      localStorage.setItem("lastCharterBooking", JSON.stringify({
        bookingId,
        bookingCode,
        bookingStatus: savedBooking.bookingStatus,
      }));

      await Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã gửi yêu cầu thuê tàu" : "Charter request submitted",
        text: bookingCode !== "--"
          ? (lang === "VN" ? `Mã yêu cầu: ${bookingCode}` : `Request code: ${bookingCode}`)
          : (lang === "VN" ? "Bạn có thể theo dõi yêu cầu trong Hồ sơ." : "You can track this request from your profile."),
        confirmButtonColor: "#124757",
      });

      if (bookingId) {
        navigate(`/profile/my-charter-booking/${bookingId}`, { state: { booking: savedBooking } });
      } else {
        navigate("/profile/my-charter-booking");
      }
    } catch (error) {
      console.error("Lỗi tạo charter booking:", error);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể gửi yêu cầu" : "Unable to submit request",
        text: getApiErrorMessage(error, lang === "VN" ? "Vui lòng kiểm tra ngày đi, số khách và thông tin lộ trình." : "Please check departure date, passenger count, and route information."),
        confirmButtonColor: "#124757",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300">
      {/* ===== SECTION 1: HERO ===== */}
      <section
        className="relative bg-[#124757] dark:bg-slate-950 overflow-hidden pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: "url('https://res.cloudinary.com/dygipvoal/image/upload/v1776187354/mudyubyd1sqcihkzhkbo.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#124757]/70 dark:bg-slate-950/70 pointer-events-none"></div>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[420px] absolute -right-16 -top-16 text-white">directions_boat</span>
        </div>
        <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-headline font-black text-white leading-tight">
            {lang === "VN" ? "Dịch vụ thuê tàu WaterBus" : "WaterBus Charter Booking"}
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            {lang === "VN"
              ? "Gửi yêu cầu thuê tàu riêng cho gia đình, doanh nghiệp hay sự kiện đặc biệt. Đội ngũ vận hành sẽ kiểm tra tàu phù hợp và phản hồi báo giá ngay trong hồ sơ của bạn."
              : "Submit a private charter request for your family, company, or special event. Our team will assign a suitable boat and send a quote directly to your profile."}
          </p>
        </div>
      </section>

      {/* ===== SECTION 2: SERVICE INTRODUCTION ===== */}
      <section className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col items-center text-center mb-14 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Vì sao chọn WaterBus Charter" : "Why Choose WaterBus Charter"}
            </p>
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-[#124757] dark:text-white max-w-2xl">
              {lang === "VN" ? "Trải nghiệm thuê tàu riêng trọn vẹn, minh bạch từ đầu đến cuối" : "A complete, transparent private charter experience"}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "tune", titleVn: "Tùy chỉnh lộ trình", titleEn: "Custom Route", descVn: "Chọn bến đi, bến đến và các điểm dừng theo nhu cầu của bạn.", descEn: "Pick your origin, destination, and stops to match your plan." },
              { icon: "directions_boat_filled", titleVn: "Đa dạng loại tàu", titleEn: "Flexible Boat Types", descVn: "Yêu cầu nhiều tàu với cấu hình ghế thường hoặc VIP.", descEn: "Request multiple boats with standard or VIP seating." },
              { icon: "request_quote", titleVn: "Báo giá minh bạch", titleEn: "Transparent Quotes", descVn: "Nhận báo giá chi tiết ngay trong hồ sơ cá nhân.", descEn: "Receive a detailed quote right in your profile." },
              { icon: "support_agent", titleVn: "Hỗ trợ tận tâm", titleEn: "Dedicated Support", descVn: "Đội ngũ vận hành đồng hành xuyên suốt quá trình thuê tàu.", descEn: "Our operations team supports you throughout the process." },
            ].map((item) => (
              <div key={item.icon} className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                </div>
                <h3 className="font-headline font-black text-slate-800 dark:text-white text-sm uppercase tracking-wide">
                  {lang === "VN" ? item.titleVn : item.titleEn}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === "VN" ? item.descVn : item.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 3: STEPS GUIDE ===== */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col items-center text-center mb-14 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Quy trình đơn giản" : "Simple Process"}
            </p>
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-[#124757] dark:text-white max-w-2xl">
              {lang === "VN" ? "Hướng dẫn các bước thuê tàu" : "How to Book a Charter"}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { titleVn: "Điền thông tin & lịch trình", titleEn: "Fill in details & schedule", descVn: "Nhập thông tin liên hệ, ngày giờ khởi hành và thời lượng thuê tàu.", descEn: "Enter contact info, departure date/time, and rental duration." },
              { titleVn: "Chọn lộ trình & loại tàu", titleEn: "Choose route & boat type", descVn: "Chọn bến đi, bến đến, điểm dừng và số lượng tàu mong muốn.", descEn: "Select origin, destination, stops, and the boats you need." },
              { titleVn: "Gửi yêu cầu thuê tàu", titleEn: "Submit your request", descVn: "Xác nhận thông tin và gửi yêu cầu thuê tàu đến đội ngũ vận hành.", descEn: "Confirm details and send the request to our operations team." },
              { titleVn: "Nhận báo giá & theo dõi", titleEn: "Get a quote & track it", descVn: "Theo dõi trạng thái và nhận báo giá ngay trong hồ sơ của bạn.", descEn: "Track the status and receive your quote in your profile." },
            ].map((step, index) => (
              <div key={`${step.titleEn}-${index}`} className="flex flex-col group">
                <div className="text-5xl font-headline font-black text-yellow-500 dark:text-yellow-400 mb-4 transition-transform duration-300 group-hover:-translate-y-2">
                  0{index + 1}
                </div>
                <h3 className="text-lg font-headline font-bold text-[#124757] dark:text-white mb-2">
                  {lang === "VN" ? step.titleVn : step.titleEn}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === "VN" ? step.descVn : step.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: REQUEST FORM ===== */}
      <main className="relative max-w-5xl mx-auto px-4 md:px-8 py-20">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <CharterRequestForm
          mode="create"
          idPrefix="charter"
          lang={lang}
          isAuthenticated={isAuthenticated}
          onUnauthenticated={handleUnauthenticated}
          initialFormData={initialFormData}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
