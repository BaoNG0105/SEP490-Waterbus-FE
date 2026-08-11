import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSeatLayout } from "../services/seatService";
import { fetchBoatDetail } from "../services/boatService";
import { getApiErrorMessage } from "../utils/apiError";
import { SeatMapIcon, seatToneFromCode, resolveSeatTypeCode } from "./SeatMapIcon";
import { BoatBowLabel } from "./ShipWheelIcon";

const DEFAULT_BOAT_IMAGE = "";

function collectBoatImages(boat, fallbackUrl = "") {
  const urls = [];
  const push = (url) => {
    const value = String(url || "").trim();
    if (!value || urls.includes(value)) return;
    urls.push(value);
  };

  if (Array.isArray(boat?.imageUrls)) boat.imageUrls.forEach(push);

  push(boat?.imageUrl);

  push(boat?.boat?.imageUrl);
  
  push(boat?.thumbnailUrl);
  push(boat?.boat?.thumbnailUrl);

  if (Array.isArray(fallbackUrl)) fallbackUrl.forEach(push);
  else push(fallbackUrl);

  return urls;
}

const getSeatCellStyle = (cell) => {
  const seat = cell?.seat;
  const seatTypeCode = resolveSeatTypeCode(seat) || resolveSeatTypeCode(cell);
  const isSeat = cell?.type === "Seat";
  const isSeatActive = seat?.isActive ?? true;

  if (cell?.type === "Aisle") {
    return {
      cellClass: "bg-slate-100 border-transparent dark:bg-slate-700/40",
      isSeat: false,
      isSeatActive: true,
      seatCode: "",
      tone: "standard",
    };
  }

  if (!isSeat) {
    return {
      cellClass: "bg-white border-dashed border-slate-200 dark:border-slate-700",
      isSeat: false,
      isSeatActive: true,
      seatCode: "",
      tone: "standard",
    };
  }

  return {
    cellClass: "bg-transparent border-transparent",
    isSeat: true,
    isSeatActive,
    seatCode: seat?.seatCode || seatTypeCode || "",
    tone: seatToneFromCode(seatTypeCode),
  };
};

