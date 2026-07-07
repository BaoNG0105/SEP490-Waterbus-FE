import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { updateUserProfile } from "../../../redux/authSlice";
import { fetchAllStations } from "../../../services/stationService";
import { fetchCurrentUserProfile } from "../../../services/authService";
import { fetchMyCharterBookingDetail, updateMyCharterBooking } from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";

const deckOptions = [1, 2];
const deckOptionImages = {
  1: "https://saigonwaterbus.com/wp-content/uploads/2022/06/home-slide-6.jpg",
  2: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNjBezqsnPRbARMzFhnjKsf9iQcLUnZLV9CEBL1zV7w6uOrEm6V33a2Oo&s=10",
};
const editableStatuses = ["PendingQuote"];

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const getMinDepartureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const createEmptyStop = () => ({
  stationId: "",
  stopOrder: 1,
  stayDurationMinutes: 0,
  note: "",
});

const createEmptyBoatRequest = () => ({
  numberOfDecks: 1,
  seatSetupType: "FullStandard",
});

const getDeckFallbackSeatSetupType = (numberOfDecks) => (
  Number(numberOfDecks) === 2 ? "StandardAndVip" : "FullStandard"
);

const normalizeDeckCount = (value, fallback = 1) => {
  const numberOfDecks = Number(value);
  return deckOptions.includes(numberOfDecks) ? numberOfDecks : fallback;
};

const getRequestedBoatDeckCount = (boat, fallback = 1) => {
  const directDeckCount = normalizeDeckCount(
    pick(boat, ["requiredNumberOfDecks", "numberOfDecks", "preferredNumberOfDecks", "deckCount"], 0),
    0,
  );
  if (directDeckCount) return directDeckCount;

  const legacySeatSetupType = pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "");
  return legacySeatSetupType === "StandardAndVip" ? 2 : fallback;
};

const buildFormDataFromDetail = (detail, user) => ({
  customerName: pick(detail, ["contactName"], user?.fullName || ""),
  contactPhone: pick(detail, ["contactPhone"], user?.phoneNumber || user?.phone || ""),
  contactEmail: pick(detail, ["contactEmail"], user?.email || ""),
  departureDate: toDateInputValue(pick(detail, ["departureDate"])) || getMinDepartureDate(),
  rentalUnit: pick(detail, ["rentalUnit"], "Day"),
  durationValue: Number(pick(detail, ["durationValue"], 1)),
  adultCount: Number(pick(detail, ["adultCount"], 1)),
  childCount: Number(pick(detail, ["childCount"], 0)),
  startTime: pick(detail, ["startTime"], "08:00").slice(0, 5),
  fromStationId: pick(detail, ["fromStationId"], ""),
  toStationId: pick(detail, ["toStationId"], ""),
  requestedBoats: Array.isArray(detail?.requestedBoats) && detail.requestedBoats.length > 0
    ? detail.requestedBoats.map((boat) => {
      const numberOfDecks = getRequestedBoatDeckCount(boat);
      return { numberOfDecks, seatSetupType: getDeckFallbackSeatSetupType(numberOfDecks) };
    })
    : [createEmptyBoatRequest()],
  itineraryStops: Array.isArray(detail?.itineraryStops)
    ? detail.itineraryStops.map((stop, index) => ({
      stationId: pick(stop, ["stationId"], ""),
      stopOrder: Number(pick(stop, ["stopOrder"], index + 1)),
      stayDurationMinutes: Number(pick(stop, ["stayDurationMinutes"], 0)),
      note: pick(stop, ["note"], ""),
    }))
    : [],
  specialRequests: pick(detail, ["specialRequests"], ""),
});

