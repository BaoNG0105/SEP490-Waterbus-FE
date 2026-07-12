import { useEffect, useState } from "react";
import { fetchSeatLayout } from "../services/seatService";
import { getApiErrorMessage } from "../utils/apiError";

const getSeatCellStyle = (cell) => {
  const seat = cell?.seat;
  const seatTypeCode = seat?.seatType?.seatTypeCode;
  const isSeat = cell?.type === "Seat";
  const isSeatActive = seat?.isActive ?? true;

  if (cell?.type === "Aisle") {
    return {
      bgColor: "bg-slate-100 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600",
      icon: "",
      isSeat: false,
      isSeatActive: true,
      seatCode: "",
    };
  }

  if (!isSeat) {
    return {
      bgColor: "bg-white border-dashed border-slate-200 dark:border-slate-700",
      icon: "",
      isSeat: false,
      isSeatActive: true,
      seatCode: "",
    };
  }

  let bgColor = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10";
  let icon = "chair";
  if (seatTypeCode === "CABIN") {
    bgColor = "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10";
    icon = "chair_alt";
  } else if (seatTypeCode === "RIVER") {
    bgColor = "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10";
    icon = "deck";
  } else if (seatTypeCode === "SKY") {
    bgColor = "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10";
    icon = "airline_seat_recline_extra";
  }

  return {
    bgColor,
    icon,
    isSeat: true,
    isSeatActive,
    seatCode: seat?.seatCode || seatTypeCode || "",
  };
};

function SeatDeckGrid({ deck, lang }) {
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
      <div className="relative flex min-w-max flex-col items-center rounded-t-[12rem] rounded-b-[3rem] border-8 border-slate-300 bg-slate-100 px-6 pb-12 pt-16 shadow-xl dark:border-slate-600 dark:bg-slate-900/80 md:px-10">
        <div className="absolute top-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-60">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Mũi tàu" : "Bow"}
          </span>
        </div>

        <div
          className="relative z-10 mx-auto grid gap-1.5 md:gap-2"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(36px, 44px))`,
            gridTemplateRows: `repeat(${rowCount}, minmax(36px, 44px))`,
          }}
        >
          {cells.map((cell) => {
            const style = getSeatCellStyle(cell);
            return (
              <div
                key={`${cell.row}-${cell.column}`}
                className={`relative flex select-none flex-col items-center justify-center rounded-lg border text-[9px] font-bold ${style.bgColor} ${style.isSeat && !style.isSeatActive ? "opacity-40 grayscale" : ""}`}
                style={{ gridRow: cell.row, gridColumn: cell.column }}
                title={style.isSeat ? style.seatCode : cell.type}
              >
                {style.icon ? (
                  <span className="material-symbols-outlined mb-0.5 text-[16px] leading-none">{style.icon}</span>
                ) : null}
                {style.isSeat ? (
                  <span className="text-[7px] tracking-tighter opacity-50">
                    {cell.row}-{cell.column}
                  </span>
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
          lang={lang}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

export function BoatSeatLayoutPreviewModal({ boatId, boatName = "", lang = "VN", onClose }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);

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
        const data = await fetchSeatLayout(boatId);
        if (cancelled) return;
        setLayout(data);
        const firstDeck = Array.isArray(data?.decks) && data.decks.length > 0
          ? data.decks[0].deckNumber
          : 1;
        setActiveDeck(firstDeck);
      } catch (err) {
        if (cancelled) return;
        setLayout(null);
        if (err?.response?.status === 403) {
          setError(lang === "VN"
            ? "Tài khoản khách chưa được phép xem sơ đồ ghế. Vui lòng thử lại sau khi hệ thống cập nhật quyền."
            : "Customer accounts cannot view seat layouts yet. Please try again after permissions are updated.");
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
  }, [boatId, lang]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const decks = Array.isArray(layout?.decks) ? layout.decks : [];
  const activeDeckData = decks.find((deck) => Number(deck.deckNumber) === Number(activeDeck)) || decks[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Sơ đồ ghế" : "Seat layout"}
            </p>
            <h3 className="mt-1 truncate font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {boatName || (lang === "VN" ? "Tàu" : "Boat")}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {lang === "VN"
                ? "Chỉ xem — thuê tàu nguyên chuyến, không chọn ghế lẻ."
                : "View only — whole-boat charter, no individual seat selection."}
            </p>
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
          ) : decks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-slate-300">event_seat</span>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {lang === "VN" ? "Tàu chưa có sơ đồ ghế." : "This boat has no seat layout yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
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
                {activeDeckData ? <SeatDeckGrid deck={activeDeckData} lang={lang} /> : null}
              </div>

              <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-500">chair</span>
                  Standard
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-purple-500">chair_alt</span>
                  Cabin
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-500">deck</span>
                  River
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-500">airline_seat_recline_extra</span>
                  Sky
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
