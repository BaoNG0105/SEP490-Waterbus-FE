import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import { getTodayDateString } from "../../../../utils/dateOnly";
import { readBookingDraft, writeBookingDraft, clearBookingDraft } from "../../../../utils/bookingDraftStorage";
import { releaseHeldBookingSeats } from "../../../../utils/bookingWizardGuard";

import Step1SearchCounter from "./Step1SearchCounter";
import Step2CounterSelectTripAndSeats from "./Step2CounterSelectTripAndSeats";
import Step3CounterCheckout from "./Step3CounterCheckout";
import { PosStepStrip } from "./PosStepStrip";
import { OrderSummaryPanel } from "./OrderSummaryPanel";

const DRAFT_KEY = "posWaterbusBookingDraft";

const initialBookingData = () => ({
  isRoundTrip: false,
  fromWharf: "",
  toWharf: "",
  fromWharfName: "",
  toWharfName: "",
  fromWharfCode: "",
  toWharfCode: "",
  departureDate: getTodayDateString(),
  returnDate: "",
  departureTripOptions: [],
  returnTripOptions: [],
  selectedDepartureTrip: null,
  selectedReturnTrip: null,
  selectedSeatsDeparture: [],
  selectedSeatsReturn: [],
  seatHoldExpiresAt: null,
});

/** Bước đang dở dang suy ra từ draft đã lưu — chỉ dùng khi F5 trang (component thực sự mount lại
 * từ đầu): giữ nguyên đúng bước đang làm dở thay vì nhảy về Step 1. Đổi tab dịch vụ KHÔNG remount
 * (2 flow luôn song song, ẩn/hiện bằng CSS) nên không đi qua đường này — xem effect "reset khi rời tab". */
const deriveStepFromDraft = (draft) => {
  if (!draft) return 1;
  if (draft.seatHoldExpiresAt) return 3;
  if (draft.selectedDepartureTrip) return 2;
  return 1;
};

/** Cùng logic/API với trang khách hàng (Step1Search/Step2SelectTripAndSeats/Step3Checkout) — chỉ đổi khung hiển thị kiểu POS. */
export function WaterbusPOSFlow({ active }) {
  const { lang } = useApp();
  const [bookingData, setBookingData] = useState(() => readBookingDraft(DRAFT_KEY) || initialBookingData());
  const [currentStep, setCurrentStep] = useState(() => deriveStepFromDraft(readBookingDraft(DRAFT_KEY)));

  useEffect(() => {
    writeBookingDraft(DRAFT_KEY, bookingData);
  }, [bookingData]);

  const updateBookingData = (fields) => {
    setBookingData((prev) => ({ ...prev, ...fields }));
  };

  const handleNewSale = useCallback(() => {
    releaseHeldBookingSeats(bookingData);
    clearBookingDraft(DRAFT_KEY);
    setBookingData(initialBookingData());
    setCurrentStep(1);
  }, [bookingData]);

  // Đổi tab dịch vụ → reload lại từ đầu: rời tab này (active true → false) thì nhả ghế đang giữ
  // (nếu có) và reset về Step 1, để lần sau quay lại tab Waterbus luôn bắt đầu mới. F5 trang thì
  // không đi qua effect này (mount lại từ đầu, isFirstRenderRef chặn lần chạy đầu) — giữ nguyên
  // đúng bước đang dở theo deriveStepFromDraft ở trên.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!active) {
      handleNewSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className={active ? "space-y-5" : "hidden"}>
      <div className="grid grid-cols-1 items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:grid-cols-[1fr_auto_1fr]">
        <div className="hidden sm:block" />
        <div className="flex justify-center">
          <PosStepStrip lang={lang} currentStep={currentStep} />
        </div>
        <div className="flex justify-center sm:justify-end">
          <button
            type="button"
            onClick={handleNewSale}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {lang === "VN" ? "Đơn mới" : "New sale"}
          </button>
        </div>
      </div>

      {currentStep === 3 ? (
        <Step3CounterCheckout
          bookingData={bookingData}
          onBack={() => setCurrentStep(2)}
          onExpire={() => {
            updateBookingData({ seatHoldExpiresAt: null });
            setCurrentStep(1);
          }}
          onBookingCreated={() => clearBookingDraft(DRAFT_KEY)}
          onSaleCompleted={handleNewSale}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {currentStep === 1 && (
              <Step1SearchCounter bookingData={bookingData} updateData={updateBookingData} onNext={() => setCurrentStep(2)} />
            )}
            {currentStep === 2 && (
              <Step2CounterSelectTripAndSeats
                bookingData={bookingData}
                updateData={updateBookingData}
                onNext={() => setCurrentStep(3)}
                onBack={() => setCurrentStep(1)}
              />
            )}
          </div>
          <div className="lg:col-span-5">
            <OrderSummaryPanel lang={lang} bookingData={bookingData} />
          </div>
        </div>
      )}
    </div>
  );
}