export function EditCharter() {
  const { lang } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [useAccountInfo, setUseAccountInfo] = useState(false);
  const [accountInfoApplied, setAccountInfoApplied] = useState(false);
  const [isRentalUnitOpen, setIsRentalUnitOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState(null);
  const updateRequestInFlightRef = useRef(false);

  const loadStations = useCallback(async () => {
    try {
      const stationData = await fetchAllStations();
      setStations(Array.isArray(stationData) ? stationData.filter((station) => station.status !== "Inactive") : []);
    } catch (error) {
      console.error("Lỗi tải danh sách bến:", error);
    }
  }, []);

  const loadBookingDetail = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      setLoadError("");
      const detail = await fetchMyCharterBookingDetail(id);
      const status = pick(detail, ["bookingStatus", "status"], "PendingQuote");

      if (!editableStatuses.includes(status)) {
        setLoadError(lang === "VN"
          ? "Yêu cầu này đã được báo giá hoặc xử lý nên không thể chỉnh sửa."
          : "This request has already been quoted or processed and can no longer be edited.");
        return;
      }

      setBookingCode(pick(detail, ["bookingCode", "code"], "--"));
      setFormData(buildFormDataFromDetail(detail, user));
    } catch (error) {
      setLoadError(getApiErrorMessage(error, lang === "VN"
        ? "Không thể tải chi tiết yêu cầu để chỉnh sửa."
        : "Unable to load the request details for editing."));
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthenticated, lang, navigate, user]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadStations();
    loadBookingDetail();
  }, [loadStations, loadBookingDetail]);

  const contactInputClass = `w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400`;
  const contactLabelClass = "flex min-h-4 items-center text-[10px] font-headline font-black uppercase tracking-wider text-slate-400";
  const contactErrorTextClass = "text-[11px] font-bold text-rose-500 dark:text-rose-300";
  const requiredMark = <span className="ml-1 text-[#FFD100]" aria-hidden="true">*</span>;
  const contactFieldLabels = {
    customerName: lang === "VN" ? "họ tên người đặt" : "contact name",
    contactPhone: lang === "VN" ? "số điện thoại" : "phone number",
    contactEmail: lang === "VN" ? "email liên hệ" : "contact email",
  };
  const contactRequiredMessages = {
    customerName: lang === "VN" ? "Vui lòng nhập họ tên người đặt." : "Please enter contact name.",
    contactPhone: lang === "VN" ? "Vui lòng nhập số điện thoại." : "Please enter phone number.",
    contactEmail: lang === "VN" ? "Vui lòng nhập email liên hệ." : "Please enter contact email.",
  };
  const getContactInputClass = (field) => `${contactInputClass} ${fieldErrors[field] ? "border-rose-400 dark:border-rose-400 focus:ring-rose-400 bg-rose-50 dark:bg-rose-950/30" : ""}`;
  const getContactFieldErrors = (data = formData || {}) => {
    const errors = {};
    const customerName = String(data.customerName || "").trim();
    const contactPhone = String(data.contactPhone || "").trim();
    const contactEmail = String(data.contactEmail || "").trim();

    if (!customerName) errors.customerName = contactRequiredMessages.customerName;
    if (!contactPhone) errors.contactPhone = contactRequiredMessages.contactPhone;
    if (!contactEmail) {
      errors.contactEmail = contactRequiredMessages.contactEmail;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errors.contactEmail = lang === "VN" ? "Email liên hệ chưa đúng định dạng." : "Contact email is not valid.";
    }

    return errors;
  };
  const getContactValidationText = (errors) => {
    const fields = Object.keys(errors);
    if (fields.length <= 1) return errors[fields[0]] || "";

    const requiredFields = fields.filter((field) => errors[field] === contactRequiredMessages[field]);
    if (requiredFields.length === fields.length) {
      const labels = requiredFields.map((field) => contactFieldLabels[field]).join(", ");
      return lang === "VN" ? `Vui lòng bổ sung: ${labels}.` : `Please fill in: ${labels}.`;
    }

    return fields.map((field) => errors[field]).join(" ");
  };
  const focusContactField = (field) => {
    if (!field) return;
    window.setTimeout(() => {
      document.getElementById(`edit-charter-${field}`)?.focus();
    }, 0);
  };

  const steps = [
    { titleVn: "Thông tin khách hàng", titleEn: "Customer Information", icon: "person" },
    { titleVn: "Lịch trình", titleEn: "Schedule", icon: "event" },
    { titleVn: "Lộ trình & hành khách", titleEn: "Route & Guests", icon: "route" },
    { titleVn: "Ghi chú", titleEn: "Notes", icon: "notes" },
  ];
  const isLastStep = currentStep === steps.length - 1;
  const durationUnitLabel = formData?.rentalUnit === "Hour"
    ? (lang === "VN" ? "giờ" : "hour")
    : (lang === "VN" ? "ngày" : "day");
  const rentalUnitOptions = [
    { value: "Day", label: lang === "VN" ? "Theo ngày" : "Day", icon: "calendar_today" },
    { value: "Hour", label: lang === "VN" ? "Theo giờ" : "Hour", icon: "schedule" },
  ];
  const selectedRentalUnitOption = rentalUnitOptions.find((option) => option.value === formData?.rentalUnit) || rentalUnitOptions[0];
  const getStationNameById = (stationId) => {
    const station = stations.find((item) => String(item.stationId || item.id) === String(stationId));
    return station?.stationName || station?.name || (lang === "VN" ? "Chưa chọn" : "Not selected");
  };
  const formatDepartureDate = (value) => {
    if (!value) return lang === "VN" ? "Chưa chọn" : "Not selected";
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return value;

    return new Intl.DateTimeFormat(lang === "VN" ? "vi-VN" : "en-US", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  };
  const totalPassengers = Number(formData?.adultCount || 0) + Number(formData?.childCount || 0);
  const routeSummary = formData?.fromStationId && formData?.toStationId
    ? `${getStationNameById(formData.fromStationId)} - ${getStationNameById(formData.toStationId)}`
    : (lang === "VN" ? "Chưa chọn đủ bến đi và bến đến" : "Origin and destination not completed");
  const requestedBoatSummary = (() => {
    const requestedBoats = Array.isArray(formData?.requestedBoats) ? formData.requestedBoats : [];
    const deckCounts = requestedBoats.reduce((counts, boat) => {
      const deckCount = normalizeDeckCount(boat.numberOfDecks);
      return { ...counts, [deckCount]: (counts[deckCount] || 0) + 1 };
    }, {});
    const deckText = deckOptions
      .filter((deckCount) => deckCounts[deckCount])
      .map((deckCount) => (
        lang === "VN"
          ? `${deckCounts[deckCount]} tàu ${deckCount} tầng`
          : `${deckCounts[deckCount]} ${deckCount === 1 ? "single-deck" : "double-deck"} boat${deckCounts[deckCount] > 1 ? "s" : ""}`
      ))
      .join(", ");

    return deckText || (lang === "VN" ? "Chưa chọn tàu" : "No boats selected");
  })();
  const finalStepSummaryItems = [
    {
      icon: "event",
      label: lang === "VN" ? "Khởi hành" : "Departure",
      value: `${formatDepartureDate(formData?.departureDate)} - ${formData?.startTime || "--:--"}`,
    },
    {
      icon: "route",
      label: lang === "VN" ? "Lộ trình" : "Route",
      value: routeSummary,
    },
    {
      icon: "groups",
      label: lang === "VN" ? "Hành khách" : "Guests",
      value: lang === "VN"
        ? `${totalPassengers} khách (${formData?.adultCount || 0} người lớn, ${formData?.childCount || 0} trẻ em)`
        : `${totalPassengers} guests (${formData?.adultCount || 0} adults, ${formData?.childCount || 0} children)`,
    },
    {
      icon: "directions_boat",
      label: lang === "VN" ? "Tàu mong muốn" : "Requested boats",
      value: requestedBoatSummary,
    },
  ];

  const validateCustomerStep = () => {
    const errors = getContactFieldErrors();
    const firstErrorField = Object.keys(errors)[0];

    setFieldErrors(errors);
    if (firstErrorField) return { text: getContactValidationText(errors), field: firstErrorField };

    return null;
  };

  const validateScheduleStep = () => {
    const durationValue = Number(formData.durationValue);
    const minDepartureDate = getMinDepartureDate();

    if (!formData.departureDate || formData.departureDate < minDepartureDate) {
      return lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.";
    }
    if (!formData.startTime) {
      return lang === "VN" ? "Vui lòng chọn giờ đi." : "Please choose a start time.";
    }
    if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 60) {
      return lang === "VN" ? "Thời lượng thuê phải là số nguyên từ 1 đến 60." : "Duration must be an integer from 1 to 60.";
    }
    return null;
  };

  const validateRouteStep = () => {
    const adultCount = Number(formData.adultCount);
    const childCount = Number(formData.childCount);
    const totalPassengers = adultCount + childCount;

    if (!formData.fromStationId || !formData.toStationId) {
      return lang === "VN" ? "Bạn cần chọn cả bến đi và bến đến trước khi tiếp tục." : "Select both origin and destination stations before continuing.";
    }
    if (formData.fromStationId === formData.toStationId) {
      return lang === "VN" ? "Bến đến phải khác bến đi." : "Destination station must be different from origin station.";
    }
    if (!Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0 || adultCount > 1000 || childCount > 1000 || totalPassengers <= 0 || totalPassengers > 1000) {
      return lang === "VN" ? "Người lớn và trẻ em từ 0 đến 1000, tổng hành khách phải lớn hơn 0 và không quá 1000." : "Adults and children must be 0-1000, and total passengers must be greater than 0 and no more than 1000.";
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
      return lang === "VN" ? "Tối đa 50 điểm dừng; mỗi điểm cần có bến dừng, thứ tự và thời gian dừng không âm." : "Maximum 50 stops; each stop needs a station, non-negative order, and non-negative stay minutes.";
    }
    if (formData.requestedBoats.length < 1 || formData.requestedBoats.length > 20 || formData.requestedBoats.some((boat) => !deckOptions.includes(Number(boat.numberOfDecks)))) {
      return lang === "VN" ? "Cần ít nhất 1 tàu, tối đa 20 tàu, mỗi tàu chọn 1 tầng hoặc 2 tầng." : "Please request 1-20 boats, each with 1 or 2 decks.";
    }
    return null;
  };

  const stepValidators = [validateCustomerStep, validateScheduleStep, validateRouteStep, () => null];
  const hasRequiredCustomerInfo = Boolean(
    formData?.customerName?.trim()
    && formData?.contactPhone?.trim()
    && formData?.contactEmail?.trim()
  );
  const canContinueToNext = currentStep === 0
    ? hasRequiredCustomerInfo
    : currentStep === 1
      ? !validateScheduleStep()
      : currentStep === 2
        ? !validateRouteStep()
        : true;

  const handleNextStep = () => {
    const validationResult = stepValidators[currentStep]();
    const errorText = typeof validationResult === "string" ? validationResult : validationResult?.text;
    if (errorText) {
      if (validationResult?.field) focusContactField(validationResult.field);
      if (currentStep === 0) return;
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Vui lòng kiểm tra lại thông tin" : "Please check your information",
        text: errorText,
        confirmButtonColor: "#124757",
      });
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBackStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRentalUnitChange = (rentalUnit) => {
    setFormData((prev) => ({
      ...prev,
      rentalUnit,
      durationValue: 1,
    }));
    setIsRentalUnitOpen(false);
  };

  const handleAccountInfoToggle = async () => {
    if (useAccountInfo || accountInfoApplied) {
      setUseAccountInfo(false);
      setAccountInfoApplied(false);
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
    const hasAnyContact = (profile) => {
      const contact = getProfileContact(profile);
      return Boolean(contact.customerName || contact.contactPhone || contact.contactEmail);
    };
    const getMissingProfileFields = (profile) => {
      const contact = getProfileContact(profile);
      return [
        !contact.customerName ? "customerName" : "",
        !contact.contactPhone ? "contactPhone" : "",
        !contact.contactEmail ? "contactEmail" : "",
      ].filter(Boolean);
    };

    const applyProfile = (profile) => {
      const contact = getProfileContact(profile);
      setFormData((prev) => ({
        ...prev,
        customerName: contact.customerName || prev.customerName,
        contactPhone: contact.contactPhone || prev.contactPhone,
        contactEmail: contact.contactEmail || prev.contactEmail,
      }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (contact.customerName) delete next.customerName;
        if (contact.contactPhone) delete next.contactPhone;
        if (contact.contactEmail) delete next.contactEmail;
        return next;
      });
      return Boolean(contact.customerName || contact.contactPhone || contact.contactEmail);
    };

    if (hasFullContact(user)) {
      const hasAppliedInfo = applyProfile(user);
      setAccountInfoApplied(hasAppliedInfo);
      setUseAccountInfo(true);
      return;
    }

    try {
      setIsLoadingProfile(true);
      const profile = await fetchCurrentUserProfile();
      dispatch(updateUserProfile(profile));
      const hasAppliedInfo = applyProfile(profile);
      const canUseAccountInfo = hasFullContact(profile);
      setUseAccountInfo(canUseAccountInfo);
      setAccountInfoApplied(hasAppliedInfo || hasAnyContact(profile));
      if (!canUseAccountInfo) {
        const missingProfileFields = getMissingProfileFields(profile);
        setFieldErrors((prev) => {
          const next = { ...prev };
          missingProfileFields.forEach((field) => {
            if (!String(formData[field] || "").trim()) next[field] = contactRequiredMessages[field];
          });
          return next;
        });
        focusContactField(missingProfileFields[0]);
      }
    } catch (error) {
      console.error("Lỗi lấy thông tin tài khoản:", error);
      setUseAccountInfo(false);
      setAccountInfoApplied(false);
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

  const handleBoatRequestChange = (index, numberOfDecks) => {
    const deckCount = normalizeDeckCount(numberOfDecks);
    setFormData((prev) => ({
      ...prev,
      requestedBoats: prev.requestedBoats.map((boat, boatIndex) => (
        boatIndex === index
          ? { ...boat, numberOfDecks: deckCount, seatSetupType: getDeckFallbackSeatSetupType(deckCount) }
          : boat
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

  const handleUpdateBooking = async (event) => {
    event.preventDefault();

    if (!isLastStep) {
      handleNextStep();
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
    const contactErrors = getContactFieldErrors();
    const firstContactErrorField = Object.keys(contactErrors)[0];

    if (firstContactErrorField) {
      setFieldErrors(contactErrors);
      setCurrentStep(0);
      focusContactField(firstContactErrorField);
      return;
    }

    if (!formData.departureDate || formData.departureDate < minDepartureDate) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Ngày khởi hành chưa hợp lệ" : "Invalid departure date",
        text: lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!formData.startTime) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Giờ đi chưa hợp lệ" : "Invalid start time",
        text: lang === "VN" ? "Vui lòng chọn giờ đi." : "Please choose a start time.",
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
        text: lang === "VN" ? "Bạn cần chọn cả bến đi và bến đến trước khi lưu." : "Select both origin and destination stations before saving.",
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

    if (formData.requestedBoats.length < 1 || formData.requestedBoats.length > 20 || formData.requestedBoats.some((boat) => !deckOptions.includes(Number(boat.numberOfDecks)))) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Danh sách tàu chưa hợp lệ" : "Invalid requested boats",
        text: lang === "VN" ? "Cần ít nhất 1 tàu, tối đa 20 tàu, mỗi tàu chọn 1 tầng hoặc 2 tầng." : "Please request 1-20 boats, each with 1 or 2 decks.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.specialRequests.length > 1000) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Nội dung nhập quá dài" : "Input is too long",
        text: lang === "VN" ? "Ghi chú tối đa 1000 ký tự." : "Notes are limited to 1000 characters.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const payload = {
      contactName: customerName,
      contactPhone,
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
      requestedBoats: formData.requestedBoats.map((boat) => {
        const numberOfDecks = normalizeDeckCount(boat.numberOfDecks);
        return {
          numberOfDecks,
          requiredNumberOfDecks: numberOfDecks,
          seatSetupType: getDeckFallbackSeatSetupType(numberOfDecks),
        };
      }),
      preferredNumberOfDecks: normalizeDeckCount(formData.requestedBoats[0]?.numberOfDecks),
      preferredSeatSetupType: getDeckFallbackSeatSetupType(formData.requestedBoats[0]?.numberOfDecks),
      specialRequests: formData.specialRequests || null,
    };

    if (isSubmitting || updateRequestInFlightRef.current) return;
    updateRequestInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await updateMyCharterBooking(id, payload);

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã cập nhật yêu cầu" : "Charter request updated",
        text: bookingCode !== "--"
          ? (lang === "VN" ? `Mã yêu cầu: ${bookingCode}` : `Request code: ${bookingCode}`)
          : "",
        confirmButtonColor: "#124757",
      }).then(() => {
        navigate(`/profile/my-charter-booking/${id}`);
      });
    } catch (error) {
      console.error("Lỗi cập nhật charter booking:", error);
      const isConflict = error.response?.status === 409;
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể cập nhật" : "Unable to update request",
        text: isConflict
          ? (lang === "VN"
            ? "Dữ liệu yêu cầu vừa thay đổi hoặc đã có một lần lưu đang xử lý. Vui lòng tải lại rồi thử lại."
            : "This request was just changed or another save is still being processed. Please reload and try again.")
          : getApiErrorMessage(error, lang === "VN" ? "Vui lòng kiểm tra ngày đi, số khách và thông tin lộ trình." : "Please check departure date, passenger count, and route information."),
        confirmButtonColor: "#124757",
        confirmButtonText: isConflict ? (lang === "VN" ? "Tải lại dữ liệu" : "Reload") : "OK",
        showCancelButton: isConflict,
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      }).then((result) => {
        if (isConflict && result.isConfirmed) loadBookingDetail();
      });
    } finally {
      updateRequestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center pt-32 pb-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (loadError || !formData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-32 pb-20 px-4 sm:px-6 lg:px-8 font-body">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-100 dark:border-slate-700/50 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
            <h1 className="mt-3 text-xl font-headline font-black text-[#124757] dark:text-white">
              {lang === "VN" ? "Không thể chỉnh sửa yêu cầu" : "Unable to edit this request"}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {loadError || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later.")}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <button onClick={() => navigate(`/profile/my-charter-booking/${id}`)} className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 font-bold text-sm">
                {lang === "VN" ? "Quay lại chi tiết" : "Back to request"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300 pt-32 pb-20 px-4 md:px-8">
      <main className="relative max-w-5xl mx-auto">
        <button onClick={() => navigate(`/profile/my-charter-booking/${id}`)} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại chi tiết" : "Back to Request"}
        </button>

        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <form noValidate onSubmit={handleUpdateBooking} className="relative bg-white dark:bg-slate-800 rounded-4xl shadow-[0_25px_70px_rgba(18,71,87,0.10)] border border-slate-100 dark:border-slate-700/50 overflow-hidden">
          <div className="p-8 md:p-10 border-b border-slate-100 dark:border-slate-700 space-y-6 text-center bg-linear-to-b from-slate-50/70 to-transparent dark:from-slate-900/40">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 text-yellow-600 dark:text-yellow-400 border border-yellow-400/20 text-[10px] font-headline font-black uppercase tracking-widest">
                {lang === "VN" ? `Bước ${currentStep + 1}/${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`}
              </span>
              <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Chỉnh sửa yêu cầu thuê tàu" : "Edit Charter Request"}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {bookingCode !== "--"
                  ? (lang === "VN" ? `Mã yêu cầu ${bookingCode}` : `Request code ${bookingCode}`)
                  : (lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.")}
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 sm:gap-3 overflow-x-auto">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isDone = index < currentStep;
                return (
                  <div key={step.icon} className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => isDone && setCurrentStep(index)}
                      disabled={!isDone}
                      className={`flex items-center gap-2 ${isDone ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-headline font-black text-sm shrink-0 transition-colors ${isActive
                        ? "bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900"
                        : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}>
                        {isDone ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
                      </span>
                      <span className={`hidden sm:inline text-[11px] font-headline font-black uppercase tracking-wider whitespace-nowrap ${isActive
                        ? "text-[#124757] dark:text-yellow-400"
                        : isDone
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400"
                        }`}>
                        {lang === "VN" ? step.titleVn : step.titleEn}
                      </span>
                    </button>
                    {index < steps.length - 1 && <span className="w-4 sm:w-10 h-px bg-slate-200 dark:bg-slate-700"></span>}
                  </div>
                );
              })}
            </div>

            <div className="max-w-md mx-auto h-1.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FFD100] transition-all duration-500"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-7">
            {/* Thông tin khách hàng */}
            {currentStep === 0 && (
            <section className="space-y-6 max-w-3xl mx-auto">
              <div className="flex flex-col items-center text-center gap-3">
                <div>
                  <h3 className="font-headline font-black text-slate-800 dark:text-white text-lg">{lang === "VN" ? "Thông tin khách hàng" : "Customer Information"}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{lang === "VN" ? "Cho chúng tôi biết ai là người liên hệ chính của yêu cầu này." : "Tell us who the main contact for this request is."}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>{lang === "VN" ? "Họ tên người đặt" : "Contact Name"}{requiredMark}</label>
                  <input id="edit-charter-customerName" value={formData.customerName} onChange={(e) => handleFieldChange("customerName", e.target.value)} disabled={useAccountInfo} required maxLength={120} className={getContactInputClass("customerName")} placeholder={lang === "VN" ? "Nhập họ tên" : "Full name"} aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "edit-charter-customerName-error" : undefined} />
                  {fieldErrors.customerName && <p id="edit-charter-customerName-error" className={contactErrorTextClass}>{fieldErrors.customerName}</p>}
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>{lang === "VN" ? "Số điện thoại" : "Phone Number"}{requiredMark}</label>
                  <input id="edit-charter-contactPhone" value={formData.contactPhone} onChange={(e) => handleFieldChange("contactPhone", e.target.value)} disabled={useAccountInfo} required maxLength={30} className={getContactInputClass("contactPhone")} placeholder={lang === "VN" ? "Nhập số điện thoại" : "Phone number"} aria-invalid={Boolean(fieldErrors.contactPhone)} aria-describedby={fieldErrors.contactPhone ? "edit-charter-contactPhone-error" : undefined} />
                  {fieldErrors.contactPhone && <p id="edit-charter-contactPhone-error" className={contactErrorTextClass}>{fieldErrors.contactPhone}</p>}
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>Email{requiredMark}</label>
                  <input id="edit-charter-contactEmail" type="email" value={formData.contactEmail} onChange={(e) => handleFieldChange("contactEmail", e.target.value)} disabled={useAccountInfo} required maxLength={160} className={getContactInputClass("contactEmail")} placeholder="email@example.com" aria-invalid={Boolean(fieldErrors.contactEmail)} aria-describedby={fieldErrors.contactEmail ? "edit-charter-contactEmail-error" : undefined} />
                  {fieldErrors.contactEmail && <p id="edit-charter-contactEmail-error" className={contactErrorTextClass}>{fieldErrors.contactEmail}</p>}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAccountInfoToggle}
                  disabled={isLoadingProfile}
                  className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition-all disabled:opacity-50 ${accountInfoApplied
                    ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900 dark:border-yellow-400"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 hover:bg-slate-50"
                    }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 border-current ${isLoadingProfile ? "animate-spin" : ""}`}>
                    {accountInfoApplied && !isLoadingProfile && <span className="h-2 w-2 rounded-full bg-current"></span>}
                  </span>
                  <span className="hidden sm:inline">{lang === "VN" ? "Dùng thông tin tài khoản" : "Use Account Info"}</span>
                  <span className="sm:hidden">{lang === "VN" ? "Dùng tài khoản" : "Account Info"}</span>
                </button>
              </div>
            </section>
            )}
            {/* Lịch trình */}
            {currentStep === 1 && (
            <section className="space-y-6 max-w-3xl mx-auto">
              <div className="flex flex-col items-center text-center gap-3">
                <div>
                  <h3 className="font-headline font-black text-slate-800 dark:text-white text-lg">{lang === "VN" ? "Lịch trình" : "Schedule"}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{lang === "VN" ? "Chọn thời gian bạn muốn khởi hành và thời lượng thuê tàu." : "Choose when you'd like to depart and how long you need the boat."}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>{lang === "VN" ? "Ngày khởi hành" : "Departure Date"}{requiredMark}</label>
                  <input type="date" min={getMinDepartureDate()} value={formData.departureDate} onChange={(e) => handleFieldChange("departureDate", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>{lang === "VN" ? "Giờ đi" : "Start Time"}{requiredMark}</label>
                  <input type="time" value={formData.startTime} onChange={(e) => handleFieldChange("startTime", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>
                    {lang === "VN" ? `Thời lượng (${durationUnitLabel})` : `Duration (${durationUnitLabel})`}{requiredMark}
                  </label>
                  <div className="flex overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-[#FFD100]">
                    <input type="number" min="1" max="60" value={formData.durationValue} onChange={(e) => handleFieldChange("durationValue", e.target.value)} required className="min-w-0 flex-1 px-4 py-3 bg-transparent text-sm font-bold text-slate-800 dark:text-white outline-none" />
                    <span className="flex min-w-16 items-center justify-center border-l border-yellow-300/70 bg-yellow-100 px-3 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757]">
                      {durationUnitLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={contactLabelClass}>{lang === "VN" ? "Đơn vị thuê" : "Rental Unit"}{requiredMark}</label>
                  <div
                    className="relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setIsRentalUnitOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setIsRentalUnitOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsRentalUnitOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-800 outline-none transition-all dark:bg-slate-900 dark:text-white ${isRentalUnitOpen
                        ? "border-[#FFD100] ring-2 ring-[#FFD100]"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                        }`}
                      aria-haspopup="listbox"
                      aria-expanded={isRentalUnitOpen}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="material-symbols-outlined text-lg text-[#124757] dark:text-yellow-400">{selectedRentalUnitOption.icon}</span>
                        <span className="truncate">{selectedRentalUnitOption.label}</span>
                      </span>
                      <span className={`material-symbols-outlined text-xl text-slate-500 transition-transform ${isRentalUnitOpen ? "rotate-180" : ""}`}>expand_more</span>
                    </button>
                    {isRentalUnitOpen && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900" role="listbox">
                        {rentalUnitOptions.map((option) => {
                          const isSelected = formData.rentalUnit === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleRentalUnitChange(option.value)}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors ${isSelected
                                ? "bg-yellow-50 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300"
                                : "text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span className="material-symbols-outlined text-lg">{option.icon}</span>
                                <span className="truncate">{option.label}</span>
                              </span>
                              {isSelected && <span className="material-symbols-outlined text-lg">check</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
            )}
            {/* Lộ trình và hành khách */}
            {currentStep === 2 && (
            <section className="space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div>
                  <h3 className="font-headline font-black text-slate-800 dark:text-white text-lg">{lang === "VN" ? "Lộ trình & hành khách" : "Route & Guests"}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{lang === "VN" ? "Thiết lập lộ trình, điểm dừng và số lượng tàu bạn cần." : "Set up your route, stops, and the boats you need."}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={contactLabelClass}>{lang === "VN" ? "Bến đi" : "From Station"}{requiredMark}</label>
                  <select value={formData.fromStationId} onChange={(e) => handleFieldChange("fromStationId", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
                    <option value="">{lang === "VN" ? "Chưa chọn" : "Not selected"}</option>
                    {stations.map((station) => <option key={station.stationId || station.id} value={station.stationId || station.id}>{station.stationName || station.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={contactLabelClass}>{lang === "VN" ? "Bến đến" : "To Station"}{requiredMark}</label>
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
                  </div>
                  <button type="button" onClick={handleAddBoatRequest} disabled={formData.requestedBoats.length >= 20} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 disabled:opacity-50">
                    <span className="material-symbols-outlined text-base">add</span>
                    {lang === "VN" ? "Thêm tàu" : "Add Boat"}
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {deckOptions.map((deckCount) => {
                    const deckLabel = lang === "VN" ? `${deckCount} tầng` : `${deckCount} ${deckCount === 1 ? "deck" : "decks"}`;
                    return (
                      <div key={`deck-preview-${deckCount}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                        <div className="relative h-28 overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img src={deckOptionImages[deckCount]} alt={deckLabel} loading="lazy" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 bg-linear-to-t from-slate-950/50 via-transparent to-transparent"></span>
                        </div>
                        <div className="flex items-center gap-2.5 p-3">
                          <span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">directions_boat</span>
                          <div>
                            <p className="text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:text-white">{deckLabel}</p>
                            <p className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Ảnh mẫu để nhận diện loại tàu." : "Reference image for this boat type."}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {formData.requestedBoats.map((boat, index) => (
                    <div key={`boat-${index}`} className="grid gap-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 md:grid-cols-[minmax(140px,1fr)_minmax(260px,360px)_44px] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400">
                          <span className="material-symbols-outlined text-lg">directions_boat</span>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-headline font-black uppercase tracking-wider text-[#124757] dark:text-white">
                            {lang === "VN" ? `Tàu ${index + 1}` : `Boat ${index + 1}`}
                          </p>
                          <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                            {lang === "VN" ? "Chọn số tầng" : "Choose decks"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                        {deckOptions.map((deckCount) => {
                          const isSelected = Number(boat.numberOfDecks) === deckCount;
                          return (
                            <button
                              key={`${index}-deck-${deckCount}`}
                              type="button"
                              onClick={() => handleBoatRequestChange(index, deckCount)}
                              className={`flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${isSelected
                                ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                                : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                              <span className="material-symbols-outlined text-base">{isSelected ? "check_circle" : "radio_button_unchecked"}</span>
                              {lang === "VN" ? `${deckCount} tầng` : `${deckCount} ${deckCount === 1 ? "deck" : "decks"}`}
                            </button>
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
            )}
            {/* Ghi chú */}
            {currentStep === 3 && (
            <section className="space-y-6 max-w-4xl mx-auto">
              <div className="flex flex-col items-center text-center gap-3">
                <div>
                  <h3 className="font-headline font-black text-slate-800 dark:text-white text-xl">{lang === "VN" ? "Xác nhận & ghi chú" : "Review & Notes"}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{lang === "VN" ? "Kiểm tra nhanh thông tin đã chọn, sau đó cập nhật yêu cầu riêng nếu cần." : "Review your selected details, then update any request notes if needed."}</p>
                </div>
              </div>
              <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
                <aside className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400">
                      <span className="material-symbols-outlined text-xl">fact_check</span>
                    </span>
                    <div>
                      <h4 className="font-headline font-black text-[#124757] dark:text-white text-sm uppercase tracking-wider">
                        {lang === "VN" ? "Tóm tắt yêu cầu" : "Request summary"}
                      </h4>
                      <p className="text-[11px] font-medium text-slate-400">
                        {lang === "VN" ? "Thông tin chính trước khi lưu" : "Key details before saving"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {finalStepSummaryItems.map((item) => (
                      <div key={item.icon} className="flex gap-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
                        <span className="material-symbols-outlined mt-0.5 text-lg text-[#124757] dark:text-yellow-400">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                          <p className="mt-1 text-sm font-bold leading-snug text-slate-700 dark:text-slate-100">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="space-y-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-headline font-black text-[#124757] dark:text-white text-sm uppercase tracking-wider">
                        {lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}
                      </h4>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        {lang === "VN" ? "Có thể bỏ trống nếu không có yêu cầu riêng." : "You can leave this empty if there are no extra requests."}
                      </p>
                    </div>
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300">
                      {lang === "VN" ? "Không bắt buộc" : "Optional"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}</label>
                      <span className="text-[10px] font-bold text-slate-400">{String(formData.specialRequests || "").length}/1000</span>
                    </div>
                    <textarea value={formData.specialRequests} onChange={(e) => handleFieldChange("specialRequests", e.target.value)} maxLength={1000} rows={5} className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#FFD100] focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder={lang === "VN" ? "Ví dụ: cần trang trí sinh nhật, đón khách lớn tuổi, chuẩn bị nước uống..." : "e.g. birthday decoration, elderly guests, drinks prepared..."} />
                  </div>
                </div>
              </div>
            </section>
            )}

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={handleBackStep}
                disabled={currentStep === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-300 px-6 py-3.5 font-headline font-black uppercase tracking-widest text-xs disabled:opacity-40 mt-5"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                {lang === "VN" ? "Quay lại" : "Back"}
              </button>
              {isLastStep ? (
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-56 bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase tracking-widest text-xs rounded-2xl px-8 py-4 hover:brightness-110 transition-all disabled:opacity-60 mt-5">
                  {isSubmitting
                    ? (lang === "VN" ? "Đang lưu..." : "Saving...")
                    : (lang === "VN" ? "Lưu thay đổi" : "Save Changes")}
                </button>
              ) : (
                <button type="submit" disabled={!canContinueToNext} className="inline-flex items-center gap-2 w-full sm:w-auto min-w-56 justify-center bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase tracking-widest text-xs rounded-2xl px-8 py-4 hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 mt-5">
                  {lang === "VN" ? "Tiếp theo" : "Next"}
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
