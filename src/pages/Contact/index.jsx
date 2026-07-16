import { useApp } from "../../context/AppContext";
import { ContactForm } from "../../components/ContactForm";

export const Contact = () => {
  // Lấy ngôn ngữ hiện tại từ Context
  const { lang } = useApp();

  return (
    <main className="pt-32 pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 min-h-screen select-none">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Khối tiêu đề chính & phụ căn giữa hệ thống, đồng bộ với các section khác */}
        <div className="flex flex-col items-center text-center mb-16 space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
            {lang === "VN" ? "Liên hệ với chúng tôi" : "Get In Touch"}
          </p>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
            {lang === "VN" ? "Luôn lắng nghe, luôn đồng hành cùng bạn" : "Always Here, Always Listening"}
          </h1>
        </div>

        {/* Chia layout 2 cột bất đối xứng */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* CỘT TRÁI (Tỷ lệ 5/12): THÔNG TIN LIÊN HỆ TRỰC TIẾP */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-headline font-bold text-slate-800 dark:text-white">
                {lang === "VN" ? "Thông tin liên hệ" : "Contact Information"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-body leading-relaxed max-w-sm">
                {lang === "VN"
                  ? "Mọi thắc mắc, phản hồi hoặc yêu cầu hỗ trợ kỹ thuật đặt vé, xin vui lòng kết nối trực tiếp với tổng đài đắc lực của chúng tôi."
                  : "For any inquiries, feedback, or technical assistance with booking, please feel free to reach out to our dedicated support center."}
              </p>
            </div>
            {/* Danh sách các khối thẻ thông tin */}
            <div className="space-y-6">
              {/* Hotline hỗ trợ */}
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757]">
                  <span className="material-symbols-outlined text-[22px]">call</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {lang === "VN" ? "Hotline hỗ trợ 24/7" : "Support Hotline"}
                  </p>
                  <p className="text-lg font-headline font-black text-[#124757] dark:text-white">
                    1900 636830
                  </p>
                </div>
              </div>
              {/* Hộp thư điện tử */}
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757]">
                  <span className="material-symbols-outlined text-[22px]">mail</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {lang === "VN" ? "Email giao dịch" : "Email Address"}
                  </p>
                  <a
                    href="mailto:support@waterbus.com"
                    className="text-base font-semibold text-slate-700 dark:text-slate-300 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
                  >
                    support@waterbus.com
                  </a>
                </div>
              </div>
              {/* Trụ sở chính */}
              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400 shrink-0 shadow-sm transition-colors group-hover:bg-yellow-400 group-hover:text-[#124757] mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">location_on</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {lang === "VN" ? "Trụ sở điều hành chính" : "Main Office"}
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed max-w-xs">
                    7 Đ. D1, Long Thạnh Mỹ, Tăng Nhơn Phú, Thành phố Hồ Chí Minh, Việt Nam
                  </p>
                </div>
              </div>
            </div>
            {/* Google Maps Embed */}
            <div className="relative max-w-sm pt-2">
              <div className="w-full rounded-4xl shadow-xl overflow-hidden aspect-video bg-slate-200 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <iframe
                  allowFullScreen=""
                  height="100%"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3219.5870743564146!2d106.8073080740002!3d10.841132857998993!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752731176b07b1%3A0xb752b24b379bae5e!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBGUFQgVFAuIEhDTQ!5e1!3m2!1svi!2s!4v1776262064370!5m2!1svi!2s"
                  style={{ border: 0 }}
                  width="100%"
                  className="dark:invert dark:grayscale-80 dark:hue-rotate-180 transition-all duration-500"
                ></iframe>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (Tỷ lệ 7/12): FORM GỬI TIN NHẮN (tái sử dụng chung với trang Home) */}
          <div className="lg:col-span-7">
            <ContactForm />
          </div>
        </div>
      </div>
    </main>
  );
};
