import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../context/AppContext";
import { updateUserProfile } from "../../redux/authSlice";
import { fetchAllStations } from "../../services/stationService";
import { fetchCurrentUserProfile } from "../../services/authService";
import {
  createMyCharterBooking,
  updateMyCharterBooking,
} from "../../services/charterBookingService";

const seatSetupOptions = ["FullStandard", "StandardAndVip"];

const getMinDepartureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const viMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (viMatch) {
    return `${viMatch[3]}-${viMatch[2].padStart(2, "0")}-${viMatch[1].padStart(2, "0")}`;
  }

  return "";
};

const normalizeStationName = (value) =>
  String(value || "").trim().toLocaleLowerCase("vi-VN");

const getStationDisplayName = (station, fallback = "--") =>
  station?.stationName || station?.name || fallback;

const getDepartureLeadDays = (departureDate) => {
  if (!departureDate) return null;
  const departure = new Date(`${departureDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(departure.getTime())) return null;
  return Math.ceil((departure.getTime() - today.getTime()) / 86400000);
};

const createEmptyStop = () => ({
  stationId: "",
  stopOrder: 1,
  stayDurationMinutes: 0,
  note: "",
});

const createEmptyBoatRequest = () => ({
  seatSetupType: "FullStandard",
});

const getApiErrorMessage = (error, fallback) => {
  const data = error.response?.data;

  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.title) return data.title;
  if (data.errors && typeof data.errors === "object") {
    return Object.values(data.errors).flat().filter(Boolean).join("\n") || fallback;
  }

  return fallback;
};

export function CharterBookingPage() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const editBooking = location.state?.editBooking;
  const isEditing = Boolean(editBooking?.id && editBooking?.status === "PendingQuote");

  const [stations, setStations] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [useAccountInfo, setUseAccountInfo] = useState(false);
  const [formData, setFormData] = useState(() => ({
    customerName: editBooking?.customerName || editBooking?.contactName || user?.fullName || "",
    contactPhone: editBooking?.phone || editBooking?.phoneNumber || editBooking?.customerPhone || user?.phoneNumber || user?.phone || "",
    contactEmail: editBooking?.email || editBooking?.customerEmail || user?.email || "",
    departureDate: toDateInputValue(editBooking?.departureDate) || getMinDepartureDate(),
    rentalUnit: editBooking?.rentalUnit || "Day",
    durationValue: editBooking?.durationValue || 1,
    adultCount: editBooking?.adultCount ?? 1,
    childCount: editBooking?.childCount ?? 0,
    startTime: editBooking?.startTime && editBooking.startTime !== "--" ? String(editBooking.startTime).slice(0, 5) : "08:00",
    fromStationId: editBooking?.fromStationId || "",
    toStationId: editBooking?.toStationId || "",
    requestedBoats: Array.isArray(editBooking?.requestedBoats) && editBooking.requestedBoats.length > 0
      ? editBooking.requestedBoats.map((boat) => ({ seatSetupType: boat.seatSetupType }))
      : [{ seatSetupType: editBooking?.preferredSeatSetupType || "FullStandard" }],
    itineraryStops: Array.isArray(editBooking?.itineraryStops)
      ? editBooking.itineraryStops.map((stop, index) => ({
          stationId: stop.stationId || stop.station?.id || "",
          stopOrder: stop.stopOrder ?? index + 1,
          stayDurationMinutes: stop.stayDurationMinutes ?? 0,
          note: stop.note || "",
        }))
      : [],
    boatRequirements: editBooking?.boatRequirements || "",
    specialRequests: editBooking?.specialRequests === "--" ? "" : editBooking?.specialRequests || "",
  }));

  const loadStations = useCallback(async () => {
    try {
      const stationData = await fetchAllStations();
      setStations(Array.isArray(stationData) ? stationData.filter((station) => station.status !== "Inactive") : []);
    } catch (error) {
      console.error("Lỗi tải danh sách bến:", error);
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadStations();
  }, [loadStations]);

  useEffect(() => {
    if (!isEditing || stations.length === 0) return;

    const routeParts = String(editBooking.route || "").split(" - ");
    const fromName = editBooking.fromStationName || routeParts[0];
    const toName = editBooking.toStationName || routeParts[1];
    const findStationIdByName = (name) => {
      const station = stations.find((item) =>
        normalizeStationName(item.stationName || item.name) === normalizeStationName(name));
      return station?.stationId || station?.id || "";
    };

    setFormData((prev) => ({
      ...prev,
      fromStationId: prev.fromStationId || findStationIdByName(fromName),
      toStationId: prev.toStationId || findStationIdByName(toName),
    }));
  }, [editBooking, isEditing, stations]);

  const selectedFromStation = stations.find((station) => (station.stationId || station.id) === formData.fromStationId);
  const selectedToStation = stations.find((station) => (station.stationId || station.id) === formData.toStationId);
  const totalGuests = Number(formData.adultCount || 0) + Number(formData.childCount || 0);
  const departureLeadDays = getDepartureLeadDays(formData.departureDate);
  const contactReady = Boolean(
    formData.customerName.trim()
    && formData.contactPhone.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())
  );
  const scheduleReady = Boolean(formData.departureDate && formData.departureDate >= getMinDepartureDate() && Number(formData.durationValue) >= 1);
  const routeReady = Boolean(formData.fromStationId && formData.toStationId && formData.fromStationId !== formData.toStationId);
  const boatsReady = formData.requestedBoats.length > 0 && formData.requestedBoats.every((boat) => seatSetupOptions.includes(boat.seatSetupType));
  const formReadiness = [
    { ready: contactReady, label: lang === "VN" ? "Liên hệ" : "Contact" },
    { ready: scheduleReady, label: lang === "VN" ? "Lịch thuê" : "Schedule" },
    { ready: routeReady, label: lang === "VN" ? "Lộ trình" : "Route" },
    { ready: boatsReady, label: lang === "VN" ? "Loại tàu" : "Boats" },
  ];
  const readyCount = formReadiness.filter((item) => item.ready).length;
  const routeTimeline = [
    { type: "start", name: getStationDisplayName(selectedFromStation, lang === "VN" ? "Chưa chọn bến đi" : "No origin") },
    ...formData.itineraryStops.map((stop, index) => {
      const station = stations.find((item) => (item.stationId || item.id) === stop.stationId);
      return {
        type: "stop",
        name: getStationDisplayName(station, lang === "VN" ? `Điểm dừng ${index + 1}` : `Stop ${index + 1}`),
        note: Number(stop.stayDurationMinutes || 0) > 0
          ? `${stop.stayDurationMinutes} ${lang === "VN" ? "phút" : "min"}`
          : "",
      };
    }),
    { type: "end", name: getStationDisplayName(selectedToStation, lang === "VN" ? "Chưa chọn bến đến" : "No destination") },
  ];
  const contactInputClass = `w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400`;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountInfoToggle = async () => {
    if (useAccountInfo) {
      setUseAccountInfo(false);
      return;
    }

    const getProfileContact = (profile) => ({
      customerName: profile?.fullName || profile?.name || "",
      contactPhone: profile?.phoneNumber || profile?.phone || "",
      contactEmail: profile?.email || "",
    });

    const hasFullContact = (profile) => {
      const contact = getProfileContact(profile);
      return Boolean(contact.customerName && contact.contactPhone && contact.contactEmail);
    };

    const applyProfile = (profile) => {
      const contact = getProfileContact(profile);
      setFormData((prev) => ({
        ...prev,
        customerName: contact.customerName || prev.customerName,
        contactPhone: contact.contactPhone || prev.contactPhone,
        contactEmail: contact.contactEmail || prev.contactEmail,
      }));
    };

    if (hasFullContact(user)) {
      applyProfile(user);
      setUseAccountInfo(true);
      return;
    }

    try {
      setIsLoadingProfile(true);
      const profile = await fetchCurrentUserProfile();
      dispatch(updateUserProfile(profile));
      applyProfile(profile);
      const canUseAccountInfo = hasFullContact(profile);
      setUseAccountInfo(canUseAccountInfo);
      if (!canUseAccountInfo) {
        Swal.fire({
          icon: "warning",
          title: lang === "VN" ? "Hồ sơ chưa đủ thông tin" : "Profile is incomplete",
          text: lang === "VN" ? "Tài khoản chưa có đủ họ tên, số điện thoại và email. Vui lòng bổ sung phần còn thiếu." : "Your account is missing name, phone, or email. Please fill the missing fields manually.",
          confirmButtonColor: "#124757",
        });
      }
    } catch (error) {
      console.error("Lỗi lấy thông tin tài khoản:", error);
      setUseAccountInfo(false);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không lấy được thông tin" : "Unable to load account info",
        text: lang === "VN" ? "Vui lòng nhập thông tin liên hệ thủ công." : "Please enter contact information manually.",
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleBoatRequestChange = (index, seatSetupType) => {
    setFormData((prev) => ({
      ...prev,
      requestedBoats: prev.requestedBoats.map((boat, boatIndex) => (
        boatIndex === index ? { ...boat, seatSetupType } : boat
      )),
    }));
  };

  const handleAddBoatRequest = () => {
    setFormData((prev) => ({
      ...prev,
      requestedBoats: prev.requestedBoats.length >= 20
        ? prev.requestedBoats
        : [...prev.requestedBoats, createEmptyBoatRequest()],
    }));
  };

  const handleRemoveBoatRequest = (index) => {
    setFormData((prev) => ({
      ...prev,
      requestedBoats: prev.requestedBoats.length <= 1
        ? prev.requestedBoats
        : prev.requestedBoats.filter((_, boatIndex) => boatIndex !== index),
    }));
  };

  const handleStopChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      itineraryStops: prev.itineraryStops.map((stop, stopIndex) => (
        stopIndex === index ? { ...stop, [field]: value } : stop
      )),
    }));
  };

  const handleAddStop = () => {
    setFormData((prev) => ({
      ...prev,
      itineraryStops: prev.itineraryStops.length >= 50 ? prev.itineraryStops : [
        ...prev.itineraryStops,
        { ...createEmptyStop(), stopOrder: prev.itineraryStops.length + 1 },
      ],
    }));
  };

  const handleRemoveStop = (index) => {
    setFormData((prev) => ({
      ...prev,
      itineraryStops: prev.itineraryStops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({ ...stop, stopOrder: stopIndex + 1 })),
    }));
  };

  const handleCreateBooking = async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      Swal.fire({
        icon: "info",
        title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
        text: lang === "VN" ? "Vui lòng đăng nhập để gửi yêu cầu thuê tàu." : "Please sign in before creating a charter request.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/login"));
      return;
    }

    const adultCount = Number(formData.adultCount);
    const childCount = Number(formData.childCount);
    const durationValue = Number(formData.durationValue);
    const totalPassengers = adultCount + childCount;
    const minDepartureDate = getMinDepartureDate();
    const customerName = formData.customerName.trim();
    const contactPhone = formData.contactPhone.trim();
    const contactEmail = formData.contactEmail.trim();

    if (!customerName || !contactPhone || !contactEmail) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin khách hàng" : "Missing customer information",
        text: lang === "VN" ? "Vui lòng nhập họ tên, số điện thoại và email liên hệ." : "Please enter contact name, phone number, and email.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Email chưa hợp lệ" : "Invalid email",
        text: lang === "VN" ? "Vui lòng nhập đúng định dạng email liên hệ." : "Please enter a valid contact email.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!formData.departureDate) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Ngày khởi hành chưa hợp lệ" : "Invalid departure date",
        text: lang === "VN" ? "Vui lòng chọn ngày khởi hành." : "Please choose a departure date.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.departureDate < minDepartureDate) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Ngày khởi hành chưa hợp lệ" : "Invalid departure date",
        text: lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 60) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Thời lượng chưa hợp lệ" : "Invalid duration",
        text: lang === "VN" ? "Thời lượng thuê phải là số nguyên từ 1 đến 60." : "Duration must be an integer from 1 to 60.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0 || adultCount > 1000 || childCount > 1000 || totalPassengers <= 0 || totalPassengers > 1000) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Số lượng hành khách chưa hợp lệ" : "Invalid passenger count",
        text: lang === "VN" ? "Người lớn và trẻ em từ 0 đến 1000, tổng hành khách phải lớn hơn 0 và không quá 1000." : "Adults and children must be 0-1000, and total passengers must be greater than 0 and no more than 1000.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!formData.fromStationId || !formData.toStationId) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Vui lòng chọn bến" : "Stations are required",
        text: lang === "VN" ? "Bạn cần chọn cả bến đi và bến đến trước khi tạo yêu cầu." : "Select both origin and destination stations before submitting.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.fromStationId === formData.toStationId) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Lộ trình chưa hợp lệ" : "Invalid route",
        text: lang === "VN" ? "Bến đến phải khác bến đi." : "Destination station must be different from origin station.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const invalidStop = formData.itineraryStops.some((stop) => (
      !stop.stationId
      || !Number.isInteger(Number(stop.stopOrder))
      || Number(stop.stopOrder) < 0
      || !Number.isInteger(Number(stop.stayDurationMinutes))
      || Number(stop.stayDurationMinutes) < 0
      || String(stop.note || "").length > 1000
    ));

    if (formData.itineraryStops.length > 50 || invalidStop) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Điểm dừng chưa hợp lệ" : "Invalid itinerary stops",
        text: lang === "VN" ? "Tối đa 50 điểm dừng; mỗi điểm cần có bến dừng, thứ tự và thời gian dừng không âm." : "Maximum 50 stops; each stop needs a station, non-negative order, and non-negative stay minutes.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.requestedBoats.length < 1 || formData.requestedBoats.length > 20 || formData.requestedBoats.some((boat) => !seatSetupOptions.includes(boat.seatSetupType))) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Danh sách tàu chưa hợp lệ" : "Invalid requested boats",
        text: lang === "VN" ? "Cần ít nhất 1 tàu, tối đa 20 tàu, mỗi tàu chọn FullStandard hoặc StandardAndVip." : "Please request 1-20 boats, each with FullStandard or StandardAndVip.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.boatRequirements.length > 1000 || formData.specialRequests.length > 1000) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Nội dung nhập quá dài" : "Input is too long",
        text: lang === "VN" ? "Yêu cầu và ghi chú tối đa 1000 ký tự." : "Notes are limited to 1000 characters.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const payload = {
      contactEmail,
      departureDate: formData.departureDate,
      rentalUnit: formData.rentalUnit,
      durationValue,
      adultCount,
      childCount,
      startTime: formData.startTime ? `${formData.startTime}:00` : null,
      fromStationId: formData.fromStationId || null,
      toStationId: formData.toStationId || null,
      itineraryStops: formData.itineraryStops.map((stop, index) => ({
        stationId: stop.stationId || null,
        stopOrder: Number(stop.stopOrder || index + 1),
        stayDurationMinutes: Number(stop.stayDurationMinutes || 0),
        note: stop.note || null,
      })),
      requestedBoats: formData.requestedBoats.map((boat) => ({ seatSetupType: boat.seatSetupType })),
      preferredSeatSetupType: formData.requestedBoats[0]?.seatSetupType || "FullStandard",
      boatRequirements: formData.boatRequirements || null,
      specialRequests: formData.specialRequests || null,
    };

    try {
      setIsSubmitting(true);
      const savedResponse = isEditing
        ? await updateMyCharterBooking(editBooking.id, payload)
        : await createMyCharterBooking(payload);
      const createdBooking = savedResponse || { ...editBooking, ...payload };
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

      Swal.fire({
        icon: "success",
        title: isEditing
          ? (lang === "VN" ? "Đã cập nhật yêu cầu" : "Charter request updated")
          : (lang === "VN" ? "Đã gửi yêu cầu thuê tàu" : "Charter request submitted"),
        text: bookingCode !== "--"
          ? (lang === "VN" ? `Mã yêu cầu: ${bookingCode}` : `Request code: ${bookingCode}`)
          : (lang === "VN" ? "Bạn có thể theo dõi yêu cầu trong Hồ sơ." : "You can track this request from your profile."),
        confirmButtonColor: "#124757",
      }).then(() => {
        if (bookingId) {
          navigate(`/profile/charter-bookings/${bookingId}`, { state: { booking: savedBooking } });
        } else {
          navigate("/profile/charter-bookings");
        }
      });
    } catch (error) {
      console.error("Lỗi tạo charter booking:", error);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể gửi yêu cầu" : "Unable to submit request",
        text: getApiErrorMessage(error, lang === "VN" ? "Vui lòng kiểm tra ngày đi, số khách và thông tin lộ trình." : "Please check departure date, passenger count, and route information."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300">
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-24 space-y-8">
        <section className="grid lg:grid-cols-[1fr_360px] gap-5 items-stretch">
          <div className="bg-[#124757] dark:bg-slate-800 rounded-4xl p-6 md:p-8 border border-white/10 shadow-xl min-h-70 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-400/20 text-[11px] font-headline font-black uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">directions_boat</span>
                {lang === "VN" ? "Dịch vụ thuê trọn tàu" : "Private Charter Service"}
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-headline font-black text-white leading-tight">
                  {lang === "VN" ? "Dịch vụ thuê tàu WaterBus" : "WaterBus Charter Booking"}
                </h1>
                <p className="text-white/70 mt-4 max-w-3xl text-sm md:text-base leading-relaxed">
                  {lang === "VN"
                    ? "Gửi yêu cầu thuê tàu riêng, đội ngũ vận hành sẽ kiểm tra tàu phù hợp và phản hồi báo giá trong hồ sơ của bạn."
                    : "Submit a private charter request, then our team will assign a suitable boat and send a quote in your profile."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-8">
              {[
                { icon: "edit_calendar", textVn: "Chọn lịch", textEn: "Plan" },
                { icon: "request_quote", textVn: "Nhận báo giá", textEn: "Quote" },
                { icon: "account_circle", textVn: "Theo dõi hồ sơ", textEn: "Profile" },
              ].map((item) => (
                <div key={item.icon} className="bg-white/10 rounded-2xl p-4 border border-white/10">
                  <span className="material-symbols-outlined text-2xl text-yellow-300">{item.icon}</span>
                  <p className="text-white text-[11px] font-headline font-black uppercase tracking-wider mt-2">{lang === "VN" ? item.textVn : item.textEn}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="bg-white dark:bg-slate-800 rounded-4xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tóm tắt yêu cầu" : "Request Preview"}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">{totalGuests} {lang === "VN" ? "khách" : "guests"}</h2>
                  <span className="rounded-full bg-[#124757]/10 px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400">
                    {readyCount}/4 {lang === "VN" ? "sẵn sàng" : "ready"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                  <div
                    className="h-full rounded-full bg-[#FFD100] transition-all"
                    style={{ width: `${(readyCount / formReadiness.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {formReadiness.map((item) => (
                  <div key={item.label} className={`rounded-2xl border px-3 py-2.5 ${
                    item.ready
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">{item.ready ? "check_circle" : "radio_button_unchecked"}</span>
                      <span className="text-[10px] font-headline font-black uppercase tracking-wider">{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-headline font-black">{lang === "VN" ? "Ngày đi" : "Date"}</span>
                    <p className="mt-1 font-black text-slate-800 dark:text-white">{formatDate(formData.departureDate)}</p>
                    <p className="text-[11px] font-bold text-slate-400">{formData.startTime || "--"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-headline font-black">{lang === "VN" ? "Thời lượng" : "Duration"}</span>
                    <p className="mt-1 font-black text-slate-800 dark:text-white">{formData.durationValue} {formData.rentalUnit}</p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {departureLeadDays === null ? "--" : `${departureLeadDays} ${lang === "VN" ? "ngày nữa" : "days left"}`}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-headline font-black">{lang === "VN" ? "Timeline lộ trình" : "Route Timeline"}</span>
                    <span className="text-[10px] font-black text-slate-400">{routeTimeline.length} {lang === "VN" ? "điểm" : "points"}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {routeTimeline.map((item, index) => (
                      <div key={`${item.type}-${index}`} className="grid grid-cols-[24px_1fr] gap-2">
                        <div className="flex flex-col items-center">
                          <span className={`h-5 w-5 rounded-full flex items-center justify-center ${
                            item.type === "start"
                              ? "bg-emerald-500"
                              : item.type === "end"
                                ? "bg-[#124757] dark:bg-yellow-400"
                                : "bg-slate-300 dark:bg-slate-600"
                          }`}>
                            <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-900"></span>
                          </span>
                          {index < routeTimeline.length - 1 && <span className="mt-1 h-5 w-px bg-slate-200 dark:bg-slate-700"></span>}
                        </div>
                        <div className="min-w-0 pb-1">
                          <p className="truncate text-xs font-headline font-black text-slate-800 dark:text-white">{item.name}</p>
                          {item.note && <p className="text-[10px] font-bold text-slate-400">{item.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
                    <span className="material-symbols-outlined text-lg">info</span>
                    <p className="text-[11px] font-bold leading-5">
                      {lang === "VN"
                        ? `${formData.requestedBoats.length} tàu mong muốn, admin sẽ gán tàu active phù hợp và gửi báo giá trong hồ sơ.`
                        : `${formData.requestedBoats.length} requested boat(s); admins will assign matching active boats and send a quote to your profile.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/profile/charter-bookings")}
              className="mt-6 w-full rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 py-3 font-headline font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">folder_open</span>
              {lang === "VN" ? "Yêu cầu của tôi" : "My Requests"}
            </button>
          </aside>
        </section>

        <form onSubmit={handleCreateBooking} className="bg-white dark:bg-slate-800 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
          <div className="p-6 md:p-7 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
                {isEditing
                  ? (lang === "VN" ? "Chỉnh sửa yêu cầu thuê tàu" : "Edit Charter Request")
                  : (lang === "VN" ? "Tạo yêu cầu thuê tàu" : "Create Charter Request")}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today."}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-500 dark:text-slate-300">
              <span className="material-symbols-outlined text-base text-yellow-500">event_upcoming</span>
              {lang === "VN" ? "Theo API CharterBookings" : "CharterBookings API"}
            </div>
          </div>

          <div className="p-6 md:p-7 space-y-7">
            {!isAuthenticated && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">lock</span>
                {lang === "VN" ? "Bạn cần đăng nhập trước khi gửi yêu cầu thuê tàu." : "You need to sign in before submitting a charter request."}
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-sm">1</span>
                <h3 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">{lang === "VN" ? "Thông tin khách hàng" : "Customer Information"}</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Họ tên người đặt" : "Contact Name"}</label>
                  <input value={formData.customerName} onChange={(e) => handleFieldChange("customerName", e.target.value)} disabled={useAccountInfo} required maxLength={120} className={contactInputClass} placeholder={lang === "VN" ? "Nhập họ tên" : "Full name"} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Số điện thoại" : "Phone Number"}</label>
                  <input value={formData.contactPhone} onChange={(e) => handleFieldChange("contactPhone", e.target.value)} disabled={useAccountInfo} required maxLength={30} className={contactInputClass} placeholder={lang === "VN" ? "Nhập số điện thoại" : "Phone number"} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">Email</label>
                  <input type="email" value={formData.contactEmail} onChange={(e) => handleFieldChange("contactEmail", e.target.value)} disabled={useAccountInfo} required maxLength={160} className={contactInputClass} placeholder="email@example.com" />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-xl ${useAccountInfo ? "text-[#124757] dark:text-yellow-400" : "text-slate-400"}`}>
                    {useAccountInfo ? "lock" : "edit"}
                  </span>
                  <p className="text-[11px] text-slate-400 font-bold">
                    {useAccountInfo
                      ? (lang === "VN" ? "Đang dùng thông tin trong tài khoản. Bỏ tích nếu muốn nhập thông tin khác." : "Using your account information. Uncheck to enter different contact details.")
                      : (lang === "VN" ? "Bạn có thể nhập thủ công hoặc tích dùng thông tin tài khoản." : "You can enter manually or use your account information.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAccountInfoToggle}
                  disabled={isLoadingProfile}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
                    useAccountInfo
                      ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900 dark:border-yellow-400"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400"
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${isLoadingProfile ? "animate-spin" : ""}`}>
                    {isLoadingProfile ? "progress_activity" : useAccountInfo ? "check_box" : "check_box_outline_blank"}
                  </span>
                  {lang === "VN" ? "Dùng thông tin tài khoản" : "Use Account Info"}
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-sm">2</span>
                <h3 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">{lang === "VN" ? "Lịch trình" : "Schedule"}</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ngày khởi hành" : "Departure Date"}</label>
                  <input type="date" min={getMinDepartureDate()} value={formData.departureDate} onChange={(e) => handleFieldChange("departureDate", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Giờ đi" : "Start Time"}</label>
                  <input type="time" value={formData.startTime} onChange={(e) => handleFieldChange("startTime", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Đơn vị thuê" : "Rental Unit"}</label>
                  <select value={formData.rentalUnit} onChange={(e) => handleFieldChange("rentalUnit", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
                    <option value="Day">{lang === "VN" ? "Theo ngày" : "Day"}</option>
                    <option value="Hour">{lang === "VN" ? "Theo giờ" : "Hour"}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời lượng" : "Duration"}</label>
                  <input type="number" min="1" max="60" value={formData.durationValue} onChange={(e) => handleFieldChange("durationValue", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-sm">3</span>
                <h3 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">{lang === "VN" ? "Lộ trình & hành khách" : "Route & Guests"}</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến đi" : "From Station"}</label>
                  <select value={formData.fromStationId} onChange={(e) => handleFieldChange("fromStationId", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
                    <option value="">{lang === "VN" ? "Chưa chọn" : "Not selected"}</option>
                    {stations.map((station) => <option key={station.stationId || station.id} value={station.stationId || station.id}>{station.stationName || station.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến đến" : "To Station"}</label>
                  <select value={formData.toStationId} onChange={(e) => handleFieldChange("toStationId", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
                    <option value="">{lang === "VN" ? "Chưa chọn" : "Not selected"}</option>
                    {stations.map((station) => <option key={station.stationId || station.id} value={station.stationId || station.id}>{station.stationName || station.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Điểm dừng trung gian" : "Itinerary Stops"}</label>
                    <p className="text-[11px] text-slate-400 mt-1">{lang === "VN" ? "Có thể bỏ trống nếu không có điểm dừng." : "Leave empty if there are no extra stops."}</p>
                  </div>
                  <button type="button" onClick={handleAddStop} disabled={formData.itineraryStops.length >= 50} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 disabled:opacity-50">
                    <span className="material-symbols-outlined text-base">add_location_alt</span>
                    {lang === "VN" ? "Thêm điểm dừng" : "Add Stop"}
                  </button>
                </div>
                {formData.itineraryStops.length > 0 && (
                  <div className="space-y-3">
                    {formData.itineraryStops.map((stop, index) => (
                      <div key={`stop-${index}`} className="grid lg:grid-cols-[1.4fr_120px_160px_1fr_auto] gap-3 items-end rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến dừng" : "Stop Station"}</label>
                          <select value={stop.stationId} onChange={(e) => handleStopChange(index, "stationId", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
                            <option value="">{lang === "VN" ? "Chọn bến" : "Choose station"}</option>
                            {stations.map((station) => <option key={station.stationId || station.id} value={station.stationId || station.id}>{station.stationName || station.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thứ tự" : "Order"}</label>
                          <input type="number" min="0" value={stop.stopOrder} onChange={(e) => handleStopChange(index, "stopOrder", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời gian dừng" : "Stay Minutes"}</label>
                          <input type="number" min="0" value={stop.stayDurationMinutes} onChange={(e) => handleStopChange(index, "stayDurationMinutes", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ghi chú" : "Note"}</label>
                          <input value={stop.note} onChange={(e) => handleStopChange(index, "note", e.target.value)} maxLength={1000} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" placeholder={lang === "VN" ? "Ghi chú" : "Note"} />
                        </div>
                        <button type="button" onClick={() => handleRemoveStop(index)} className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Người lớn" : "Adults"}</label>
                  <input type="number" min="0" max="1000" value={formData.adultCount} onChange={(e) => handleFieldChange("adultCount", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Trẻ em" : "Children"}</label>
                  <input type="number" min="0" max="1000" value={formData.childCount} onChange={(e) => handleFieldChange("childCount", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
              </div>
              <div className="space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Danh sách tàu mong muốn" : "Requested Boats"}</label>
                    <p className="text-[11px] text-slate-400 mt-1">{lang === "VN" ? "Tối thiểu 1 tàu, tối đa 20 tàu." : "Request at least 1 boat, maximum 20 boats."}</p>
                  </div>
                  <button type="button" onClick={handleAddBoatRequest} disabled={formData.requestedBoats.length >= 20} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 disabled:opacity-50">
                    <span className="material-symbols-outlined text-base">add</span>
                    {lang === "VN" ? "Thêm tàu" : "Add Boat"}
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.requestedBoats.map((boat, index) => (
                    <div key={`boat-${index}`} className="grid sm:grid-cols-[auto_1fr_auto] gap-3 items-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                      <div className="h-11 w-11 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-sm">
                        {index + 1}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {seatSetupOptions.map((type) => {
                          const isSelected = boat.seatSetupType === type;
                          return (
                            <label key={`${index}-${type}`} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? "bg-yellow-400/15 border-yellow-400 text-[#124757] dark:text-yellow-300" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"}`}>
                              <input type="radio" name={`boat-${index}`} checked={isSelected} onChange={() => handleBoatRequestChange(index, type)} className="w-4 h-4 accent-[#124757]" />
                              <span className="material-symbols-outlined text-xl">{type === "StandardAndVip" ? "workspace_premium" : "event_seat"}</span>
                              <span className="min-w-0">
                                <span className="block text-xs font-headline font-black uppercase tracking-wider">
                                  {type === "StandardAndVip" ? (lang === "VN" ? "Thường + VIP" : "Standard + VIP") : (lang === "VN" ? "Toàn ghế thường" : "Full Standard")}
                                </span>
                                <span className="block text-[11px] font-medium opacity-70 mt-0.5">{type}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => handleRemoveBoatRequest(index)} disabled={formData.requestedBoats.length <= 1} className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center disabled:opacity-40">
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-sm">4</span>
                <h3 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">{lang === "VN" ? "Ghi chú báo giá" : "Quote Notes"}</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Yêu cầu về tàu" : "Boat Requirements"}</label>
                  <textarea value={formData.boatRequirements} onChange={(e) => handleFieldChange("boatRequirements", e.target.value)} maxLength={1000} rows={4} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" placeholder={lang === "VN" ? "Ví dụ: cần khu VIP, âm thanh, không gian tổ chức sinh nhật..." : "e.g. VIP area, sound setup, birthday decoration..."} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ghi chú đặc biệt" : "Special Requests"}</label>
                  <textarea value={formData.specialRequests} onChange={(e) => handleFieldChange("specialRequests", e.target.value)} maxLength={1000} rows={4} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-56 bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase tracking-widest text-xs rounded-2xl px-8 py-4 hover:brightness-110 transition-all disabled:opacity-60">
                  {isSubmitting
                    ? (lang === "VN" ? "Đang lưu..." : "Saving...")
                    : isEditing
                      ? (lang === "VN" ? "Lưu thay đổi" : "Save Changes")
                      : (lang === "VN" ? "Gửi yêu cầu" : "Submit")}
                </button>
              </div>
            </section>
          </div>
        </form>
      </main>
    </div>
  );
}
