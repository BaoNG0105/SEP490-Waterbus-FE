import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { fetchAllStations } from "../services/stationService";
import { fetchActiveInsurancePackages, findInsurancePackageById, getInsurancePackageId, isSameInsurancePackageId, INSURANCE_BOOKING_TYPES } from "../services/insuranceService";
import { fetchCurrentUserProfile } from "../services/authService";
import { updateUserProfile } from "../redux/authSlice";
import {
  CHARTER_DAY_WINDOW_END,
  CHARTER_DAY_WINDOW_START,
  createEmptyBoatRequest,
  createEmptyStop,
  deckOptions,
  getCharterDayStartTimeError,
  getMinDepartureDate,
  isCharterDayStartTimeValid,
  normalizeDeckCount,
} from "../utils/charterRequestForm";
import { getCharterInsuranceNote, getInsurancePendingMessage } from "../utils/insurancePreview";
import { AppDateInput } from "./AppDateInput";
import { notify } from "../utils/swalToast";

const deckOptionImages = {
  1: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/15/5b/30/ea/saigon-waterbus-lu-t.jpg?w=1200&h=-1&s=1",
  2: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNjBezqsnPRbARMzFhnjKsf9iQcLUnZLV9CEBL1zV7w6uOrEm6V33a2Oo&s=10",
};

const getStationId = (station) => String(station.stationId || station.id);
const getStationName = (station) => station.stationName || station.name || "--";
const isActiveStation = (station) => {
  const status = String(station?.status || "Active").toLowerCase();
  return status === "active";
};

const filterActiveStations = (stationList) =>
  (Array.isArray(stationList) ? stationList : []).filter(isActiveStation);

const filterWaterbusStations = (stationList) =>
  filterActiveStations(stationList).filter((station) => station?.isWaterbusStation === true);

