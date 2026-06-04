import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

import Step1Search from "./components/Step1Search";
import Step2SelectTripAndSeats from "./components/Step2SelectTripAndSeats";
import Step3Checkout from "./components/Step3Checkout";

export function Booking() {
    const { lang } = useApp();
    const location = useLocation();

    const [currentStep, setCurrentStep] = useState(location.state?.step || 1);
    const [bookingData, setBookingData] = useState(
        location.state?.bookingData || {
            isRoundTrip: false,
            fromWharf: "",
            toWharf: "",
            departureDate: "",
            returnDate: "",
            passengerCount: 1,
            selectedDepartureTrip: null,
            selectedReturnTrip: null,
            selectedSeatsDeparture: [],
            selectedSeatsReturn: [],
        }
    );

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentStep]);

    const updateBookingData = (fields) => {
        setBookingData((prev) => ({ ...prev, ...fields }));
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-body transition-colors duration-300">
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 pt-32 pb-24 select-none">

                {/* --- STEPPER 3 BƯỚC TINH GỌN --- */}
                <div className="w-full max-w-3xl mx-auto mb-12 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 z-0"></div>

                        {[
                            { step: 1, labelVn: "Tìm chuyến", labelEn: "Search" },
                            { step: 2, labelVn: "Chọn chuyến & ghế", labelEn: "Trip & Seats" },
                            { step: 3, labelVn: "Thanh toán", labelEn: "Payment" }
                        ].map((item) => (
                            <div key={item.step} className="relative z-10 flex flex-col items-center space-y-2">
                                <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center font-headline font-bold text-sm shadow-sm transition-all duration-300 ${currentStep >= item.step
                                            ? "bg-[#124757] text-white ring-4 ring-[#FFD100]/20"
                                            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                        }`}
                                >
                                    {currentStep > item.step ? <span className="material-symbols-outlined text-sm font-bold">check</span> : item.step}
                                </div>
                                <span className={`text-xs font-headline font-bold hidden sm:block ${currentStep === item.step ? "text-[#124757] dark:text-[#FFD100]" : "text-slate-400"
                                    }`}>
                                    {lang === "VN" ? item.labelVn : item.labelEn}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- ĐIỀU HƯỚNG BƯỚC --- */}
                {currentStep === 1 && (
                    <Step1Search bookingData={bookingData} updateData={updateBookingData} onNext={() => setCurrentStep(2)} />
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
                    <Step3Checkout bookingData={bookingData} onBack={() => setCurrentStep(2)} />
                )}

            </main>
        </div>
    );
}