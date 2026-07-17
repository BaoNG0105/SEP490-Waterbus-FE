import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { guidelines } from "../../data/homeData";

import Step1Search from "./components/Step1Search";
import Step2SelectTripAndSeats from "./components/Step2SelectTripAndSeats";
import Step3Checkout from "./components/Step3Checkout";

export function WaterbusBooking() {
    const { lang } = useApp();
    const location = useLocation();

    const [currentStep, setCurrentStep] = useState(location.state?.step || 1);
    const [bookingData, setBookingData] = useState(
        location.state?.bookingData || {
            isRoundTrip: false,
            fromWharf: "",
            toWharf: "",
            fromWharfName: "",
            toWharfName: "",
            departureDate: "",
            returnDate: "",
            departureTripOptions: [],
            returnTripOptions: [],
            selectedDepartureTrip: null,
            selectedReturnTrip: null,
            selectedSeatsDeparture: [],
            selectedSeatsReturn: [],
            seatHoldExpiresAt: null,
        }
    );

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentStep]);

    const updateBookingData = (fields) => {
        setBookingData((prev) => ({ ...prev, ...fields }));
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300">
            {/* ===== SECTION 1: HERO ===== */}
            <section
                className="relative bg-[#124757] dark:bg-slate-950 overflow-hidden pt-32 pb-20 bg-cover bg-center"
                style={{ backgroundImage: "url('https://res.cloudinary.com/dygipvoal/image/upload/v1783792724/cqi2n26pl7etht4ad5q3.webp')" }}
            >
                <div className="absolute inset-0 bg-[#124757]/70 dark:bg-slate-950/70 pointer-events-none"></div>
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-[420px] absolute -right-16 -top-16 text-white">directions_boat</span>
                </div>
                <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center space-y-6">
                    <h1 className="text-4xl md:text-6xl font-headline font-black text-white leading-tight">
                        {lang === "VN" ? "Đặt vé Waterbus" : "Waterbus Ticket Booking"}
                    </h1>
                    <p className="text-white/70 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                        {lang === "VN"
                            ? "Di chuyển nhanh chóng theo lịch trình cố định giữa các bến tàu. Tìm chuyến, chọn ghế và thanh toán trực tuyến chỉ trong vài bước đơn giản."
                            : "Travel quickly along fixed schedules between wharves. Search a trip, choose your seat, and pay online in just a few simple steps."}
                    </p>
                </div>
            </section>

            {/* ===== SECTION 2: BOOKING WIZARD ===== */}
            <main className="relative max-w-7xl w-full mx-auto px-4 md:px-8 py-20 select-none">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>

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
                    <Step3Checkout
                        bookingData={bookingData}
                        onBack={() => setCurrentStep(2)}
                        onExpire={() => {
                            updateBookingData({ seatHoldExpiresAt: null });
                            setCurrentStep(1);
                        }}
                    />
                )}

            </main>

            {/* ===== SECTION 3: SERVICE INTRODUCTION ===== */}
            <section className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col items-center text-center mb-14 space-y-4">
                        <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                            {lang === "VN" ? "Vì sao chọn đặt vé Waterbus" : "Why Choose Waterbus Booking"}
                        </p>
                        <h2 className="text-3xl md:text-4xl font-headline font-bold text-[#124757] dark:text-white max-w-2xl">
                            {lang === "VN" ? "Đặt vé nhanh chóng, minh bạch và tiện lợi" : "Fast, transparent, and convenient ticketing"}
                        </h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "schedule", titleVn: "Lịch trình cố định", titleEn: "Fixed Schedule", descVn: "Các chuyến tàu chạy đúng giờ theo lịch trình cố định giữa các bến.", descEn: "Vessels depart on time along a fixed schedule between wharves." },
                            { icon: "event_seat", titleVn: "Chọn ghế trực quan", titleEn: "Visual Seat Selection", descVn: "Xem sơ đồ tàu và chọn vị trí ghế ngồi yêu thích chỉ trong vài giây.", descEn: "View the vessel layout and pick your favorite seat in seconds." },
                            { icon: "qr_code_2", titleVn: "Vé điện tử QR", titleEn: "E-Ticket QR Code", descVn: "Nhận vé điện tử ngay lập tức, không cần in giấy, quét mã khi lên tàu.", descEn: "Get an instant e-ticket, no printing needed — just scan to board." },
                            { icon: "support_agent", titleVn: "Hỗ trợ tận tâm", titleEn: "Dedicated Support", descVn: "Đội ngũ hỗ trợ luôn sẵn sàng giải đáp mọi thắc mắc trong suốt hành trình.", descEn: "Our support team is ready to help throughout your journey." },
                        ].map((item) => (
                            <div key={item.icon} className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                                <div className="w-12 h-12 rounded-2xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                                </div>
                                <h3 className="font-headline font-black text-slate-800 dark:text-white text-sm uppercase tracking-wide">
                                    {lang === "VN" ? item.titleVn : item.titleEn}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {lang === "VN" ? item.descVn : item.descEn}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

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
                                <div className="aspect-4/3 rounded-2xl overflow-hidden shadow-md mb-6">
                                    <img
                                        src={guide.image}
                                        alt={`Guideline step ${index + 1}`}
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
