import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import { getTodayDateString } from "../../../../utils/dateOnly";
import { readBookingDraft, writeBookingDraft, clearBookingDraft } from "../../../../utils/bookingDraftStorage";
import { releaseHeldBookingSeats } from "../../../../utils/bookingWizardGuard";

import Step1SearchSightseeing from "../../../WatersightseeingBooking/components/Step1SearchSightseeing";
import Step2SelectTripAndSeats from "../../../WaterbusBooking/components/Step2SelectTripAndSeats";
import Step3Checkout from "../../../WaterbusBooking/components/Step3Checkout";
import { PosStepStrip } from "./PosStepStrip";
import { OrderSummaryRail } from "./OrderSummaryRail";

const DRAFT_KEY = "posSightseeingBookingDraft";

const initialBookingData = () => ({
  isRoundTrip: false,
  fromWharf: "",
  toWharf: "",
  departureDate: getTodayDateString(),
  returnDate: "",
  passengerCount: 1,
  selectedDepartureTrip: null,
  selectedReturnTrip: null,
  selectedSeatsDeparture: [],
  selectedSeatsReturn: [],
  seatHoldExpiresAt: null,
});

/** Cùng logic/API với trang khách hàng (Step1SearchSightseeing + Step2/Step3 dùng chung với Waterbus) — chỉ đổi khung hiển thị kiểu POS. */
export function SightseeingPOSFlow({ active }) {
  const { lang } = useApp();
  const [bookingData, setBookingData] = useState(() => readBookingDraft(DRAFT_KEY) || initialBookingData());
  const [currentStep, setCurrentStep] = useState(1);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingData]);

  return (
    <div className={active ? "space-y-5" : "hidden"}>
      <div className="rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <PosStepStrip lang={lang} currentStep={currentStep} />
      </div>

      <OrderSummaryRail
        lang={lang}
        service="sightseeing"
        bookingData={bookingData}
        currentStep={currentStep}
        onNewSale={handleNewSale}
      />

      <div>
        {currentStep === 1 && (
          <Step1SearchSightseeing
            bookingData={bookingData}
            updateData={updateBookingData}
            onNext={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 2 && (
          <Step2SelectTripAndSeats
            bookingData={bookingData}
            updateData={updateBookingData}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <Step3Checkout
            bookingData={bookingData}
            onBack={() => setCurrentStep(2)}
            onExpire={() => {
              updateBookingData({ seatHoldExpiresAt: null });
              setCurrentStep(1);
            }}
            onBookingCreated={() => clearBookingDraft(DRAFT_KEY)}
            hideUseAccountInfo
          />
        )}
      </div>
    </div>
  );
}
