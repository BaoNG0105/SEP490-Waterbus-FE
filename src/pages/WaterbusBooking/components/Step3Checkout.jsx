import { useState } from "react";
import { useApp } from "../../../context/AppContext";

export default function Step3Checkout({ bookingData, onBack }) {
  const { lang } = useApp();
  const { 
    isRoundTrip, 
    fromWharf, 
    toWharf, 
    departureDate, 
    returnDate, 
    selectedDepartureTrip, 
    selectedReturnTrip,
    selectedSeatsDeparture, 
    selectedSeatsReturn 
  } = bookingData;

  // 1. STATE: THÔNG TIN LIÊN HỆ (Người đặt vé)
  const [contact, setContact] = useState({ 
    name: "", 
    phone: "", 
    email: "", 
    notes: "" 
  });

  // 2. STATE: THÔNG TIN TỪNG HÀNH KHÁCH
  // Khởi tạo mảng object chứa 4 trường dữ liệu cho mỗi hành khách (tương ứng với số ghế đã chọn)
  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedSeatsDeparture.length }, () => ({
      name: "",
      birthYear: "",
      gender: "Nam", // Nam, Nữ, Khác
      nationality: "Việt Nam" // Mặc định là Việt Nam
    }))
  );

  // Hàm xử lý khi thay đổi dữ liệu của 1 hành khách
  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  // 3. STATE: MÃ GIẢM GIÁ & TÍNH TIỀN
  const [promoCode, setPromoCode] = useState("");
  const [isApplied, setIsApplied] = useState(false);

  const ticketPrice = 15000;
  // Tổng số lượng ghế = Ghế chiều đi + Ghế chiều về (nếu có)
  const totalSeatsCount = isRoundTrip 
    ? (selectedSeatsDeparture.length + selectedSeatsReturn.length) 
    : selectedSeatsDeparture.length;
    
  const subtotal = totalSeatsCount * ticketPrice;
  const discount = isApplied ? subtotal * 0.1 : 0; // Giảm 10% nếu có mã
  const totalAmount = subtotal - discount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* CỘT TRÁI (7/12) - CÁC FORM ĐIỀN THÔNG TIN */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* 1. FORM THÔNG TIN LIÊN HỆ */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">contact_mail</span>
            {lang === "VN" ? "Thông tin liên hệ (Người đặt)" : "Contact Details"}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Họ và tên *" : "Full Name *"}</label>
              <input type="text" placeholder="Nguyễn Văn A" value={contact.name} onChange={(e) => setContact({...contact, name: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Số điện thoại *" : "Phone Number *"}</label>
              <input type="tel" placeholder="0901234567" value={contact.phone} onChange={(e) => setContact({...contact, phone: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Địa chỉ Email *" : "Email Address *"}</label>
            <input type="email" placeholder="example@domain.com" value={contact.email} onChange={(e) => setContact({...contact, email: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Ghi chú (Không bắt buộc)" : "Notes (Optional)"}</label>
            <textarea 
              rows="2" 
              placeholder={lang === "VN" ? "Nhập yêu cầu đặc biệt nếu có..." : "Any special requests..."} 
              value={contact.notes} 
              onChange={(e) => setContact({...contact, notes: e.target.value})} 
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors resize-none" 
            />
          </div>
        </div>

        {/* 2. FORM THÔNG TIN HÀNH KHÁCH (Dạng Card cho từng người) */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">group</span>
            {lang === "VN" ? "Khai báo thông tin hành khách" : "Passenger Declarations"}
          </h3>
          
          <div className="space-y-5 max-h-500px overflow-y-auto pr-2 custom-scrollbar">
            {passengers.map((passenger, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                
                {/* Header của thẻ hành khách hiển thị ghế tương ứng */}
                <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-700 pb-3">
                  <div className="bg-[#124757] text-[#FFD100] w-8 h-8 rounded-full flex items-center justify-center font-headline font-black text-sm shadow-sm">
                    {index + 1}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="font-headline font-bold text-[#124757] dark:text-white">
                      {lang === "VN" ? `Hành khách ${index + 1}` : `Passenger ${index + 1}`}
                    </span>
                    <div className="flex gap-2">
                      <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                        Đi: {selectedSeatsDeparture[index]}
                      </span>
                      {isRoundTrip && (
                        <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                          Về: {selectedSeatsReturn[index]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Các trường điền thông tin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên" : "Full Name"}</label>
                    <input 
                      type="text" 
                      value={passenger.name}
                      onChange={(e) => handlePassengerChange(index, "name", e.target.value)}
                      placeholder={lang === "VN" ? "Nhập tên in hoa không dấu..." : "Enter full name..."}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]" 
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Năm sinh" : "Birth Year"}</label>
                    <input 
                      type="number" 
                      min="1900" 
                      max={new Date().getFullYear()}
                      value={passenger.birthYear}
                      onChange={(e) => handlePassengerChange(index, "birthYear", e.target.value)}
                      placeholder="YYYY"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]" 
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Giới tính" : "Gender"}</label>
                    <select 
                      value={passenger.gender}
                      onChange={(e) => handlePassengerChange(index, "gender", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    >
                      <option value="Nam">{lang === "VN" ? "Nam" : "Male"}</option>
                      <option value="Nữ">{lang === "VN" ? "Nữ" : "Female"}</option>
                      <option value="Khác">{lang === "VN" ? "Khác" : "Other"}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
                    <input 
                      type="text" 
                      value={passenger.nationality}
                      onChange={(e) => handlePassengerChange(index, "nationality", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]" 
                      required 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PHƯƠNG THỨC THANH TOÁN */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-4">
          <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">payments</span>
            {lang === "VN" ? "Phương thức thanh toán" : "Payment Method"}
          </h3>
          <label className="flex items-center gap-4 border-2 border-[#124757] p-5 rounded-2xl bg-teal-50/30 dark:bg-[#124757]/20 cursor-pointer shadow-sm transition-all hover:shadow-md">
            <input type="radio" defaultChecked className="accent-[#124757] w-5 h-5" />
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="QR" className="w-8 h-8 opacity-80" />
              </div>
              <div>
                <p className="text-base font-bold text-[#124757] dark:text-[#FFD100]">
                  {lang === "VN" ? "Chuyển khoản Ngân hàng (VietQR)" : "Bank Transfer via VietQR"}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {lang === "VN" ? "Quét mã QR để thanh toán an toàn và tự động duyệt 24/7" : "Scan QR code for instant, automated and secure payment"}
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* CỘT PHẢI (5/12) - BILL TÍNH HÓA ĐƠN & ĐẶT VÉ */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6 sticky top-28">
        <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FFD100]">receipt_long</span>
          {lang === "VN" ? "Chi tiết hóa đơn" : "Invoice Summary"}
        </h3>

        {/* Khung tóm tắt tuyến đi */}
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 text-[10px] font-bold uppercase px-2 py-1 rounded">
                {lang === "VN" ? "Chiều đi" : "Departure"}
              </span>
              <span className="text-xs font-bold text-slate-500">{departureDate}</span>
            </div>
            <div className="font-headline font-black text-[#124757] dark:text-white flex items-center gap-2 text-lg">
              {fromWharf.toUpperCase()} 
              <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span> 
              {toWharf.toUpperCase()}
            </div>
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2">
              {lang === "VN" ? "Giờ khởi hành:" : "Time:"} <span className="text-[#124757] dark:text-[#FFD100]">{selectedDepartureTrip?.time}</span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              Ghế: {selectedSeatsDeparture.join(", ")}
            </div>
          </div>

          {/* Chiều về (nếu có) */}
          {isRoundTrip && (
            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-[10px] font-bold uppercase px-2 py-1 rounded">
                  {lang === "VN" ? "Chiều về" : "Return"}
                </span>
                <span className="text-xs font-bold text-slate-500">{returnDate}</span>
              </div>
              <div className="font-headline font-black text-[#124757] dark:text-white flex items-center gap-2 text-lg">
                {toWharf.toUpperCase()} 
                <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span> 
                {fromWharf.toUpperCase()}
              </div>
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2">
                {lang === "VN" ? "Giờ khởi hành:" : "Time:"} <span className="text-[#124757] dark:text-[#FFD100]">{selectedReturnTrip?.time}</span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Ghế: {selectedSeatsReturn.join(", ")}
              </div>
            </div>
          )}
        </div>

        {/* Nhập mã giảm giá */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{lang === "VN" ? "Mã ưu đãi (Promotion Code)" : "Discount Code"}</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="SWB..." 
              value={promoCode} 
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())} 
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm uppercase outline-none tracking-widest font-black text-[#124757] dark:text-white" 
            />
            <button 
              type="button" 
              onClick={() => setIsApplied(!isApplied)} 
              className="bg-[#124757] text-[#FFD100] dark:bg-[#FFD100] dark:text-[#124757] px-5 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-sm"
            >
              {isApplied ? "Hủy" : "Áp dụng"}
            </button>
          </div>
          {isApplied && <p className="text-xs font-bold text-green-600 mt-1">✓ Áp dụng thành công (-10%)</p>}
        </div>

        {/* Bảng giá chi tiết */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700 text-sm font-medium">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{lang === "VN" ? "Giá vé cơ bản / Ghế" : "Base Fare / Seat"}</span>
            <span>{ticketPrice.toLocaleString()} VND</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{lang === "VN" ? "Tổng số lượng ghế" : "Total Seats Quantity"}</span>
            <span className="font-bold">x{totalSeatsCount}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600 font-bold">
              <span>{lang === "VN" ? "Giảm giá (10%)" : "Discount (10%)"}</span>
              <span>-{discount.toLocaleString()} VND</span>
            </div>
          )}
          
          <div className="flex justify-between items-end pt-4 border-t border-dashed border-slate-300 dark:border-slate-600">
            <span className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Tổng cộng:" : "Grand Total:"}
            </span>
            <span className="text-3xl font-headline font-black text-[#124757] dark:text-[#FFD100]">
              {totalAmount.toLocaleString()} <span className="text-lg">VND</span>
            </span>
          </div>
        </div>

        {/* Hành động */}
        <div className="pt-2 space-y-4">
          <button 
            type="button" 
            onClick={() => alert("Chuyển hướng đến cổng VietQR... / Redirecting to VietQR...")} 
            className="w-full bg-[#FFD100] text-[#124757] font-headline font-black uppercase tracking-wider py-4 rounded-2xl text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
          >
            {lang === "VN" ? "Thanh toán an toàn" : "Pay Securely Now"}
            <span className="material-symbols-outlined">lock</span>
          </button>
          <button 
            type="button" 
            onClick={onBack} 
            className="w-full text-center text-xs font-bold text-slate-400 hover:text-[#124757] dark:hover:text-white transition-colors"
          >
            {lang === "VN" ? "← Quay lại sửa chọn chuyến/ghế" : "← Back to seats selection"}
          </button>
        </div>

      </div>
    </div>
  );
}