import { useApp } from "../../../context/AppContext";

export default function Step1Search({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { isRoundTrip, fromWharf, toWharf, departureDate, returnDate, passengerCount } = bookingData;

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6">
      <h2 className="text-2xl font-headline font-bold text-[#124757] dark:text-white border-b pb-3">
        {lang === "VN" ? "Tra cứu thông tin hành trình" : "Search Waterbus Journey"}
      </h2>

      {/* Một chiều / Khứ hồi */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => updateData({ isRoundTrip: false })}
          className={`px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-all ${
            !isRoundTrip ? "bg-[#124757] text-white shadow-md" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {lang === "VN" ? "Một chiều" : "One-Way"}
        </button>
        <button
          type="button"
          onClick={() => updateData({ isRoundTrip: true })}
          className={`px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-all ${
            isRoundTrip ? "bg-[#124757] text-white shadow-md" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {lang === "VN" ? "Khứ hồi" : "Round-Trip"}
        </button>
      </div>

      {/* Điểm đi / Điểm đến */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đi" : "From"}</label>
          <select value={fromWharf} onChange={(e) => updateData({ fromWharf: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
            <option value="">-- {lang === "VN" ? "Chọn bến xuất phát" : "Select Departure Wharf"} --</option>
            <option value="bach-dang">Bến Bạch Đằng (Q.1)</option>
            <option value="thu-thiem">Bến Thủ Thiêm</option>
            <option value="linh-dong">Bến Linh Đông</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đến" : "To"}</label>
          <select value={toWharf} onChange={(e) => updateData({ toWharf: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]">
            <option value="">-- {lang === "VN" ? "Chọn bến cập bến" : "Select Destination Wharf"} --</option>
            <option value="bach-dang">Bến Bạch Đằng (Q.1)</option>
            <option value="thu-thiem">Bến Thủ Thiêm</option>
            <option value="linh-dong">Bến Linh Đông</option>
          </select>
        </div>
      </div>

      {/* Ngày đi / Ngày về */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày đi" : "Departure Date"}</label>
          <input type="date" value={departureDate} onChange={(e) => updateData({ departureDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
        </div>
        {isRoundTrip && (
          <div className="space-y-2 animate-fade-in">
            <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày về" : "Return Date"}</label>
            <input type="date" value={returnDate} min={departureDate} onChange={(e) => updateData({ returnDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]" />
          </div>
        )}
      </div>

      {/* Số lượng khách */}
      <div className="space-y-2 max-w-[200px]">
        <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Số lượng khách" : "Passengers"}</label>
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-inner">
          <button type="button" disabled={passengerCount <= 1} onClick={() => updateData({ passengerCount: passengerCount - 1 })} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center font-bold border disabled:opacity-40">-</button>
          <span className="font-headline font-black text-lg text-[#124757] dark:text-white">{passengerCount}</span>
          <button type="button" onClick={() => updateData({ passengerCount: passengerCount + 1 })} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center font-bold border">+</button>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="button"
          disabled={!fromWharf || !toWharf || !departureDate || (isRoundTrip && !returnDate)}
          onClick={onNext}
          className="bg-[#FFD100] text-[#124757] font-headline font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-xl shadow-md hover:brightness-105 transition-all disabled:opacity-40"
        >
          {lang === "VN" ? "Tìm vé chuyến tàu" : "Search Routes Now"}
        </button>
      </div>
    </div>
  );
}