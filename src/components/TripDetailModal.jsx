import { useEffect, useState } from "react";
import { ImageWithFallback } from "./ImageWithFallback";
import { fetchBoatDetail } from "../services/boatService";
import {
  formatBookingClosedMessage,
  formatFareAdjustmentLabel,
  formatMinPriceLabel,
  isMissingKmBookingBlock,
} from "../utils/bookingFareMessages";

const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatTripDuration = (departureIso, arrivalIso, lang = "VN") => {
  if (!departureIso || !arrivalIso) return "--";
  const start = new Date(departureIso);
  const end = new Date(arrivalIso);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "--";
  return lang === "VN" ? `${minutes} phút` : `${minutes} min`;
};

/** BE: khóa chặng khi fromStopScheduledDeparture <= now + 10 phút (không dùng trip.departureTime). */
const SEGMENT_BOOKING_CLOSE_LEAD_MS = 10 * 60 * 1000;
const isSegmentBookingClosed = (trip) => {
  const raw = trip?.fromStopScheduledDeparture;
  if (!raw) return false;
  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + SEGMENT_BOOKING_CLOSE_LEAD_MS;
};

const isTripBookable = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (isMissingKmBookingBlock(trip)) return false;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

// Trip search/list KHÔNG kèm ảnh/tên tàu — chỉ có boatId. Dữ liệu thật lấy riêng qua GET /boats/{boatId}.
const pickTripBoatId = (trip) => String(
  trip?.boatId
  || trip?.boat?.boatId
  || trip?.boat?.vesselId
  || trip?.BoatId
  || "",
).trim();

const resolveTripBoatImage = (trip, boatImageById = {}) => {
  const boat = trip?.boat || trip?.Boat || {};
  const candidates = [
    trip?.boatImageUrl,
    trip?.BoatImageUrl,
    boat.imageUrl,
    boat.ImageUrl,
    Array.isArray(boat.imageUrls) ? boat.imageUrls[0] : "",
    Array.isArray(trip?.boatImageUrls) ? trip.boatImageUrls[0] : "",
    boatImageById[pickTripBoatId(trip)],
  ];
  return candidates.find((url) => String(url || "").trim()) || "";
};

const resolveTripBoatName = (trip, boatNameById = {}) => {
  const boat = trip?.boat || trip?.Boat || {};
  const candidates = [
    trip?.boatName,
    trip?.BoatName,
    boat.name,
    boat.Name,
    boat.boatName,
    boatNameById[pickTripBoatId(trip)],
    trip?.boatCode,
    trip?.BoatCode,
  ];
  return candidates.find((name) => String(name || "").trim()) || "";
};

/**
 * Modal xem chi tiết 1 chuyến (tuyến đường, tàu, giờ, giá, chỗ trống...) — dùng chung cho trang
 * đặt vé khách hàng (Step2SelectTripAndSeats) và quầy bán vé nhân viên (BookingPOS Step2Counter...).
 *
 * `boatImageById`/`boatNameById` (tuỳ chọn): cache ảnh/tên tàu theo boatId mà parent đã tải sẵn
 * (vd trang khách hàng tải trước cho cả danh sách thẻ chuyến) — dùng để tránh gọi lại API. Nếu
 * parent không có cache này (vd POS chưa tải ảnh/tên tàu cho danh sách), component tự gọi
 * fetchBoatDetail riêng ngay khi mở modal cho đúng trip đang xem.
 *
 * `canFetchBoatDetail`: GET /boats/{boatId} yêu cầu đã đăng nhập — trang khách hàng cho khách
 * chưa login vẫn xem được danh sách chuyến, nên PHẢI truyền false khi !isAuthenticated để tránh
 * BE trả 401 khiến interceptor tự đăng xuất + đá về /login dù khách chỉ đang xem.
 */
