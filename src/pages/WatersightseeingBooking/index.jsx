import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { guidelines } from "../../data/homeData";
import { getTodayDateString } from "../../utils/dateOnly";
import { useBookingWizardStep } from "../../hooks/useBookingWizardStep";
import { useRequireAuthGate } from "../../hooks/useRequireAuthGate";
import { readBookingDraft, writeBookingDraft, clearBookingDraft } from "../../utils/bookingDraftStorage";
import {
  bookingHasSeatSelection,
  clearSeatSelectionFields,
  confirmLeaveCheckout,
  confirmLeaveSeatSelection,
  releaseHeldBookingSeats,
} from "../../utils/bookingWizardGuard";

import Step1SearchSightseeing from "./components/Step1SearchSightseeing";
import Step2SelectTripAndSeats from "../WaterbusBooking/components/Step2SelectTripAndSeats";
import Step3Checkout from "../WaterbusBooking/components/Step3Checkout";

const DRAFT_KEY = "sightseeingBookingDraft";

export function WatersightseeingBooking() {
    const { lang } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    useRequireAuthGate();

    const [bookingData, setBookingData] = useState(
        location.state?.bookingData || readBookingDraft(DRAFT_KEY) || {
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
        }
    );

    useEffect(() => {
        writeBookingDraft(DRAFT_KEY, bookingData);
    }, [bookingData]);

    const updateBookingData = (fields) => {
        setBookingData((prev) => ({ ...prev, ...fields }));
    };

    const exitBookingToHome = useCallback(() => {
        updateBookingData(clearSeatSelectionFields());
        clearBookingDraft(DRAFT_KEY);
        navigate("/", { replace: true });
    }, [navigate]);

    const confirmLeaveStep = useCallback(async (fromStep, toStep) => {
        if (toStep >= fromStep) return true;

        // Bước 2 → thoát hẳn về Home (không kẹt lại step 2 đã xóa ghế / không về step 1).
        if (fromStep === 2) {
            if (!bookingHasSeatSelection(bookingData)) {
                exitBookingToHome();
                return false;
            }
            const ok = await confirmLeaveSeatSelection(lang, { leaveTarget: "home" });
            if (!ok) return false;
            exitBookingToHome();
            return false;
        }

        if (fromStep === 3) {
            const ok = await confirmLeaveCheckout(lang);
            if (!ok) return false;
            releaseHeldBookingSeats(bookingData);
            updateBookingData({ seatHoldExpiresAt: null });
            return true;
        }

        // Bước 1 ← back trình duyệt: về Home.
        if (fromStep === 1) {
            navigate("/", { replace: true });
            return false;
        }

        return true;
    }, [bookingData, exitBookingToHome, lang, navigate]);

    const { currentStep, goToStep } = useBookingWizardStep({
        initialStep: location.state?.step || 1,
        confirmLeaveStep,
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300">
            {/* ===== SECTION 1: HERO ===== */}
            <section
                className="relative bg-[#124757] dark:bg-slate-950 overflow-hidden pt-32 pb-20 bg-cover bg-center"
                style={{ backgroundImage: "url('https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/water-sightseeing.webp')" }}
            >
                <div className="absolute inset-0 bg-[#124757]/70 dark:bg-slate-950/70 pointer-events-none"></div>
                <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center space-y-6">
                    <h1 className="text-4xl md:text-6xl font-headline font-black text-white leading-tight">
                        {lang === "VN" ? "Tour tham quan trên sông" : "River sightseeing tour"}
                    </h1>
                    <p className="text-white/70 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                        {lang === "VN"
                            ? "Thư giãn trên tàu, ngắm cảnh sông Sài Gòn theo lịch trình vòng quanh các bến. Chọn ngày, chọn ghế và thanh toán trực tuyến chỉ trong vài bước."
                            : "Relax on board and enjoy Saigon’s river views on a scheduled loop tour. Pick a date, choose your seat, and pay online in a few simple steps."}
                    </p>
                </div>
            </section>

            {/* ===== SECTION 2: BOOKING WIZARD ===== */}
            <main className="relative max-w-7xl w-full mx-auto px-4 md:px-8 py-20 select-none">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* --- STEPPER 3 BƯỚC TINH GỌN --- */}
                <div className="w-full max-w-3xl mx-auto mb-12 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                    <div className="grid grid-cols-3">
                        {[
                            { step: 1, labelVn: "Tìm chuyến", labelEn: "Search" },
                            { step: 2, labelVn: "Chọn chuyến & ghế", labelEn: "Trip & Seats" },
                            { step: 3, labelVn: "Thanh toán", labelEn: "Payment" }
                        ].map((item, index, list) => {
                            const isDone = currentStep > item.step;
                            const isActive = currentStep === item.step;
                            const isReached = currentStep >= item.step;
                            const prevReached = index === 0 || currentStep >= list[index - 1].step;
                            const leftActive = index > 0 && prevReached && isReached;
                            const rightActive = index < list.length - 1 && isReached && currentStep >= list[index + 1].step;

                            return (
                                <div key={item.step} className="flex min-w-0 flex-col items-center gap-2">
                                    <div className="flex w-full items-center">
                                        <div
                                            className={`h-0.5 flex-1 ${index === 0
                                                ? "bg-transparent"
                                                : leftActive
                                                    ? "bg-[#124757] dark:bg-[#FFD100]"
                                                    : "bg-slate-200 dark:bg-slate-700"
                                                }`}
                                        />
                                        <div
                                            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-headline text-sm font-bold shadow-sm transition-all duration-300 ${isReached
                                                ? "bg-[#124757] text-white ring-4 ring-[#FFD100]/20"
                                                : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                                }`}
                                        >
                                            {isDone
                                                ? <span className="material-symbols-outlined text-sm font-bold">check</span>
                                                : item.step}
                                        </div>
                                        <div
                                            className={`h-0.5 flex-1 ${index === list.length - 1
                                                ? "bg-transparent"
                                                : rightActive || (isReached && currentStep > item.step)
                                                    ? "bg-[#124757] dark:bg-[#FFD100]"
                                                    : "bg-slate-200 dark:bg-slate-700"
                                                }`}
                                        />
                                    </div>
                                    <span
                                        className={`max-w-full truncate px-1 text-center text-[11px] font-headline font-bold sm:text-xs ${isActive
                                            ? "text-[#124757] dark:text-[#FFD100]"
                                            : "text-slate-400"
                                            }`}
                                    >
                                        {lang === "VN" ? item.labelVn : item.labelEn}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* --- ĐIỀU HƯỚNG BƯỚC --- */}
                {currentStep === 1 && (
                    <Step1SearchSightseeing bookingData={bookingData} updateData={updateBookingData} onNext={() => goToStep(2)} />
                )}

                {currentStep === 2 && (
                    <Step2SelectTripAndSeats
                        bookingData={bookingData}
                        updateData={updateBookingData}
                        onNext={() => goToStep(3)}
                        onBack={exitBookingToHome}
                        leaveTarget="home"
                    />
                )}

                {currentStep === 3 && (
                    <Step3Checkout
                        bookingData={bookingData}
                        onBack={() => goToStep(2)}
                        onExpire={() => {
                            updateBookingData({ seatHoldExpiresAt: null });
                            goToStep(1, { replace: true });
                        }}
                        onBookingCreated={() => clearBookingDraft(DRAFT_KEY)}
                    />
                )}

            </main>

            {/* ===== SECTION 4: STEPS GUIDE ===== */}
            <section className="py-20 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300 select-none">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col items-center text-center mb-14 space-y-4">
                        <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                            {lang === "VN" ? "Quy trình đơn giản" : "Simple Process"}
                        </p>
                        <h2 className="text-3xl md:text-4xl font-headline font-bold text-[#124757] dark:text-white max-w-2xl">
                            {lang === "VN" ? "Hướng dẫn đặt vé" : "Ticketing Guide"}
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
                        {guidelines.map((guide, index) => (
                            <div key={guide.id} className="flex flex-col group">
                                <div className="text-5xl font-headline font-black text-yellow-500 dark:text-yellow-400 mb-4 transition-transform duration-300 group-hover:-translate-y-2">
                                    0{index + 1}
                                </div>
                                <div className="aspect-square rounded-2xl overflow-hidden shadow-md mb-6">
                                    <img
                                        src={guide.image}
                                        alt={`Guideline step ${guide.id}`}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                </div>
                                <h3 className="text-lg font-headline font-bold text-[#124757] dark:text-white mb-2">
                                    {lang === "VN" ? guide.titleVn : guide.titleEn}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {lang === "VN" ? guide.descVn : guide.descEn}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