function summarizeSeatLayout(layout, fallback = {}) {
  const decks = Array.isArray(layout?.decks) ? layout.decks : [];
  const typeMap = new Map();
  let totalSeats = 0;
  let activeSeats = 0;

  decks.forEach((deck) => {
    (deck.cells || []).forEach((cell) => {
      if (cell?.type !== "Seat" || !cell.seat) return;
      totalSeats += 1;
      if (cell.seat.isActive ?? true) activeSeats += 1;
      const raw = resolveSeatTypeCode(cell.seat) || "STANDARD";
      const code = String(raw).toUpperCase().replace(/^SEAT_/, "");
      const name = cell.seat.seatType?.name || code;
      const prev = typeMap.get(code) || { code, name, count: 0 };
      prev.count += 1;
      typeMap.set(code, prev);
    });
  });

  const seatTypes = [...typeMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  const setupLabel = fallback.seatSetupType === "StandardAndVip"
    ? "Water Sightseeing"
    : fallback.seatSetupType === "FullStandard"
      ? "Waterbus"
      : fallback.seatSetupType || "";

  return {
    totalSeats: totalSeats || Number(fallback.seatCount) || 0,
    activeSeats: totalSeats ? activeSeats : Number(fallback.seatCount) || 0,
    typeCount: seatTypes.length || (setupLabel.includes("VIP") ? 2 : setupLabel ? 1 : 0),
    seatTypes,
    deckCount: decks.length || Number(fallback.numberOfDecks) || 0,
    setupLabel,
  };
}

function SeatDeckGrid({ deck, lang, showBow = true }) {
  const cells = Array.isArray(deck?.cells) ? deck.cells : [];
  const rowCount = deck.rowCount || cells.reduce((max, cell) => Math.max(max, Number(cell.row) || 0), 0);
  const columnCount = deck.columnCount || cells.reduce((max, cell) => Math.max(max, Number(cell.column) || 0), 0);

  if (!cells.length || rowCount <= 0 || columnCount <= 0) {
    return (
      <p className="py-8 text-center text-sm font-bold text-slate-400">
        {lang === "VN" ? "Tầng này chưa có sơ đồ ghế." : "This deck has no seat layout."}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center min-w-max mx-auto">
      <div className={`relative flex min-w-max flex-col items-center overflow-visible rounded-t-[12rem] rounded-b-[3rem] border-8 border-slate-300 bg-slate-100 px-8 pb-10 shadow-xl dark:border-slate-600 dark:bg-slate-900/80 md:px-14 ${showBow ? "pt-14" : "pt-8"}`}>
        {showBow ? (
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <BoatBowLabel lang={lang} />
          </div>
        ) : null}

        <div
          className="relative z-10 mx-auto grid gap-2 overflow-visible p-2 md:gap-2.5"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(40px, 48px))`,
            gridTemplateRows: `repeat(${rowCount}, minmax(44px, 52px))`,
          }}
        >
          {cells.map((cell) => {
            const style = getSeatCellStyle(cell);
            const seatLabel = style.seatCode || `${cell.row}-${cell.column}`;
            return (
              <div
                key={`${cell.row}-${cell.column}`}
                className={`relative z-1 flex select-none flex-col items-center justify-center rounded-lg border text-[9px] font-bold ${style.cellClass}`}
                style={{ gridRow: cell.row, gridColumn: cell.column }}
                title={style.isSeat ? seatLabel : cell.type}
              >
                {style.isSeat ? (
                  <SeatMapIcon
                    label={seatLabel}
                    tone={style.tone}
                    disabled={!style.isSeatActive}
                    className="w-[92%] h-[92%]"
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center opacity-60">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
            {lang === "VN" ? "Đuôi tàu" : "Stern"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BoatSeatLayoutPreviewButton({
  boatId,
  boatName = "",
  lang = "VN",
  className = "",
  boatMeta,
  boatImageUrl = "",
  boatCode = "",
  variant = "charter",
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!boatId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={lang === "VN" ? "Xem sơ đồ ghế" : "View seat layout"}
        aria-label={lang === "VN" ? "Xem sơ đồ ghế" : "View seat layout"}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D8E7EA] bg-white text-[#124757] transition hover:bg-[#F7FAFB] dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400 dark:hover:bg-slate-700 ${className}`}
      >
        <span className="material-symbols-outlined text-[16px]">info</span>
      </button>

      {isOpen ? (
        <BoatSeatLayoutPreviewModal
          boatId={boatId}
          boatName={boatName}
          boatCode={boatCode}
          boatImageUrl={boatImageUrl || boatMeta?.imageUrl || ""}
          lang={lang}
          boatMeta={boatMeta}
          variant={variant}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

export function BoatSeatLayoutPreviewModal({
  boatId,
  boatName = "",
  boatCode = "",
  boatImageUrl = "",
  lang = "VN",
  boatMeta = null,
  variant = "charter",
  onClose,
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  const [boatImages, setBoatImages] = useState(() => collectBoatImages(boatMeta, boatImageUrl));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const boatMetaRef = useRef(boatMeta);
  useEffect(() => {
    boatMetaRef.current = boatMeta;
  }, [boatMeta]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!boatId) {
        setError(lang === "VN" ? "Không xác định được tàu." : "Boat is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");
      try {
        const [layoutData, boatDetail] = await Promise.all([
          fetchSeatLayout(boatId),
          fetchBoatDetail(boatId).catch(() => null),
        ]);
        if (cancelled) return;

        setLayout(layoutData);
        const firstDeck = Array.isArray(layoutData?.decks) && layoutData.decks.length > 0
          ? layoutData.decks[0].deckNumber
          : 1;
        setActiveDeck(firstDeck);

        const images = collectBoatImages(boatDetail || boatMetaRef.current, boatImageUrl);
        setBoatImages(images.length ? images : [DEFAULT_BOAT_IMAGE]);
        setActiveImageIndex(0);
      } catch (err) {
        if (cancelled) return;
        setLayout(null);
        if (err?.response?.status === 403) {
          // 403: BE chặn customer xem seat layout → vẫn hiện ảnh & thông tin cơ bản từ boatMeta
          setBoatImages(boatMetaRef.current ? collectBoatImages(boatMetaRef.current, boatImageUrl) : [boatImageUrl || DEFAULT_BOAT_IMAGE]);
          setError(""); // Không hiện lỗi, vẫn show modal với thông tin có sẵn
        } else {
          setError(getApiErrorMessage(
            err,
            lang === "VN" ? "Không tải được sơ đồ ghế." : "Unable to load seat layout.",
          ));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [boatId, lang, boatImageUrl]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (isLightboxOpen) setIsLightboxOpen(false);
        else onClose?.();
      }
      if (!isLightboxOpen || boatImages.length < 2) return;
      if (event.key === "ArrowRight") {
        setActiveImageIndex((i) => (i + 1) % boatImages.length);
      }
      if (event.key === "ArrowLeft") {
        setActiveImageIndex((i) => (i - 1 + boatImages.length) % boatImages.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, isLightboxOpen, boatImages.length]);

  const decks = Array.isArray(layout?.decks) ? layout.decks : [];
  const activeDeckData = decks.find((deck) => Number(deck.deckNumber) === Number(activeDeck)) || decks[0];
  const summary = useMemo(
    () => summarizeSeatLayout(layout, boatMeta || {}),
    [layout, boatMeta],
  );

  const imageSrc = boatImages[activeImageIndex] || boatImages[0] || boatImageUrl || boatMeta?.imageUrl || DEFAULT_BOAT_IMAGE;

  // Hiện subtitle dựa trên variant và có layout hay không
  const subtitle = variant === "admin"
    ? (lang === "VN"
      ? "Xem ảnh tàu, sơ đồ, tổng ghế và các kiểu ghế."
      : "View boat photos, seat map, capacity and seat types.")
    : (layout
      ? (lang === "VN" ? "Sơ đồ ghế và thông tin tàu." : "Seat layout and boat info.")
      : (lang === "VN" ? "Thông tin tàu thuê." : "Charter boat info."));

  return (
    <div
      className="fixed inset-0 z-120 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-3 pb-6 pt-20 sm:items-center sm:px-6 sm:pb-8 sm:pt-28"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-6.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800 sm:max-h-[calc(100dvh-8rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="mt-1 truncate font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {boatName || (lang === "VN" ? "Tàu" : "Boat")}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
          {isLoading ? (
            <div className="flex min-h-60 items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="text-sm font-bold text-rose-600 dark:text-rose-300">{error}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Gallery ảnh tàu */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Hình ảnh tàu" : "Boat photos"}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">
                    {boatImages.length} {lang === "VN" ? "ảnh" : "photos"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="group relative block w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  title={lang === "VN" ? "Bấm để xem lớn" : "Click to enlarge"}
                >
                 <img
                      src={imageSrc}
                      alt={boatName || boatCode || "Boat"}
                      className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-64"
                      onError={(e) => {
                        e.currentTarget.src = "";
                      }}
                    />
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                    {lang === "VN" ? "Xem lớn" : "Enlarge"}
                  </span>
                </button>

                {boatImages.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {boatImages.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                          index === activeImageIndex
                            ? "border-[#124757] ring-2 ring-[#124757]/20 dark:border-yellow-400 dark:ring-yellow-400/20"
                            : "border-slate-200 opacity-80 hover:opacity-100 dark:border-slate-700"
                        }`}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {decks.length === 0 ? (
                boatMeta && (boatMeta.seatCount || boatMeta.numberOfDecks || boatMeta.seatSetupType) ? (
                  // Có boatMeta nhưng không load được layout → hiện thông tin cơ bản
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {boatMeta.seatCount ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Sức chứa" : "Capacity"}
                        </p>
                        <p className="mt-0.5 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                          {boatMeta.seatCount} {lang === "VN" ? "ghế" : "seats"}
                        </p>
                      </div>
                    ) : null}
                    {boatMeta.numberOfDecks ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Số tầng" : "Decks"}
                        </p>
                        <p className="mt-0.5 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                          {boatMeta.numberOfDecks}
                        </p>
                      </div>
                    ) : null}
                    {boatMeta.seatSetupType ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Cấu hình" : "Setup"}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-black text-[#124757] dark:text-yellow-400">
                          {boatMeta.seatSetupType}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
                    <span className="material-symbols-outlined text-4xl text-slate-300">event_seat</span>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {lang === "VN" ? "Tàu chưa có sơ đồ ghế." : "This boat has no seat layout yet."}
                    </p>
                  </div>
                )
              ) : (
                <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Tổng số ghế" : "Total seats"}
                  </p>
                  <p className="mt-0.5 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                    {summary.totalSeats}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Số tầng" : "Decks"}
                  </p>
                  <p className="mt-0.5 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                    {summary.deckCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Cấu hình ghế" : "Setup type"}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-black text-[#124757] dark:text-yellow-400">
                    {summary.setupLabel || "—"}
                  </p>
                </div>
              </div>

              {summary.seatTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {summary.seatTypes.map((type) => (
                    <span
                      key={type.code}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <span className="inline-block h-6 w-5">
                        <SeatMapIcon tone={seatToneFromCode(type.code)} showLabel={false} />
                      </span>
                      {type.code}
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-black text-[#124757] dark:bg-slate-800 dark:text-yellow-400">
                        {type.count}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}

              {decks.length > 1 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {decks.map((deck) => (
                    <button
                      key={deck.deckNumber}
                      type="button"
                      onClick={() => setActiveDeck(deck.deckNumber)}
                      className={`rounded-xl px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition ${
                        Number(activeDeck) === Number(deck.deckNumber)
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 md:p-6">
                {activeDeckData ? (
                  <SeatDeckGrid
                    deck={activeDeckData}
                    lang={lang}
                    showBow={Number(activeDeckData.deckNumber) === 1}
                  />
                ) : null}
              </div>

                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isLightboxOpen ? (
        <div
          className="fixed inset-0 z-130 flex items-center justify-center bg-slate-950/90 p-4 pt-20 sm:pt-24"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {boatImages.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((i) => (i - 1 + boatImages.length) % boatImages.length);
                }}
                className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-6"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((i) => (i + 1) % boatImages.length);
                }}
                className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-6"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </>
          ) : null}

          <img
            src={imageSrc}
            alt={boatName || boatCode || "Boat"}
            className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white">
            {activeImageIndex + 1}/{boatImages.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