export function TripDetailModal({
  trip,
  onClose,
  lang = "VN",
  isLoopRoute = false,
  legFromWharfName = "",
  legToWharfName = "",
  boatImageById = {},
  boatNameById = {},
  canFetchBoatDetail = true,
}) {
  const [fetchedBoat, setFetchedBoat] = useState(null);

  const boatId = pickTripBoatId(trip);
  const cachedImage = resolveTripBoatImage(trip, boatImageById);
  const cachedName = resolveTripBoatName(trip, boatNameById);

  useEffect(() => {
    setFetchedBoat(null);
    if (!trip || !boatId || !canFetchBoatDetail) return;
    if (cachedImage && cachedName) return;

    let isActive = true;
    fetchBoatDetail(boatId)
      .then((detail) => {
        if (!isActive) return;
        setFetchedBoat({
          imageUrl: detail?.imageUrl || detail?.ImageUrl || (Array.isArray(detail?.imageUrls) ? detail.imageUrls[0] : "") || "",
          name: detail?.name || detail?.Name || detail?.boatName || detail?.BoatName || "",
        });
      })
      .catch(() => {
        if (isActive) setFetchedBoat({ imageUrl: "", name: "" });
      });
    return () => { isActive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.tripId, boatId, canFetchBoatDetail]);

  if (!trip) return null;

  const boatImage = cachedImage || fetchedBoat?.imageUrl || "";
  const boatName = cachedName || fetchedBoat?.name || "";

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={lang === "VN" ? "Chi tiết chuyến" : "Trip details"}
      >
        <div className="relative">
          <ImageWithFallback
            src={boatImage}
            alt=""
            className="w-full h-40"
            iconClassName="w-1/4 h-1/4"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === "VN" ? "Đóng" : "Close"}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/80 text-slate-600 dark:text-slate-200 hover:text-rose-600 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
              {lang === "VN" ? "Chi tiết chuyến" : "Trip details"}
            </p>
            <h3 className="text-xl font-headline font-black text-[#124757] dark:text-white mt-1">
              {isLoopRoute
                ? (lang === "VN" ? "Tour tham quan sông Sài Gòn" : "Saigon River Sightseeing Tour")
                : `${legFromWharfName || "--"} → ${legToWharfName || "--"}`}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tàu" : "Boat"}</p>
              <p className="font-bold text-slate-800 dark:text-white">{boatName || "--"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Giá vé" : "Price"}</p>
              <p className="font-bold text-[#124757] dark:text-yellow-400">
                {trip.minPrice != null && !isMissingKmBookingBlock(trip) ? (
                  <>
                    <span className="text-xs font-bold text-slate-400 mr-1">{lang === "VN" ? "Từ" : "From"}</span>
                    {formatMinPriceLabel(trip.minPrice, lang)}
                  </>
                ) : (
                  formatMinPriceLabel(null, lang)
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Khởi hành" : "Departure"}</p>
              <p className="font-bold text-slate-800 dark:text-white">{formatTripTime(getSegmentDeparture(trip))}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Đến nơi" : "Arrival"}</p>
              <p className="font-bold text-slate-800 dark:text-white">{formatTripTime(getSegmentArrival(trip))}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tuyến" : "Route name"}</p>
              <p className="font-bold text-slate-800 dark:text-white">
                {trip.routeName || (lang === "VN" ? "Chưa có tên tuyến" : "Route name unavailable")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Chỗ trống" : "Seats available"}</p>
              <p className="font-bold text-slate-800 dark:text-white">{trip.availableSeats}/{trip.totalSeats}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời lượng" : "Duration"}</p>
              <p className="font-bold text-slate-800 dark:text-white">{formatTripDuration(getSegmentDeparture(trip), getSegmentArrival(trip), lang)}</p>
            </div>
          </div>

          {formatFareAdjustmentLabel(trip.fareAdjustment, lang) ? (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
              {formatFareAdjustmentLabel(trip.fareAdjustment, lang)}
            </p>
          ) : null}

          {!isTripBookable(trip) ? (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2">
              {formatBookingClosedMessage(trip, lang)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}