function CharterStationSelect({
  value,
  stations,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  required = false,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  const selectedStation = stations.find((station) => getStationId(station) === String(value));
  const selectedLabel = selectedStation ? getStationName(selectedStation) : "";
  const normalizedSearch = search.trim().toLowerCase();
  const filteredStations = normalizedSearch
    ? stations.filter((station) => getStationName(station).toLowerCase().includes(normalizedSearch))
    : stations;

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch("");
  };

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  const triggerClass = `flex w-full items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm font-bold outline-none transition-all dark:bg-slate-900 ${disabled
      ? "cursor-not-allowed opacity-55"
      : isOpen
        ? "border-[#FFD100] ring-2 ring-[#FFD100] dark:border-yellow-400 dark:ring-yellow-400"
        : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
    }`;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeDropdown();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeDropdown();
      }}
    >
      {required ? (
        <input
          type="text"
          value={value || ""}
          readOnly
          required
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`min-w-0 truncate ${selectedLabel ? "text-slate-800 dark:text-white" : "text-slate-400"}`}>
          {selectedLabel || placeholder}
        </span>
        <span className={`material-symbols-outlined shrink-0 text-xl text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#FFD100] focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-yellow-400 dark:focus:ring-yellow-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5" role="listbox">
            {filteredStations.length > 0 ? filteredStations.map((station) => {
              const stationId = getStationId(station);
              const isSelected = stationId === String(value);
              return (
                <button
                  key={stationId}
                  type="button"
                  onClick={() => {
                    onChange(stationId);
                    closeDropdown();
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors ${isSelected
                      ? "bg-yellow-50 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  {getStationName(station)}
                </button>
              );
            }) : (
              <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const STYLES = {
  formBg: "bg-[#124757] dark:bg-slate-800",
  formBorder: "border-white/10 dark:border-slate-700/50",
  headerBorder: "border-white/10 dark:border-slate-700",
  headerBg: "bg-linear-to-b from-white/5 to-transparent dark:from-slate-900/40",
  badgeText: "text-yellow-400",
  headerTitle: "text-white dark:text-yellow-400",
  headerSubtitle: "text-white/70 dark:text-slate-400",
  stepPendingBg: "bg-white/10 dark:bg-slate-900 text-white/50 dark:text-slate-400 border border-white/15 dark:border-slate-700",
  stepActiveBg: "bg-white dark:bg-yellow-400 text-[#124757] dark:text-slate-900",
  stepLabelActive: "text-white dark:text-yellow-400",
  stepLabelDone: "text-emerald-300 dark:text-emerald-400",
  stepLabelPending: "text-white/40 dark:text-slate-400",
  stepConnector: "bg-white/15 dark:bg-slate-700",
  progressTrack: "bg-white/10 dark:bg-slate-900",
  sectionTitle: "text-white",
  sectionSubtitle: "text-white/70 dark:text-slate-400",
  label: "text-white/70 dark:text-slate-400",
  errorText: "text-rose-200 dark:text-rose-300",
  accountInfoIdle: "bg-white/5 dark:bg-slate-900 border-white/20 dark:border-slate-700 text-white/80 dark:text-yellow-400 hover:bg-white/10",
  footerBorder: "border-white/10 dark:border-slate-700",
  backButton: "border-white/20 dark:border-slate-700 bg-white/10 hover:bg-white/20 dark:bg-slate-900 text-white dark:text-slate-300",
  primaryButton: "bg-white dark:bg-yellow-400 text-[#124757] dark:text-slate-900 hover:bg-slate-100 dark:hover:bg-yellow-300 disabled:hover:bg-white dark:disabled:hover:bg-yellow-400",
};

export function CharterRequestForm({
  lang,
  mode = "create",
  idPrefix = "charter",
  initialFormData,
  isAuthenticated = true,
  onUnauthenticated,
  bookingCode = "",
  onSubmit,
}) {
  const dispatch = useDispatch();
  const t = STYLES;

  const [stations, setStations] = useState([]);
  const [insurancePackages, setInsurancePackages] = useState([]);
  const [selectedInsurancePackageId, setSelectedInsurancePackageId] = useState(
    initialFormData?.insuranceSelected === false ? null : (initialFormData?.insurancePackageId ?? null)
  );
  const [isInsuranceDetailsOpen, setIsInsuranceDetailsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [useAccountInfo, setUseAccountInfo] = useState(false);
  const [accountInfoApplied, setAccountInfoApplied] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState(initialFormData);
  const submitInFlightRef = useRef(false);
  const lastInsurancePackageIdRef = useRef(null);

  const loadStations = useCallback(async () => {
    try {
      const stationData = await fetchAllStations();
      setStations(filterActiveStations(stationData));
    } catch (error) {
      console.error("Lỗi tải danh sách bến:", error);
    }
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  useEffect(() => {
    let isMounted = true;
    fetchActiveInsurancePackages(INSURANCE_BOOKING_TYPES.PASSENGER)
      .then((packages) => {
        if (!isMounted) return;
        setInsurancePackages(packages);
        setSelectedInsurancePackageId((currentId) => {
          const preferredId = initialFormData?.insuranceSelected === false
            ? null
            : (initialFormData?.insurancePackageId ?? currentId);
          if (preferredId && packages.some((pkg) => isSameInsurancePackageId(getInsurancePackageId(pkg), preferredId))) {
            lastInsurancePackageIdRef.current = String(preferredId);
            return String(preferredId);
          }
          if (initialFormData?.insuranceSelected === false) return null;
          if (currentId && packages.some((pkg) => isSameInsurancePackageId(getInsurancePackageId(pkg), currentId))) {
            lastInsurancePackageIdRef.current = String(currentId);
            return String(currentId);
          }
          const defaultId = getInsurancePackageId(packages[0]);
          lastInsurancePackageIdRef.current = defaultId;
          return defaultId;
        });
      })
      .catch((error) => {
        console.error("Lỗi tải gói bảo hiểm:", error);
      });
    return () => {
      isMounted = false;
    };
  }, [initialFormData?.insurancePackageId, initialFormData?.insuranceSelected]);

  const contactInputClass = `w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400`;
  const contactLabelClass = `flex min-h-4 items-center text-[10px] font-headline font-black uppercase tracking-wider ${t.label}`;
  const contactErrorTextClass = `text-[11px] font-bold ${t.errorText}`;
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
  const getContactFieldErrors = (data = formData) => {
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
      document.getElementById(`${idPrefix}-${field}`)?.focus();
    }, 0);
  };

  const steps = [
    { titleVn: "Thông tin khách hàng", titleEn: "Customer Information", icon: "person" },
    { titleVn: "Lịch trình", titleEn: "Schedule", icon: "event" },
    { titleVn: "Lộ trình & hành khách", titleEn: "Route & Guests", icon: "route" },
    { titleVn: "Ghi chú", titleEn: "Notes", icon: "notes" },
  ];
  const isLastStep = currentStep === steps.length - 1;

  const waterbusStations = useMemo(
    () => filterWaterbusStations(stations),
    [stations],
  );

  const sameStationWithoutStopMessage = useMemo(() => {
    if (!formData.fromStationId || !formData.toStationId) return "";
    if (String(formData.fromStationId) !== String(formData.toStationId)) return "";
    const hasStopStation = formData.itineraryStops.some((stop) => Boolean(stop.stationId));
    if (hasStopStation) return "";
    return lang === "VN"
      ? "Bến đón khách và bến trả khách đang trùng nhau. Vui lòng chọn lại, hoặc thêm ít nhất 1 bến dừng."
      : "Pickup and drop-off are the same. Please choose again, or add at least 1 stop.";
  }, [formData.fromStationId, formData.toStationId, formData.itineraryStops, lang]);

  const roundTripHintMessage = useMemo(() => {
    if (!formData.fromStationId || !formData.toStationId) return "";
    if (String(formData.fromStationId) !== String(formData.toStationId)) return "";
    const hasStopStation = formData.itineraryStops.some((stop) => Boolean(stop.stationId));
    if (!hasStopStation) return "";
    return lang === "VN"
      ? "Lộ trình khứ hồi: bến đón và bến trả trùng nhau là hợp lệ vì đã có điểm dừng."
      : "Round-trip: same pickup and drop-off is valid because stops were added.";
  }, [formData.fromStationId, formData.toStationId, formData.itineraryStops, lang]);

  const validateCustomerStep = () => {
    const errors = getContactFieldErrors();
    const firstErrorField = Object.keys(errors)[0];

    setFieldErrors(errors);
    if (firstErrorField) return { text: getContactValidationText(errors), field: firstErrorField };

    return null;
  };

  const validateScheduleStep = () => {
    const minDepartureDate = getMinDepartureDate();

    if (!formData.departureDate) {
      return lang === "VN" ? "Vui lòng chọn ngày khởi hành." : "Please choose a departure date.";
    }
    if (formData.departureDate < minDepartureDate) {
      return lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.";
    }
    if (!formData.startTime) {
      return lang === "VN" ? "Vui lòng chọn giờ đi." : "Please choose a start time.";
    }
    const startTimeError = getCharterDayStartTimeError(formData.startTime, lang);
    if (startTimeError) return startTimeError;
    return null;
  };

  const validateRouteStep = () => {
    const adultCount = Number(formData.adultCount);
    const childCount = Number(formData.childCount);
    const totalPassengerCount = adultCount + childCount;

    if (!formData.fromStationId || !formData.toStationId) {
      return lang === "VN" ? "Bạn cần chọn cả bến đón khách và bến trả khách trước khi tiếp tục." : "Select both pickup and drop-off stations before continuing.";
    }
    if (String(formData.fromStationId) === String(formData.toStationId)) {
      const hasStopStation = formData.itineraryStops.some((stop) => Boolean(stop.stationId));
      if (!hasStopStation) {
        return lang === "VN"
          ? "Bến đón khách và bến trả khách trùng nhau. Vui lòng chọn lại, hoặc thêm ít nhất 1 bến dừng."
          : "Pickup and drop-off are the same. Please choose again, or add at least 1 stop.";
      }
    }
    if (!Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0 || adultCount > 1000 || childCount > 1000 || totalPassengerCount <= 0 || totalPassengerCount > 1000) {
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
      return lang === "VN" ? "Tối đa 50 bến dừng; mỗi điểm cần có bến dừng, thứ tự và thời gian dừng không âm." : "Maximum 50 stops; each stop needs a station, non-negative order, and non-negative stay minutes.";
    }
    if (formData.requestedBoats.length < 1 || formData.requestedBoats.length > 20 || formData.requestedBoats.some((boat) => !deckOptions.includes(Number(boat.numberOfDecks)))) {
      return lang === "VN" ? "Cần ít nhất 1 tàu, tối đa 20 tàu, mỗi tàu chọn 1 tầng hoặc 2 tầng." : "Please request 1-20 boats, each with 1 or 2 decks.";
    }
    return null;
  };

  const stepValidators = [validateCustomerStep, validateScheduleStep, validateRouteStep, () => null];
  const hasRequiredCustomerInfo = Boolean(
    formData.customerName.trim()
    && formData.contactPhone.trim()
    && formData.contactEmail.trim()
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
      notify({
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
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "rentalUnit" && !isCharterDayStartTimeValid(prev.startTime)) {
        next.startTime = CHARTER_DAY_WINDOW_START;
      }
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
      notify({
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
          ? { ...boat, numberOfDecks: deckCount }
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

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (!isLastStep) {
      handleNextStep();
      return;
    }

    if (!isAuthenticated) {
      onUnauthenticated?.();
      return;
    }

    const adultCount = Number(formData.adultCount);
    const childCount = Number(formData.childCount);
    const totalPassengerCount = adultCount + childCount;
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

    if (!formData.departureDate) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Ngày khởi hành chưa hợp lệ" : "Invalid departure date",
        text: lang === "VN" ? "Vui lòng chọn ngày khởi hành." : "Please choose a departure date.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.departureDate < minDepartureDate) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Ngày khởi hành chưa hợp lệ" : "Invalid departure date",
        text: lang === "VN" ? "Ngày khởi hành cần cách hiện tại ít nhất 7 ngày." : "Departure date must be at least 7 days from today.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!formData.startTime) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giờ đi chưa hợp lệ" : "Invalid start time",
        text: lang === "VN" ? "Vui lòng chọn giờ đi." : "Please choose a start time.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const startTimeError = getCharterDayStartTimeError(formData.startTime, lang);
    if (startTimeError) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Giờ đi chưa hợp lệ" : "Invalid start time",
        text: startTimeError,
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0 || adultCount > 1000 || childCount > 1000 || totalPassengerCount <= 0 || totalPassengerCount > 1000) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Số lượng hành khách chưa hợp lệ" : "Invalid passenger count",
        text: lang === "VN" ? "Người lớn và trẻ em từ 0 đến 1000, tổng hành khách phải lớn hơn 0 và không quá 1000." : "Adults and children must be 0-1000, and total passengers must be greater than 0 and no more than 1000.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (!formData.fromStationId || !formData.toStationId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Vui lòng chọn bến" : "Stations are required",
        text: lang === "VN" ? "Bạn cần chọn cả bến đón khách và bến trả khách trước khi tiếp tục." : "Select both pickup and drop-off stations before continuing.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (String(formData.fromStationId) === String(formData.toStationId)) {
      const hasStopStation = formData.itineraryStops.some((stop) => Boolean(stop.stationId));
      if (!hasStopStation) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Lộ trình chưa hợp lệ" : "Invalid route",
          text: lang === "VN"
            ? "Bến đón khách và bến trả khách trùng nhau. Vui lòng chọn lại, hoặc thêm ít nhất 1 bến dừng."
            : "Pickup and drop-off are the same. Please choose again, or add at least 1 stop.",
          confirmButtonColor: "#124757",
        });
        return;
      }
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
      notify({
        icon: "warning",
        title: lang === "VN" ? "Bến dừng chưa hợp lệ" : "Invalid stop stations",
        text: lang === "VN" ? "Tối đa 50 bến dừng; mỗi điểm cần có bến dừng, thứ tự và thời gian dừng không âm." : "Maximum 50 stops; each stop needs a station, non-negative order, and non-negative stay minutes.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.requestedBoats.length < 1 || formData.requestedBoats.length > 20 || formData.requestedBoats.some((boat) => !deckOptions.includes(Number(boat.numberOfDecks)))) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Danh sách tàu chưa hợp lệ" : "Invalid requested boats",
        text: lang === "VN" ? "Cần ít nhất 1 tàu, tối đa 20 tàu, mỗi tàu chọn 1 tầng hoặc 2 tầng." : "Please request 1-20 boats, each with 1 or 2 decks.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    if (formData.specialRequests.length > 1000) {
      notify({
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
        };
      }),
      preferredNumberOfDecks: normalizeDeckCount(formData.requestedBoats[0]?.numberOfDecks),
      specialRequests: formData.specialRequests || null,
      rentalUnit: formData.rentalUnit === "Day" ? "Day" : "Hour",
      insuranceSelected: Boolean(selectedInsurancePackageId),
      insurancePackageId: selectedInsurancePackageId || null,
    };

    if (isSubmitting || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await onSubmit?.(payload);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleFormSubmit} className={`relative rounded-4xl shadow-[0_25px_70px_rgba(18,71,87,0.10)] border overflow-hidden ${t.formBg} ${t.formBorder}`}>
      <div className={`p-8 md:p-10 border-b space-y-6 text-center ${t.headerBorder} ${t.headerBg}`}>
        <div className="space-y-2">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/20 text-[10px] font-headline font-black uppercase tracking-widest ${t.badgeText}`}>
            {lang === "VN" ? `Bước ${currentStep + 1}/${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`}
          </span>
          <h2 className={`text-2xl md:text-3xl font-headline font-black ${t.headerTitle}`}>
            {mode === "edit"
              ? (lang === "VN" ? "Chỉnh sửa yêu cầu thuê tàu" : "Edit Booking Request")
              : (lang === "VN" ? "Tạo yêu cầu thuê tàu" : "Create Booking Request")}
          </h2>
          <p className={`text-xs max-w-md mx-auto ${t.headerSubtitle}`}>
            {mode === "edit" && bookingCode && bookingCode !== "--"
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
                    ? t.stepActiveBg
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : t.stepPendingBg
                    }`}>
                    {isDone ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
                  </span>
                  <span className={`hidden sm:inline text-[11px] font-headline font-black uppercase tracking-wider whitespace-nowrap ${isActive
                    ? t.stepLabelActive
                    : isDone
                      ? t.stepLabelDone
                      : t.stepLabelPending
                    }`}>
                    {lang === "VN" ? step.titleVn : step.titleEn}
                  </span>
                </button>
                {index < steps.length - 1 && <span className={`w-4 sm:w-10 h-px ${t.stepConnector}`}></span>}
              </div>
            );
          })}
        </div>

        <div className={`max-w-md mx-auto h-1.5 rounded-full overflow-hidden ${t.progressTrack}`}>
          <div
            className="h-full rounded-full bg-[#FFD100] transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="p-6 md:p-10 space-y-7">
        {!isAuthenticated && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3">
            <span className="material-symbols-outlined text-xl">lock</span>
            {lang === "VN" ? "Bạn cần đăng nhập trước khi gửi yêu cầu thuê tàu." : "You need to sign in before submitting a booking request."}
          </div>
        )}
        {/* STEP 1: Thông tin khách hàng */}
        {currentStep === 0 && (
          <section className="space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center gap-3">
              <div>
                <h3 className={`font-headline font-black text-lg ${t.sectionTitle}`}>{lang === "VN" ? "Thông tin khách hàng" : "Customer Information"}</h3>
                <p className={`text-xs mt-1 max-w-sm mx-auto ${t.sectionSubtitle}`}>{lang === "VN" ? "Cho chúng tôi biết ai là người liên hệ chính của yêu cầu này." : "Tell us who the main contact for this request is."}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2.5">
                <label className={contactLabelClass}>{lang === "VN" ? "Họ tên người đặt" : "Contact Name"}{requiredMark}</label>
                <input id={`${idPrefix}-customerName`} value={formData.customerName} onChange={(e) => handleFieldChange("customerName", e.target.value)} disabled={useAccountInfo} required maxLength={120} className={getContactInputClass("customerName")} placeholder={lang === "VN" ? "Nhập họ tên" : "Full name"} aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? `${idPrefix}-customerName-error` : undefined} />
                {fieldErrors.customerName && <p id={`${idPrefix}-customerName-error`} className={contactErrorTextClass}>{fieldErrors.customerName}</p>}
              </div>
              <div className="flex flex-col gap-2.5">
                <label className={contactLabelClass}>{lang === "VN" ? "Số điện thoại" : "Phone Number"}{requiredMark}</label>
                <input id={`${idPrefix}-contactPhone`} value={formData.contactPhone} onChange={(e) => handleFieldChange("contactPhone", e.target.value)} disabled={useAccountInfo} required maxLength={30} className={getContactInputClass("contactPhone")} placeholder={lang === "VN" ? "Nhập số điện thoại" : "Phone number"} aria-invalid={Boolean(fieldErrors.contactPhone)} aria-describedby={fieldErrors.contactPhone ? `${idPrefix}-contactPhone-error` : undefined} />
                {fieldErrors.contactPhone && <p id={`${idPrefix}-contactPhone-error`} className={contactErrorTextClass}>{fieldErrors.contactPhone}</p>}
              </div>
              <div className="flex flex-col gap-2.5">
                <label className={contactLabelClass}>Email{requiredMark}</label>
                <input id={`${idPrefix}-contactEmail`} type="email" value={formData.contactEmail} onChange={(e) => handleFieldChange("contactEmail", e.target.value)} disabled={useAccountInfo} required maxLength={160} className={getContactInputClass("contactEmail")} placeholder="email@example.com" aria-invalid={Boolean(fieldErrors.contactEmail)} aria-describedby={fieldErrors.contactEmail ? `${idPrefix}-contactEmail-error` : undefined} />
                {fieldErrors.contactEmail && <p id={`${idPrefix}-contactEmail-error`} className={contactErrorTextClass}>{fieldErrors.contactEmail}</p>}
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleAccountInfoToggle}
                disabled={isLoadingProfile}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition-all disabled:opacity-50 ${accountInfoApplied
                  ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900 dark:border-yellow-400"
                  : t.accountInfoIdle
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
        {/* STEP 2: Lịch trình */}
        {currentStep === 1 && (
          <section className="space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center gap-3">
              <div>
                <h3 className={`font-headline font-black text-lg ${t.sectionTitle}`}>{lang === "VN" ? "Lịch trình" : "Schedule"}</h3>
                <p className={`text-xs mt-1 max-w-sm mx-auto ${t.sectionSubtitle}`}>{lang === "VN" ? "Chọn ngày và giờ bạn muốn khởi hành." : "Choose when you'd like to depart."}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2.5">
                <label className={contactLabelClass}>{lang === "VN" ? "Ngày khởi hành" : "Departure Date"}{requiredMark}</label>
                <AppDateInput
                  min={getMinDepartureDate()}
                  value={formData.departureDate}
                  onChange={(e) => handleFieldChange("departureDate", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <label className={contactLabelClass}>{lang === "VN" ? "Giờ đi" : "Start Time"}{requiredMark}</label>
                <input
                  type="time"
                  value={formData.startTime}
                  min={CHARTER_DAY_WINDOW_START}
                  max={CHARTER_DAY_WINDOW_END}
                  onChange={(e) => handleFieldChange("startTime", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className={contactLabelClass}>{lang === "VN" ? "Hình thức thuê" : "Rental type"}{requiredMark}</label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                {[
                  { id: "Hour", labelVn: "Theo giờ", labelEn: "Hourly" },
                  { id: "Day", labelVn: "Theo ngày", labelEn: "Daily" },
                ].map((option) => {
                  const active = (formData.rentalUnit === "Day" ? "Day" : "Hour") === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleFieldChange("rentalUnit", option.id)}
                      className={`rounded-xl px-3 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${
                        active
                          ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                          : "bg-transparent text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {lang === "VN" ? option.labelVn : option.labelEn}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] font-medium leading-relaxed text-slate-400">
                {formData.rentalUnit === "Day"
                  ? (lang === "VN"
                    ? `Giờ đi từ ${CHARTER_DAY_WINDOW_START} đến ${CHARTER_DAY_WINDOW_END}. Thuê 1 ngày kết thúc ${CHARTER_DAY_WINDOW_END} cùng ngày; 2 ngày kết thúc ${CHARTER_DAY_WINDOW_END} ngày hôm sau.`
                    : `Start time is from ${CHARTER_DAY_WINDOW_START} to ${CHARTER_DAY_WINDOW_END}. A 1-day rental ends at ${CHARTER_DAY_WINDOW_END} the same day; 2 days ends at ${CHARTER_DAY_WINDOW_END} the next day.`)
                  : (lang === "VN"
                    ? `Giờ đi từ ${CHARTER_DAY_WINDOW_START} đến ${CHARTER_DAY_WINDOW_END}. Số giờ tính tiền do hệ thống ước tính từ lộ trình.`
                    : `Start time is from ${CHARTER_DAY_WINDOW_START} to ${CHARTER_DAY_WINDOW_END}. Chargeable duration is calculated from the route.`)}
              </p>
            </div>
          </section>
        )}

        {/* STEP 3: Lộ trình và hành khách */}
        {currentStep === 2 && (
          <section className="space-y-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div>
                <h3 className={`font-headline font-black text-lg ${t.sectionTitle}`}>{lang === "VN" ? "Lộ trình & hành khách" : "Route & Guests"}</h3>
                <p className={`text-xs mt-1 max-w-sm mx-auto ${t.sectionSubtitle}`}>
                  {lang === "VN"
                    ? "Bến đón khách phải thuộc hệ thống Waterbus. Bến trả khách và bến dừng có thể chọn bến khác."
                    : "Pickup must be a Waterbus station. Drop-off and stops can be any active station."}
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={contactLabelClass}>{lang === "VN" ? "Bến đón khách" : "Pickup Station"}{requiredMark}</label>
                <CharterStationSelect
                  value={formData.fromStationId}
                  stations={waterbusStations}
                  onChange={(nextValue) => handleFieldChange("fromStationId", nextValue)}
                  placeholder={lang === "VN" ? "Chọn bến đón khách" : "Select pickup station"}
                  searchPlaceholder={lang === "VN" ? "Tìm bến đón khách..." : "Search pickup station..."}
                  emptyMessage={lang === "VN" ? "Không tìm thấy bến đón khách" : "No pickup stations found"}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className={contactLabelClass}>{lang === "VN" ? "Bến trả khách" : "Drop-off Station"}{requiredMark}</label>
                <CharterStationSelect
                  value={formData.toStationId}
                  stations={stations}
                  onChange={(nextValue) => handleFieldChange("toStationId", nextValue)}
                  placeholder={lang === "VN" ? "Chọn bến trả khách" : "Select drop-off station"}
                  searchPlaceholder={lang === "VN" ? "Tìm bến trả khách..." : "Search drop-off station..."}
                  emptyMessage={lang === "VN" ? "Không tìm thấy bến trả khách" : "No drop-off stations found"}
                  required
                />
              </div>
            </div>
            {sameStationWithoutStopMessage ? (
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-300 -mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
                {sameStationWithoutStopMessage}
              </p>
            ) : null}
            {roundTripHintMessage ? (
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 -mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                {roundTripHintMessage}
              </p>
            ) : null}

            <div className="space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến dừng" : "Stop Stations"}</label>
                  <p className="text-[11px] text-slate-400 mt-1">{lang === "VN" ? "Có thể bỏ trống nếu không có bến dừng." : "Leave empty if there are no stops."}</p>
                </div>
                <button type="button" onClick={handleAddStop} disabled={formData.itineraryStops.length >= 50} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 disabled:opacity-50">
                  <span className="material-symbols-outlined text-base">add_location_alt</span>
                  {lang === "VN" ? "Thêm bến dừng" : "Add Stop"}
                </button>
              </div>
              {formData.itineraryStops.length > 0 && (
                <div className="space-y-3">
                  {formData.itineraryStops.map((stop, index) => (
                    <div key={`stop-${index}`} className="grid lg:grid-cols-[1.4fr_120px_160px_1fr_auto] gap-3 items-end rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến dừng" : "Stop Station"}</label>
                        <CharterStationSelect
                          value={stop.stationId}
                          stations={stations}
                          onChange={(nextValue) => handleStopChange(index, "stationId", nextValue)}
                          placeholder={lang === "VN" ? "Chọn bến" : "Choose station"}
                          searchPlaceholder={lang === "VN" ? "Tìm bến..." : "Search station..."}
                          emptyMessage={lang === "VN" ? "Không tìm thấy bến" : "No stations found"}
                        />
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

            {/* Lượng ành khách */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={`text-[10px] font-headline font-black uppercase tracking-wider ${t.label}`}>{lang === "VN" ? "Người lớn" : "Adults"}</label>
                <input type="number" min="0" max="1000" value={formData.adultCount} onChange={(e) => handleFieldChange("adultCount", e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
              </div>
              <div className="space-y-2">
                <label className={`text-[10px] font-headline font-black uppercase tracking-wider ${t.label}`}>{lang === "VN" ? "Trẻ em (< 12 tuổi)" : "Children (< 12)"}</label>
                <input type="number" min="0" max="1000" value={formData.childCount} onChange={(e) => handleFieldChange("childCount", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
              </div>
            </div>

            {/* Chọn tàu */}
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
              {/* Danh sách tàu */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <div className="relative h-28 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={deckOptionImages[1]} alt={lang === "VN" ? "1 tầng" : "1 deck"} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-linear-to-t from-slate-950/50 via-transparent to-transparent"></span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3">
                    <span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">directions_boat</span>
                    <div>
                      <p className="text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:text-white">{lang === "VN" ? "1 tầng" : "1 deck"}</p>
                      <p className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Sức chứa tối đa 65-75 khách." : "Max capacity of 65-75 guests."}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <div className="relative h-28 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={deckOptionImages[2]} alt={lang === "VN" ? "2 tầng" : "2 decks"} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-linear-to-t from-slate-950/50 via-transparent to-transparent"></span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3">
                    <span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">directions_boat</span>
                    <div>
                      <p className="text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:text-white">{lang === "VN" ? "2 tầng" : "2 decks"}</p>
                      <p className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Sức chứa tối đa 55-65 khách." : "Max capacity of 55-65 guests."}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Yêu cầu tàu */}
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

            {/* Bảo hiểm hành khách */}
            {insurancePackages.length > 0 && (() => {
              const formatVnd = (value) => (Number(value) || 0).toLocaleString("vi-VN") + "đ";
              const wantsInsurance = selectedInsurancePackageId != null;
              const selectedPackage = wantsInsurance
                ? findInsurancePackageById(insurancePackages, selectedInsurancePackageId)
                : null;
              const unitPremiumLabel = lang === "VN" ? "khách" : "pax";
              const pendingMessage = getInsurancePendingMessage(INSURANCE_BOOKING_TYPES.PASSENGER, lang);
              const insuranceNote = getCharterInsuranceNote(lang);
              const passengerQty = Math.max(
                0,
                (Number(formData.adultCount) || 0) + (Number(formData.childCount) || 0),
              );
              const insurancePreviewTotal = wantsInsurance && selectedPackage
                ? (Number(selectedPackage.unitPremiumAmount) || 0) * passengerQty
                : 0;

              const displayPackage = selectedPackage || insurancePackages[0];
              const providerName = displayPackage?.providerName || "";
              const providerLogoUrl = displayPackage?.providerLogoUrl || "";

              const handleInsuranceToggle = (enabled) => {
                if (enabled) {
                  const restoreId = lastInsurancePackageIdRef.current || getInsurancePackageId(insurancePackages[0]);
                  setSelectedInsurancePackageId(restoreId);
                  return;
                }
                if (selectedInsurancePackageId != null) {
                  lastInsurancePackageIdRef.current = String(selectedInsurancePackageId);
                }
                setSelectedInsurancePackageId(null);
              };

              const handleSelectPackage = (pkg) => {
                const packageId = getInsurancePackageId(pkg);
                lastInsurancePackageIdRef.current = packageId;
                setSelectedInsurancePackageId(packageId);
              };

              const handleShowTerms = () => {
                const pkg = displayPackage;
                if (!pkg) return;

                const escapeHtml = (value) => String(value ?? "")
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;")
                  .replaceAll('"', "&quot;")
                  .replaceAll("'", "&#39;");

                const conditions = (Array.isArray(pkg.conditions) ? pkg.conditions : [])
                  .map((item) => String(item || "").trim())
                  .filter(Boolean);
                const name = pkg.providerName || (lang === "VN" ? "Nhà cung cấp bảo hiểm" : "Insurance provider");
                const safeName = escapeHtml(name);
                const safeLogoUrl = escapeHtml(pkg.providerLogoUrl || "");
                const safeTermsUrl = escapeHtml(pkg.termsUrl || "");
                const logoHtml = pkg.providerLogoUrl
                  ? `<img src="${safeLogoUrl}" alt="${safeName}" style="width:72px;height:72px;object-fit:contain;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;margin:0 auto 12px;" />`
                  : "";
                const conditionsHtml = conditions.length > 0
                  ? `<ul style="text-align:left;margin:12px 0 0;padding-left:18px;color:#64748b;font-size:12px;line-height:1.7;">${conditions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
                  : `<p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">${lang === "VN" ? "Chưa có điều kiện chi tiết trên hệ thống." : "No detailed conditions on file."}</p>`;
                const termsHtml = pkg.termsUrl
                  ? `<a href="${safeTermsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:10px 14px;border-radius:12px;background:#124757;color:#fff;font-weight:800;font-size:12px;text-decoration:none;">${lang === "VN" ? "Mở điều khoản đầy đủ" : "Open full terms"}</a>`
                  : `<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;">${lang === "VN" ? "Chưa có link điều khoản." : "No terms link available."}</p>`;

                notify({
                  dialog: true,
                  title: lang === "VN" ? "Điều khoản bảo hiểm" : "Insurance terms",
                  html: `
                    ${logoHtml}
                    <p style="margin:0;font-weight:800;color:#124757;font-size:15px;">${safeName}</p>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;font-weight:700;">${escapeHtml(pkg.name || "")}</p>
                    <p style="margin:14px 0 0;text-align:left;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">${lang === "VN" ? "Điều kiện áp dụng" : "Applicable conditions"}</p>
                    ${conditionsHtml}
                    ${termsHtml}
                  `,
                  confirmButtonText: lang === "VN" ? "Đóng" : "Close",
                  showCancelButton: false,
                });
              };

              return (
                <div className={`rounded-2xl border overflow-hidden transition-colors ${
                  wantsInsurance
                    ? "bg-white dark:bg-slate-900 border-[#124757]/40 dark:border-yellow-400/40"
                    : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700"
                }`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setIsInsuranceDetailsOpen((open) => !open)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={isInsuranceDetailsOpen}
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
                        providerLogoUrl
                          ? "bg-white p-2 ring-1 ring-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.08)] dark:ring-slate-200"
                          : "bg-gradient-to-br from-[#124757] to-[#0d3541] text-white shadow-[0_4px_14px_rgba(18,71,87,0.28)] dark:from-yellow-400 dark:to-yellow-300 dark:text-slate-900"
                      }`}>
                        {providerLogoUrl ? (
                          <img
                            src={providerLogoUrl}
                            alt={providerName || (lang === "VN" ? "Logo bảo hiểm" : "Insurance logo")}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-xl">verified_user</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                          {lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400 truncate">
                          {providerName
                            ? providerName
                            : (wantsInsurance && selectedPackage
                              ? `${formatVnd(selectedPackage.unitPremiumAmount)}/${unitPremiumLabel}${Number(selectedPackage.coverageAmount) > 0 ? ` · ${lang === "VN" ? "Quyền lợi" : "Coverage"} ${formatVnd(selectedPackage.coverageAmount)}` : ""}`
                              : (lang === "VN" ? "Tùy chọn" : "Optional"))}
                        </p>
                        {providerName && wantsInsurance && selectedPackage ? (
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                            {`${formatVnd(selectedPackage.unitPremiumAmount)}/${unitPremiumLabel}${Number(selectedPackage.coverageAmount) > 0 ? ` · ${lang === "VN" ? "Quyền lợi" : "Coverage"} ${formatVnd(selectedPackage.coverageAmount)}` : ""}`}
                          </p>
                        ) : null}
                      </div>
                      <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isInsuranceDetailsOpen ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShowTerms}
                      title={lang === "VN" ? "Xem điều khoản" : "View terms"}
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:text-[#124757] dark:hover:text-yellow-400 hover:border-[#124757]/40 dark:hover:border-yellow-400/40 flex items-center justify-center shrink-0 transition-colors"
                      aria-label={lang === "VN" ? "Điều khoản bảo hiểm" : "Insurance terms"}
                    >
                      <span className="material-symbols-outlined text-[18px]">info</span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={wantsInsurance}
                      onClick={() => handleInsuranceToggle(!wantsInsurance)}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        wantsInsurance ? "bg-[#124757] dark:bg-yellow-400" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        wantsInsurance ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  {isInsuranceDetailsOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-700/80">
                      {wantsInsurance && insurancePackages.length > 1 && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
                          {insurancePackages.map((pkg) => {
                            const packageId = getInsurancePackageId(pkg);
                            const isSelected = isSameInsurancePackageId(selectedInsurancePackageId, packageId);
                            const unitPremium = Number(pkg.unitPremiumAmount) || 0;

                            return (
                              <button
                                key={packageId}
                                type="button"
                                onClick={() => handleSelectPackage(pkg)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  isSelected
                                    ? "bg-[#124757]/5 dark:bg-yellow-400/5"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                              >
                                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "border-[#124757] dark:border-yellow-400"
                                    : "border-slate-300 dark:border-slate-600"
                                }`}>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-[#124757] dark:bg-yellow-400" />
                                  )}
                                </span>
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                                  pkg.providerLogoUrl
                                    ? "bg-white p-1 ring-1 ring-slate-200/80 shadow-[0_1px_6px_rgba(15,23,42,0.08)] dark:ring-slate-200"
                                    : "bg-[#124757]/10 dark:bg-yellow-400/10"
                                }`}>
                                  {pkg.providerLogoUrl ? (
                                    <img src={pkg.providerLogoUrl} alt="" className="h-full w-full object-contain" />
                                  ) : (
                                    <span className="material-symbols-outlined text-sm text-[#124757] dark:text-yellow-400">shield</span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{pkg.name}</span>
                                  {pkg.providerName ? (
                                    <span className="block text-[10px] font-bold text-slate-400 truncate">{pkg.providerName}</span>
                                  ) : null}
                                </span>
                                <span className={`text-xs font-headline font-black whitespace-nowrap shrink-0 ${
                                  isSelected ? "text-[#124757] dark:text-yellow-400" : "text-slate-400"
                                }`}>
                                  {formatVnd(unitPremium)}/{unitPremiumLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-2.5 px-4 py-3">
                        {wantsInsurance && selectedPackage ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                              <p className="text-[9px] font-headline font-black uppercase tracking-wider text-slate-400">
                                {insuranceNote.unitLabel}
                              </p>
                              <p className="mt-0.5 text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
                                {formatVnd(selectedPackage.unitPremiumAmount)}/{unitPremiumLabel}
                              </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                              <p className="text-[9px] font-headline font-black uppercase tracking-wider text-slate-400">
                                {lang === "VN" ? "Tạm tính" : "Preview"}
                              </p>
                              <p className="mt-0.5 text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
                                {passengerQty > 0
                                  ? `${formatVnd(insurancePreviewTotal)} · ${passengerQty} ${unitPremiumLabel}`
                                  : "--"}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0 text-slate-400">info</span>
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {insuranceNote.title}
                            </p>
                            <p className="text-[10px] leading-relaxed text-slate-400">
                              {insuranceNote.body}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">
                              {pendingMessage}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* Ghi chú */}
        {currentStep === 3 && (
          <section className="space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center gap-3">
              <div>
                <h3 className={`font-headline font-black text-lg ${t.sectionTitle}`}>{lang === "VN" ? "Ghi chú" : "Notes"}</h3>
                <p className={`text-xs mt-1 max-w-sm mx-auto ${t.sectionSubtitle}`}>{lang === "VN" ? "Có thể thêm cầu đặc biệt để chúng tôi phục vụ bạn tốt hơn." : "Add any special requests to help us serve you better."}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold text-slate-400">{String(formData.specialRequests || "").length}/1000</span>
              </div>
              <textarea value={formData.specialRequests} onChange={(e) => handleFieldChange("specialRequests", e.target.value)} maxLength={1000} rows={5} className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#FFD100] focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder={lang === "VN" ? "Ví dụ: cần khu VIP, đón khách lớn tuổi, chuẩn bị nước uống, cần hỗ trợ khi lên tàu..." : "e.g. VIP area, elderly guests, drinks prepared, boarding support needed..."} />
            </div>
          </section>
        )}

        <div className={`flex items-center justify-between gap-4 pt-2 border-t ${t.footerBorder}`}>
          <button
            type="button"
            onClick={handleBackStep}
            disabled={currentStep === 0}
            className={`inline-flex items-center gap-2 rounded-2xl border px-6 py-3.5 font-headline font-black uppercase tracking-widest text-xs disabled:opacity-40 mt-5 ${t.backButton}`}
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Quay lại" : "Back"}
          </button>
          {isLastStep ? (
            <button type="submit" disabled={isSubmitting} className={`w-full sm:w-auto min-w-56 font-headline font-black uppercase tracking-widest text-xs rounded-2xl px-8 py-4 transition-all disabled:opacity-60 mt-5 ${t.primaryButton}`}>
              {isSubmitting
                ? (mode === "edit" ? (lang === "VN" ? "Đang lưu..." : "Saving...") : (lang === "VN" ? "Đang gửi..." : "Submitting..."))
                : (mode === "edit" ? (lang === "VN" ? "Lưu thay đổi" : "Save Changes") : (lang === "VN" ? "Gửi yêu cầu" : "Submit"))}
            </button>
          ) : (
            <button type="submit" disabled={!canContinueToNext} className={`inline-flex items-center gap-2 w-full sm:w-auto min-w-56 justify-center font-headline font-black uppercase tracking-widest text-xs rounded-2xl px-8 py-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-5 ${t.primaryButton}`}>
              {lang === "VN" ? "Tiếp theo" : "Next"}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
