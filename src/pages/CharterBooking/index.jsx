import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../context/AppContext";
import { createMyCharterBooking } from "../../services/charterBookingService";
import { getApiErrorMessage } from "../../utils/apiError";
import { handleDuplicateCharterBookingError } from "../../utils/charterDuplicateBooking";
import { createEmptyBoatRequest, getMinDepartureDate } from "../../utils/charterRequestForm";
import { CharterRequestForm } from "../../components/CharterRequestForm";
import { notify } from "../../utils/swalToast";
import { useRequireAuthGate } from "../../hooks/useRequireAuthGate";

export function CharterBooking() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  useRequireAuthGate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const initialFormData = {
    customerName: "",
    contactPhone: "",
    contactEmail: "",
    departureDate: getMinDepartureDate(),
    adultCount: 1,
    childCount: 0,
    startTime: "08:00",
    fromStationId: "",
    toStationId: "",
    requestedBoats: [createEmptyBoatRequest()],
    itineraryStops: [],
    specialRequests: "",
    rentalUnit: "Hour",
  };

  const handleUnauthenticated = () => {
      notify({
        icon: "info",
        title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
        text: lang === "VN" ? "Vui lòng đăng nhập để gửi yêu cầu thuê tàu." : "Please sign in before creating a booking request.",
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

      const safeBookingCode = String(bookingCode)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

      await notify({
        icon: "success",
        title: lang === "VN" ? "Đã gửi yêu cầu thuê tàu" : "Booking request submitted",
        html: lang === "VN"
          ? `
            <p style="margin:0 0 8px;color:#64748b;font-size:14px;font-weight:700;text-align:center;">
              ${bookingCode !== "--" ? `Mã yêu cầu: <span style="color:#124757;">${safeBookingCode}</span>` : "Bạn có thể theo dõi yêu cầu trong Hồ sơ."}
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;text-align:justify;">
              Bộ phận vận hành sẽ xem xét lộ trình và tàu phù hợp, sau đó gửi báo giá kèm thời gian dự kiến cho quý khách.
              Thời gian duyệt yêu cầu trong vòng <strong style="color:#124757;">24 giờ</strong> kể từ lúc gửi.
              Sau khi nhận báo giá, quý khách có <strong style="color:#124757;">12 giờ</strong> để xác nhận và hoàn tất thủ tục.
            </p>
          `
          : `
            <p style="margin:0 0 8px;color:#64748b;font-size:14px;font-weight:700;text-align:center;">
              ${bookingCode !== "--" ? `Request code: <span style="color:#124757;">${safeBookingCode}</span>` : "You can track this request from your profile."}
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;text-align:justify;">
              Our operations team will review the route and suitable boats, then send you a quote with the estimated schedule.
              Requests are reviewed within <strong style="color:#124757;">24 hours</strong> of submission.
              After receiving the quote, you have <strong style="color:#124757;">12 hours</strong> to confirm and complete the process.
            </p>
          `,
        confirmButtonColor: "#124757",
      });

        if (bookingId) {
          navigate(`/profile/my-charter-booking/${bookingId}`, { state: { booking: savedBooking } });
        } else {
          navigate("/profile/my-charter-booking");
        }
    } catch (error) {
      console.error("Lỗi tạo charter booking:", error);
      const fallback = lang === "VN"
        ? "Vui lòng kiểm tra ngày đi, số khách và thông tin lộ trình."
        : "Please check departure date, passenger count, and route information.";
      const handledDuplicate = await handleDuplicateCharterBookingError(error, {
        lang,
        navigate,
        fallbackMessage: fallback,
      });
      if (handledDuplicate) return;

      notify({
        icon: "error",
        title: lang === "VN" ? "Không thể gửi yêu cầu" : "Unable to submit request",
        text: getApiErrorMessage(error, fallback),
        confirmButtonColor: "#124757",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300">
      {/* ===== SECTION 1: HERO ===== */}
      <section
        className="relative bg-[#124757] dark:bg-slate-950 overflow-hidden pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: "url('https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/charter.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#124757]/70 dark:bg-slate-950/70 pointer-events-none"></div>
        <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-headline font-black text-white leading-tight">
            {lang === "VN" ? "Dịch vụ thuê tàu" : "Request Booking"}
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            {lang === "VN"
              ? "Gửi yêu cầu thuê tàu riêng cho gia đình, doanh nghiệp hay sự kiện đặc biệt. Đội ngũ vận hành sẽ kiểm tra tàu phù hợp và phản hồi báo giá ngay trong hồ sơ của bạn."
              : "Submit a private booking request for your family, company, or special event. Our team will assign a suitable boat and send a quote directly to your profile."}
          </p>
        </div>
      </section>

      {/* ===== SECTION 2: REQUEST FORM ===== */}
      <main className="relative max-w-7xl mx-auto px-4 md:px-8 py-20">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* --- GHI CHÚ ĐIỀU KHOẢN & CHÍNH SÁCH --- */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-6">
          {lang === "VN" ? "Vui lòng xem " : "Please review our "}
          <a
            href="/terms-and-policy"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#124757] dark:text-yellow-400 hover:underline"
          >
            {lang === "VN" ? "Điều khoản & Chính sách" : "Terms & Policy"}
          </a>
          {lang === "VN" ? " trước khi gửi yêu cầu." : " before submitting your request."}
        </p>

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

      {/* ===== SECTION 4: STEPS GUIDE ===== */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col items-center text-center mb-14 space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Quy trình đơn giản" : "Simple Process"}
            </p>
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-[#124757] dark:text-white max-w-2xl">
              {lang === "VN" ? "Hướng dẫn các bước thuê tàu" : "How to Request a Booking"}
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
    </div>
  );
}