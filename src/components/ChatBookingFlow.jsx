import { useEffect, useMemo, useState } from "react";
import { fetchAllStations } from "../services/stationService";
import { fetchTripSearch, fetchTripSeatMap, holdSeats } from "../services/tripService";
import { previewBooking, submitBooking } from "../services/bookingService";
import { createBookingPayment } from "../services/paymentService";
import { getApiErrorMessage } from "../utils/apiError";
import { getTodayDateString } from "../utils/dateOnly";

const STAGES = ["CollectingInfo", "SelectingTrip", "SelectingSeats", "EnteringPassengers", "AwaitingConfirmation"];
const EMPTY_DRAFT = {
  stage: "CollectingInfo",
  isRoundTrip: false,
  departureDate: getTodayDateString(),
  returnDate: "",
  fromStationId: "",
  toStationId: "",
  fromStationCode: "",
  toStationCode: "",
  fromStationName: "",
  toStationName: "",
  adultCount: 1,
  childCount: 0,
  infantCount: 0,
  departureTrips: [],
  returnTrips: [],
  selectedDepartureTrip: null,
  selectedReturnTrip: null,
  selectedSeatsDeparture: [],
  selectedSeatsReturn: [],
  passengers: [],
  contact: { name: "", phone: "", email: "" },
  insuranceSelected: false,
  promotionCode: "",
  holdExpiresAt: null,
  preview: null,
};

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const unwrapList = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const stationValue = (station, kind) => {
  if (kind === "id") return String(pick(station, ["stationId", "id", "StationId"], ""));
  if (kind === "name") return String(pick(station, ["stationName", "name", "Name"], ""));
  return String(pick(station, ["stationCode", "code", "Code"], ""));
};

const tripLabel = (trip) => String(pick(trip, ["tripCode", "TripCode", "code", "id", "tripId"], ""));
const tripTime = (trip, arrival = false) => pick(
  trip,
  arrival
    ? ["toStopScheduledArrival", "arrivalTime", "scheduledArrivalAt", "endAt"]
    : ["fromStopScheduledDeparture", "departureTime", "scheduledDepartureAt", "startAt"],
  "",
);
const tripId = (trip) => String(pick(trip, ["tripId", "id", "TripId"], ""));

const normalizeSeat = (seat) => ({
  ...seat,
  seatNumber: String(pick(seat, ["seatNumber", "number", "code", "SeatNumber"], "")),
  status: String(pick(seat, ["status", "seatStatus", "Status"], "Available")),
  deck: Number(pick(seat, ["deck", "Deck"], 1)) || 1,
  row: String(pick(seat, ["row", "Row"], "")),
  column: Number(pick(seat, ["column", "Column"], 0)) || 0,
  price: Number(pick(seat, ["basePrice", "price", "BasePrice"], 0)) || 0,
});

const seatAvailable = (seat) => {
  const status = String(seat.status || "").toLowerCase();
  return status === "available" || status === "free" || status === "heldbyme" || status === "held_by_me";
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const buildPassengerRows = (draft) => {
  const existing = Array.isArray(draft.passengers) ? draft.passengers : [];
  const rows = [];
  for (let i = 0; i < Number(draft.adultCount || 0); i += 1) {
    rows.push({ type: "ADULT", seatIndex: i, name: existing[i]?.name || "", birthYear: existing[i]?.birthYear || "", companionIndex: "" });
  }
  for (let i = 0; i < Number(draft.childCount || 0); i += 1) {
    const index = Number(draft.adultCount || 0) + i;
    rows.push({ type: "CHILD", seatIndex: index, name: existing[index]?.name || "", birthYear: existing[index]?.birthYear || "", companionIndex: "" });
  }
  for (let i = 0; i < Number(draft.infantCount || 0); i += 1) {
    const index = Number(draft.adultCount || 0) + Number(draft.childCount || 0) + i;
    rows.push({ type: "INFANT", seatIndex: null, name: existing[index]?.name || "", birthYear: existing[index]?.birthYear || "", companionIndex: existing[index]?.companionIndex ?? "" });
  }
  return rows;
};

const ChatBookingFlow = ({
  lang = "VN",
  initialDraft,
  isAuthenticated,
  user,
  onRequireLogin,
  onDraftChange,
  onDone,
}) => {
  const vn = lang !== "ENG";
  const [draft, setDraft] = useState(() => {
    try {
      const saved = window.localStorage.getItem("waterbus.chat.bookingDraft");
      return { ...EMPTY_DRAFT, ...(saved ? JSON.parse(saved) : {}), ...(initialDraft || {}) };
    } catch {
      return { ...EMPTY_DRAFT, ...(initialDraft || {}) };
    }
  });
  const [stations, setStations] = useState([]);
  const [seatMap, setSeatMap] = useState([]);
  const [seatLeg, setSeatLeg] = useState("departure");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [holdSeconds, setHoldSeconds] = useState(null);

  useEffect(() => {
    fetchAllStations().then((items) => setStations((items || []).filter((s) => String(s.status || "Active").toLowerCase() !== "inactive"))).catch(() => setError(vn ? "Không tải được danh sách bến." : "Unable to load stations."));
  }, [vn]);

  useEffect(() => {
    if (!initialDraft) return;
    setDraft((current) => ({ ...current, ...initialDraft, contact: { ...current.contact, ...(initialDraft.contact || {}) } }));
  }, [initialDraft]);

  useEffect(() => {
    if (!user) return;
    setDraft((current) => {
      if (current.contact.name || current.contact.phone || current.contact.email) return current;
      return {
        ...current,
        contact: {
          name: String(pick(user, ["fullName", "name", "userName"], "")),
          phone: String(pick(user, ["phoneNumber", "phone", "mobile"], "")),
          email: String(pick(user, ["email", "Email"], "")),
        },
      };
    });
  }, [user]);

  useEffect(() => {
    try {
      if (draft.stage === "Completed") window.localStorage.removeItem("waterbus.chat.bookingDraft");
      else window.localStorage.setItem("waterbus.chat.bookingDraft", JSON.stringify(draft));
    } catch {
      // Local persistence is a convenience; server conversation persistence remains authoritative.
    }
    const timer = window.setTimeout(() => onDraftChange?.(draft), 250);
    return () => window.clearTimeout(timer);
  }, [draft, onDraftChange]);

  useEffect(() => {
    if (!draft.holdExpiresAt) return undefined;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(draft.holdExpiresAt).getTime() - Date.now()) / 1000));
      setHoldSeconds(remaining);
      if (remaining === 0) {
        setDraft((current) => ({ ...current, holdExpiresAt: null, selectedSeatsDeparture: [], selectedSeatsReturn: [], stage: "SelectingSeats" }));
        setError(vn ? "Thời gian giữ ghế đã hết. Vui lòng chọn lại ghế." : "The seat hold expired. Please select seats again.");
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [draft.holdExpiresAt, vn]);

  const stationOptions = useMemo(() => stations.map((s) => ({ id: stationValue(s, "id"), code: stationValue(s, "code"), name: stationValue(s, "name") })).filter((s) => s.id && s.name), [stations]);
  const selectedSeats = seatLeg === "departure" ? draft.selectedSeatsDeparture : draft.selectedSeatsReturn;
  const requiredSeatCount = Number(draft.adultCount || 0) + Number(draft.childCount || 0);
  const passengerRows = useMemo(() => buildPassengerRows(draft), [draft]);
  const currentStage = Math.max(0, STAGES.indexOf(draft.stage || "CollectingInfo"));
  const receivedFields = [
    draft.departureDate && (vn ? "Ngày đi" : "Departure date"),
    draft.fromStationName && draft.toStationName && (vn ? "Bến đi/đến" : "Stations"),
    (Number(draft.adultCount || 0) + Number(draft.childCount || 0) + Number(draft.infantCount || 0)) > 0 && (vn ? "Số hành khách" : "Passenger count"),
  ].filter(Boolean);
  const missingFields = [
    !draft.departureDate && (vn ? "Ngày đi" : "Departure date"),
    (!draft.fromStationId || !draft.toStationId) && (vn ? "Bến đi/đến" : "Stations"),
  ].filter(Boolean);

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const selectStation = (field, value) => {
    const station = stationOptions.find((item) => item.id === value);
    const prefix = field === "from" ? "fromStation" : "toStation";
    update({ [`${prefix}Id`]: value, [`${prefix}Code`]: station?.code || "", [`${prefix}Name`]: station?.name || "" });
  };

  const searchTrips = async () => {
    setError("");
    if (!draft.fromStationId || !draft.toStationId || !draft.departureDate) {
      setError(vn ? "Vui lòng chọn ngày đi, bến đi và bến đến." : "Choose a date, departure station and arrival station.");
      return;
    }
    if (draft.fromStationId === draft.toStationId) {
      setError(vn ? "Bến đi và bến đến phải khác nhau." : "Departure and arrival stations must be different.");
      return;
    }
    if (Number(draft.adultCount || 0) + Number(draft.childCount || 0) + Number(draft.infantCount || 0) > 10) {
      setError(vn ? "Mỗi booking tối đa 10 hành khách." : "A booking can contain at most 10 passengers.");
      return;
    }
    if (draft.isRoundTrip && !draft.returnDate) {
      setError(vn ? "Vui lòng chọn ngày về." : "Choose a return date.");
      return;
    }
    setLoading(true);
    try {
      const outbound = await fetchTripSearch({ fromStationId: draft.fromStationId, toStationId: draft.toStationId, departureDate: draft.departureDate });
      const returns = draft.isRoundTrip
        ? await fetchTripSearch({ fromStationId: draft.toStationId, toStationId: draft.fromStationId, departureDate: draft.returnDate })
        : [];
      if (!outbound.length || (draft.isRoundTrip && !returns.length)) {
        setError(vn ? "Không tìm thấy chuyến phù hợp với thông tin đã chọn." : "No matching trips were found.");
        return;
      }
      update({ departureTrips: outbound, returnTrips: returns, selectedDepartureTrip: null, selectedReturnTrip: null, selectedSeatsDeparture: [], selectedSeatsReturn: [], stage: "SelectingTrip" });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, vn ? "Không thể tìm chuyến." : "Unable to search trips."));
    } finally {
      setLoading(false);
    }
  };

  const chooseTrip = (leg, trip) => {
    if (leg === "departure") {
      update({ selectedDepartureTrip: trip, selectedSeatsDeparture: [], stage: draft.isRoundTrip ? "SelectingTrip" : "SelectingSeats" });
      if (!draft.isRoundTrip) setSeatLeg("departure");
    } else {
      update({ selectedReturnTrip: trip, selectedSeatsReturn: [], stage: "SelectingSeats" });
      setSeatLeg("departure");
    }
  };

  const loadSeats = async (leg) => {
    const trip = leg === "departure" ? draft.selectedDepartureTrip : draft.selectedReturnTrip;
    if (!trip) return;
    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }
    setSeatLeg(leg);
    setLoading(true);
    setError("");
    setSeatMap([]);
    try {
      const fromCode = leg === "departure" ? draft.fromStationCode : draft.toStationCode;
      const toCode = leg === "departure" ? draft.toStationCode : draft.fromStationCode;
      const response = await fetchTripSeatMap(tripId(trip), { fromStationCode: fromCode, toStationCode: toCode });
      setSeatMap(unwrapList(response, "seats").map(normalizeSeat));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, vn ? "Không thể tải sơ đồ ghế." : "Unable to load the seat map."));
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seat) => {
    if (!seatAvailable(seat)) return;
    const next = selectedSeats.some((item) => item.seatNumber === seat.seatNumber)
      ? selectedSeats.filter((item) => item.seatNumber !== seat.seatNumber)
      : selectedSeats.length >= requiredSeatCount ? selectedSeats : [...selectedSeats, seat];
    update(seatLeg === "departure" ? { selectedSeatsDeparture: next } : { selectedSeatsReturn: next });
  };

  const holdSelectedSeats = async () => {
    if (selectedSeats.length !== requiredSeatCount) {
      setError(vn ? `Vui lòng chọn đủ ${requiredSeatCount} ghế.` : `Select exactly ${requiredSeatCount} seats.`);
      return;
    }
    const trip = seatLeg === "departure" ? draft.selectedDepartureTrip : draft.selectedReturnTrip;
    const fromCode = seatLeg === "departure" ? draft.fromStationCode : draft.toStationCode;
    const toCode = seatLeg === "departure" ? draft.toStationCode : draft.fromStationCode;
    setLoading(true);
    setError("");
    try {
      const response = await holdSeats(tripId(trip), selectedSeats.map((seat) => seat.seatNumber), fromCode, toCode);
      const failed = pick(response, ["failedSeatNumbers", "data.failedSeatNumbers"], []);
      if (Array.isArray(failed) && failed.length) throw new Error(`${vn ? "Ghế không còn trống" : "Unavailable seats"}: ${failed.join(", ")}`);
      const expires = pick(response, ["holdExpiresAt", "data.holdExpiresAt"], null);
      if (seatLeg === "departure" && draft.isRoundTrip && !draft.selectedSeatsReturn.length) {
        update({ holdExpiresAt: expires, stage: "SelectingSeats" });
        setSeatLeg("return");
        await loadSeats("return");
      } else {
        update({ holdExpiresAt: expires, stage: "EnteringPassengers" });
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, requestError.message || (vn ? "Không thể giữ ghế." : "Unable to hold seats.")));
    } finally {
      setLoading(false);
    }
  };

  const updatePassenger = (index, patch) => update({ passengers: passengerRows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  const buildItems = (seats, leg) => {
    const fromCode = leg === "departure" ? draft.fromStationCode : draft.toStationCode;
    const toCode = leg === "departure" ? draft.toStationCode : draft.fromStationCode;
    const seated = passengerRows.filter((row) => row.seatIndex !== null).map((row) => ({
      seatNumber: seats[row.seatIndex]?.seatNumber || null,
      ticketTypeCode: row.type,
      fromStationCode: fromCode,
      toStationCode: toCode,
      passengerName: String(row.name || "").trim(),
      passengerPhone: null,
      passengerEmail: null,
      birthYear: row.birthYear ? Number(row.birthYear) : null,
    }));
    const infants = passengerRows.filter((row) => row.type === "INFANT").map((row) => ({
      seatNumber: null,
      ticketTypeCode: "INFANT",
      fromStationCode: fromCode,
      toStationCode: toCode,
      passengerName: String(row.name || "").trim(),
      passengerPhone: null,
      passengerEmail: null,
      birthYear: row.birthYear ? Number(row.birthYear) : null,
      companionPassengerName: passengerRows[Number(row.companionIndex)]?.name?.trim() || null,
    }));
    return [...seated, ...infants];
  };

  const bookingPayload = () => ({
    tripCode: tripLabel(draft.selectedDepartureTrip),
    items: buildItems(draft.selectedSeatsDeparture, "departure"),
    promotionCode: draft.promotionCode.trim() || null,
    insuranceSelected: Boolean(draft.insuranceSelected),
    insurancePackageId: null,
    contactName: draft.contact.name.trim(),
    contactPhone: draft.contact.phone.trim(),
    contactEmail: draft.contact.email.trim(),
    ...(draft.isRoundTrip ? { returnTripCode: tripLabel(draft.selectedReturnTrip), returnItems: buildItems(draft.selectedSeatsReturn, "return") } : {}),
  });

  const preview = async () => {
    setError("");
    if (passengerRows.some((row) => !row.name.trim() || ((row.type === "CHILD" || row.type === "INFANT") && !row.birthYear) || (row.type === "INFANT" && row.companionIndex === ""))) {
      setError(vn ? "Vui lòng nhập đủ họ tên; trẻ em/em bé cần năm sinh và em bé cần người lớn đi kèm." : "Complete names; children/infants need a birth year and infants need an adult companion.");
      return;
    }
    if (!draft.contact.name.trim() || !draft.contact.phone.trim() || !draft.contact.email.trim()) {
      setError(vn ? "Vui lòng nhập đủ thông tin liên hệ nhận vé." : "Complete the ticket contact information.");
      return;
    }
    setLoading(true);
    try {
      const result = await previewBooking(bookingPayload());
      update({ preview: result, stage: "AwaitingConfirmation" });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, vn ? "Thông tin đặt vé chưa hợp lệ." : "The booking details are not valid."));
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const booking = await submitBooking(bookingPayload());
      const bookingId = pick(booking, ["bookingId", "id", "data.bookingId", "data.id"], "");
      if (!bookingId) throw new Error(vn ? "Không nhận được mã booking." : "Booking id was not returned.");
      if (Number(draft.preview?.totalAmount ?? draft.preview?.total ?? 0) <= 0) {
        update({ stage: "Completed" });
        onDone?.(booking);
        return;
      }
      const payment = await createBookingPayment({ bookingId, paymentOption: "Full", promotionCode: draft.promotionCode.trim() || null, pointsToUse: 0 });
      const checkoutUrl = pick(payment, ["checkoutUrl", "paymentUrl", "paymentLink", "payUrl", "url", "data.checkoutUrl", "data.paymentUrl"], "");
      if (!checkoutUrl) throw new Error(vn ? "Không tạo được liên kết PayOS." : "PayOS checkout link was not returned.");
      update({ stage: "PaymentPending" });
      window.location.assign(checkoutUrl);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, requestError.message || (vn ? "Không thể tạo booking hoặc thanh toán." : "Unable to create the booking or payment.")));
    } finally {
      setLoading(false);
    }
  };

  const renderTrip = (trip, leg) => (
    <button key={`${leg}-${tripId(trip)}`} type="button" onClick={() => chooseTrip(leg, trip)} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left text-[11px] transition hover:border-[#124757] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 font-bold text-[#124757] dark:text-yellow-300"><span>{tripLabel(trip)}</span><span>{formatMoney(pick(trip, ["minPrice", "price", "basePrice"], 0))}</span></div>
      <div className="mt-1 flex justify-between text-slate-500"><span>{tripTime(trip)} → {tripTime(trip, true)}</span><span>{pick(trip, ["availableSeats", "availableSeatCount"], "—")} {vn ? "ghế" : "seats"}</span></div>
    </button>
  );

  const renderSeatPicker = () => {
    const decks = [...new Set(seatMap.map((seat) => seat.deck))];
 return <div className="space-y-2"><div className="flex items-center justify-between text-[11px] font-bold"><span>{vn ? `Chọn ${requiredSeatCount} ghế (${seatLeg === "departure" ? "chiều đi" : "chiều về"})` : `Select ${requiredSeatCount} seats (${seatLeg})`}</span><span className="text-[#124757] dark:text-yellow-300">{selectedSeats.length}/{requiredSeatCount}</span></div><div className="flex flex-wrap gap-2 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />{vn ? "Trống" : "Available"}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-300" />{vn ? "Đang chọn" : "Selected"}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />{vn ? "Đã giữ/đã đặt" : "Held/booked"}</span></div>{decks.map((deck) => <div key={deck} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><div className="mb-1 text-[10px] font-bold text-slate-500">{vn ? `Tầng ${deck}` : `Deck ${deck}`}</div><div className="grid grid-cols-4 gap-1.5">{seatMap.filter((seat) => seat.deck === deck).map((seat) => { const selected = selectedSeats.some((item) => item.seatNumber === seat.seatNumber); const disabled = !seatAvailable(seat); return <button key={seat.seatNumber} type="button" disabled={disabled || loading} onClick={() => toggleSeat(seat)} title={`${seat.seatNumber} ${formatMoney(seat.price)}`} className={`rounded-lg border px-1 py-2 text-[10px] font-bold ${selected ? "border-yellow-500 bg-yellow-300 text-slate-900" : disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800" : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>{seat.seatNumber}</button>; })}</div></div>)}</div>;
  };

  return <div className="mt-3 w-full rounded-2xl border border-[#124757]/20 bg-slate-100/80 p-3 text-[12px] dark:border-yellow-400/20 dark:bg-slate-900/70">
    <div className="mb-2 flex items-center justify-between"><span className="font-black text-[#124757] dark:text-yellow-300">{vn ? "Đặt vé trong chat" : "Book in chat"}</span><span className="text-[10px] text-slate-500">{currentStage + 1}/{STAGES.length}</span></div>
    {!isAuthenticated && <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800"><span>{vn ? "Bạn cần đăng nhập để giữ ghế và thanh toán." : "Sign in to hold seats and pay."}</span><button type="button" onClick={onRequireLogin} className="shrink-0 rounded-lg bg-[#124757] px-2 py-1 font-bold text-white">{vn ? "Đăng nhập" : "Sign in"}</button></div>}
    {error && <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-700">{error}</div>}
    {draft.stage === "CollectingInfo" && <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2 text-[10px] dark:border-slate-700 dark:bg-slate-900"><div className="font-black text-emerald-700">{vn ? "Đã xác nhận" : "Confirmed"}: {receivedFields.join(", ") || (vn ? "Chưa có" : "None")}</div>{missingFields.length > 0 && <div className="mt-0.5 font-semibold text-amber-700">{vn ? "Còn thiếu" : "Missing"}: {missingFields.join(", ")}</div>}</div>
      <div className="grid grid-cols-2 gap-2"><label>{vn ? "Ngày đi" : "Departure date"}<input type="date" min={getTodayDateString()} value={draft.departureDate} onChange={(e) => update({ departureDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /></label><label className="flex items-end gap-1.5 pb-2"><input type="checkbox" checked={draft.isRoundTrip} onChange={(e) => update({ isRoundTrip: e.target.checked })} />{vn ? "Khứ hồi" : "Round trip"}</label></div>
      {draft.isRoundTrip && <label>{vn ? "Ngày về" : "Return date"}<input type="date" min={draft.departureDate || getTodayDateString()} value={draft.returnDate} onChange={(e) => update({ returnDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /></label>}
      <div className="grid grid-cols-2 gap-2"><label>{vn ? "Bến đi" : "From"}<select value={draft.fromStationId} onChange={(e) => selectStation("from", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"><option value="">—</option>{stationOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>{vn ? "Bến đến" : "To"}<select value={draft.toStationId} onChange={(e) => selectStation("to", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"><option value="">—</option>{stationOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <div className="grid grid-cols-3 gap-2"><label>{vn ? "Người lớn" : "Adults"}<input type="number" min="1" max="10" value={draft.adultCount} onChange={(e) => update({ adultCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /></label><label>{vn ? "Trẻ em" : "Children"}<input type="number" min="0" max="9" value={draft.childCount} onChange={(e) => update({ childCount: Math.max(0, Math.min(9, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /></label><label>{vn ? "Em bé" : "Infants"}<input type="number" min="0" max="9" value={draft.infantCount} onChange={(e) => update({ infantCount: Math.max(0, Math.min(9, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /></label></div>
      <button type="button" disabled={loading || !isAuthenticated} onClick={searchTrips} className="w-full rounded-xl bg-[#124757] px-3 py-2.5 font-bold text-white disabled:opacity-50">{loading ? "…" : vn ? "Tìm chuyến" : "Find trips"}</button>
    </div>}
    {draft.stage === "SelectingTrip" && <div className="space-y-2"><div className="font-bold">{draft.selectedDepartureTrip ? (draft.isRoundTrip ? (draft.selectedReturnTrip ? (vn ? "Chọn ghế" : "Choose seats") : (vn ? "Chọn chuyến về" : "Choose return trip")) : (vn ? "Đã chọn chuyến đi" : "Outbound selected")) : (vn ? "Chọn chuyến đi" : "Choose outbound trip")}</div>{!draft.selectedDepartureTrip && <div className="space-y-1.5">{draft.departureTrips.map((trip) => renderTrip(trip, "departure"))}</div>}{draft.selectedDepartureTrip && draft.isRoundTrip && !draft.selectedReturnTrip && <div className="space-y-1.5">{draft.returnTrips.map((trip) => renderTrip(trip, "return"))}</div>}{draft.selectedDepartureTrip && !draft.isRoundTrip && <button type="button" onClick={() => { update({ stage: "SelectingSeats" }); setSeatLeg("departure"); loadSeats("departure"); }} className="w-full rounded-xl bg-[#124757] px-3 py-2 font-bold text-white">{vn ? "Chọn ghế" : "Choose seats"}</button>}{draft.selectedDepartureTrip && draft.selectedReturnTrip && <button type="button" onClick={() => { update({ stage: "SelectingSeats" }); setSeatLeg("departure"); loadSeats("departure"); }} className="w-full rounded-xl bg-[#124757] px-3 py-2 font-bold text-white">{vn ? "Chọn ghế chiều đi" : "Choose outbound seats"}</button>}</div>}
    {draft.stage === "SelectingSeats" && <div className="space-y-2">{seatMap.length ? renderSeatPicker() : <button type="button" disabled={loading} onClick={() => loadSeats(seatLeg)} className="w-full rounded-xl border border-[#124757] px-3 py-2 font-bold text-[#124757]">{loading ? "…" : vn ? "Tải sơ đồ ghế" : "Load seat map"}</button>}<button type="button" disabled={loading || selectedSeats.length !== requiredSeatCount} onClick={holdSelectedSeats} className="w-full rounded-xl bg-[#124757] px-3 py-2 font-bold text-white disabled:opacity-50">{vn ? "Giữ ghế và tiếp tục" : "Hold seats and continue"}</button>{holdSeconds !== null && <div className="text-center text-[10px] text-amber-700">{vn ? "Ghế được giữ còn" : "Seat hold expires in"} {Math.floor(holdSeconds / 60)}:{String(holdSeconds % 60).padStart(2, "0")}</div>}</div>}
    {draft.stage === "EnteringPassengers" && <div className="space-y-2"><div className="font-bold">{vn ? "Thông tin hành khách" : "Passenger details"}</div>{passengerRows.map((row, index) => <div key={`${row.type}-${index}`} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><div className="mb-1 text-[10px] font-black text-[#124757] dark:text-yellow-300">{row.type === "ADULT" ? `${vn ? "Người lớn" : "Adult"} ${index + 1}` : row.type === "CHILD" ? `${vn ? "Trẻ em" : "Child"} ${index - Number(draft.adultCount || 0) + 1}` : `${vn ? "Em bé" : "Infant"} ${index - Number(draft.adultCount || 0) - Number(draft.childCount || 0) + 1}`}{row.seatIndex !== null && ` · ${vn ? "ghế" : "seat"} ${(draft.selectedSeatsDeparture[row.seatIndex] || {}).seatNumber || "—"}`}</div><input value={row.name} onChange={(e) => updatePassenger(index, { name: e.target.value })} placeholder={vn ? "Họ và tên" : "Full name"} className="mb-1 w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /><div className="grid grid-cols-2 gap-1.5"><input type="number" value={row.birthYear} onChange={(e) => updatePassenger(index, { birthYear: e.target.value })} placeholder={vn ? "Năm sinh" : "Birth year"} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" />{row.type === "INFANT" && <select value={row.companionIndex} onChange={(e) => updatePassenger(index, { companionIndex: e.target.value })} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"><option value="">{vn ? "Người lớn đi kèm" : "Adult companion"}</option>{passengerRows.map((adult, adultIndex) => adult.type === "ADULT" ? <option key={adultIndex} value={adultIndex}>{adult.name || `${vn ? "Người lớn" : "Adult"} ${adultIndex + 1}`}</option> : null)}</select>}</div></div>)}<div className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><div className="mb-1 font-bold">{vn ? "Nhận vé" : "Ticket contact"}</div><div className="space-y-1.5"><input value={draft.contact.name} onChange={(e) => update({ contact: { ...draft.contact, name: e.target.value } })} placeholder={vn ? "Tên liên hệ" : "Contact name"} className="w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /><input value={draft.contact.phone} onChange={(e) => update({ contact: { ...draft.contact, phone: e.target.value } })} placeholder={vn ? "Số điện thoại" : "Phone"} className="w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /><input type="email" value={draft.contact.email} onChange={(e) => update({ contact: { ...draft.contact, email: e.target.value } })} placeholder="Email" className="w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /><div className="grid grid-cols-2 gap-1.5"><input value={draft.promotionCode} onChange={(e) => update({ promotionCode: e.target.value })} placeholder={vn ? "Mã khuyến mãi" : "Promo code"} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800" /><label className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700"><input type="checkbox" checked={draft.insuranceSelected} onChange={(e) => update({ insuranceSelected: e.target.checked })} />{vn ? "Bảo hiểm" : "Insurance"}</label></div></div></div><button type="button" disabled={loading} onClick={preview} className="w-full rounded-xl bg-[#124757] px-3 py-2 font-bold text-white disabled:opacity-50">{loading ? "…" : vn ? "Xem tổng tiền" : "Preview total"}</button></div>}
    {draft.stage === "AwaitingConfirmation" && <div className="space-y-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800"><div className="font-black">{vn ? "Kiểm tra lần cuối" : "Final review"}</div><div>{draft.fromStationName} → {draft.toStationName}</div><div>{tripLabel(draft.selectedDepartureTrip)} · {tripTime(draft.selectedDepartureTrip)} → {tripTime(draft.selectedDepartureTrip, true)}</div><div>{vn ? "Ghế" : "Seats"}: {draft.selectedSeatsDeparture.map((s) => s.seatNumber).join(", ")}</div>{draft.isRoundTrip && <div>{vn ? "Chiều về" : "Return"}: {tripLabel(draft.selectedReturnTrip)} · {draft.selectedSeatsReturn.map((s) => s.seatNumber).join(", ")}</div>}<div>{vn ? "Hành khách" : "Passengers"}: {passengerRows.length}</div><div className="mt-1 space-y-0.5 border-t border-emerald-200 pt-1"><div>{vn ? "Tiền vé" : "Tickets"}: {formatMoney(pick(draft.preview, ["ticketSubtotalAmount", "TicketSubtotalAmount"], 0))}</div><div>{vn ? "Bảo hiểm" : "Insurance"}: {formatMoney(pick(draft.preview, ["insuranceAmount", "InsuranceAmount"], 0))}</div><div>{vn ? "Giảm giá" : "Discount"}: -{formatMoney(pick(draft.preview, ["discountAmount", "DiscountAmount"], 0))}</div><div className="text-base font-black">{vn ? "Tổng tiền" : "Total"}: {formatMoney(pick(draft.preview, ["totalAmount", "TotalAmount", "total", "Total"], 0))}</div></div>{draft.preview?.promotionMessage && <div>{draft.preview.promotionMessage}</div>}</div><div className="flex gap-2"><button type="button" onClick={() => update({ stage: "EnteringPassengers" })} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 font-bold">{vn ? "Chỉnh sửa" : "Edit"}</button><button type="button" disabled={loading} onClick={confirmBooking} className="flex-1 rounded-xl bg-[#124757] px-3 py-2 font-bold text-white disabled:opacity-50">{loading ? "…" : vn ? "Xác nhận & thanh toán" : "Confirm & pay"}</button></div></div>}
    {draft.stage === "PaymentPending" && <div className="rounded-xl bg-amber-50 p-3 text-center text-[11px] font-semibold text-amber-800">{vn ? "Đang chuyển bạn sang PayOS để thanh toán…" : "Redirecting you to PayOS…"}</div>}
    {draft.stage === "Completed" && <div className="rounded-xl bg-emerald-50 p-3 text-center text-[11px] font-semibold text-emerald-800">{vn ? "Đặt vé thành công." : "Booking completed."}</div>}
  </div>;
};

export default ChatBookingFlow;
