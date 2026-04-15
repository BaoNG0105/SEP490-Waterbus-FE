import { useApp } from "../../context/AppContext";

export const Contact = () => {
  // Lấy ngôn ngữ hiện tại từ Context
  const { lang } = useApp();

  return (
    <main className="pt-40 pb-24 px-6 min-h-screen bg-surface dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Cột Trái */}
        <div>
          {/* Thông tin liên hệ */}
          <h1 className="text-5xl font-bold mb-4 font-headline text-slate-900 dark:text-white">
            {lang === "VN" ? "Liên hệ" : "Contact Us"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-12 tracking-wide uppercase font-body text-sm">
            FPT UNIVERSITY (Ho Chi Minh City Campus)
          </p>

          {/* Hotline */}
          <div className="mb-12">
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-2 font-label font-bold uppercase tracking-widest">
              {lang === "VN" ? "Tổng đài hỗ trợ" : "Customer Support"}
            </p>
            <p className="text-5xl font-bold text-primary dark:text-yellow-400 font-headline">
              1900.636.830
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Địa chỉ */}
            <div>
              <h3 className="text-slate-400 dark:text-slate-500 text-sm font-bold mb-3 uppercase tracking-tighter font-label">
                {lang === "VN" ? "Địa chỉ văn phòng" : "Office Address"}
              </h3>
              <p className="font-bold text-slate-900 dark:text-white leading-relaxed font-body">
                7 Đ. D1, Long Thạnh Mỹ
                <br />
                Tăng Nhơn Phú, Hồ Chí Minh
              </p>
            </div>

            {/* Email */}
            <div>
              <h3 className="text-slate-400 dark:text-slate-500 text-sm font-bold mb-3 uppercase tracking-tighter font-label">
                Email
              </h3>
              <a
                className="font-bold text-slate-900 dark:text-white hover:text-primary dark:hover:text-yellow-400 transition-colors font-body"
                href="mailto:info@saigonwaterbus.com"
              >
                support@waterbus.com
              </a>
            </div>
          </div>

          {/* Google Maps Embed */}
          <div className="relative max-w-sm">
            <div className="w-full rounded-2xl shadow-xl overflow-hidden aspect-video bg-slate-200 dark:bg-slate-800">
              <iframe
                allowFullScreen=""
                height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3219.5870743564146!2d106.8073080740002!3d10.841132857998993!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752731176b07b1%3A0xb752b24b379bae5e!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBGUFQgVFAuIEhDTQ!5e1!3m2!1svi!2s!4v1776262064370!5m2!1svi!2s"
                style={{ border: 0 }}
                width="100%"
                className="dark:invert dark:grayscale-[80%] dark:hue-rotate-180 transition-all duration-500"
              ></iframe>
            </div>
          </div>
        </div>

        {/* Cột Phải: Form Điền Thông Tin */}
        <div className="bg-surface-container-low dark:bg-slate-800 p-8 md:p-12 rounded-[2.5rem] border border-surface-variant dark:border-slate-700 shadow-xl transition-colors duration-300">
          <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
            {/* Tên */}
            <div className="flex flex-col group">
              <label
                className="text-slate-400 dark:text-white/60 text-sm mb-2 font-label font-bold uppercase tracking-widest transition-colors group-focus-within:text-primary dark:group-focus-within:text-yellow-400"
                htmlFor="name"
              >
                {lang === "VN" ? "Họ và Tên" : "Your Name"}
              </label>
              <input
                className="w-full bg-transparent border-t-0 border-l-0 border-r-0 border-b-2 border-surface-variant dark:border-slate-600 focus:ring-0 focus:border-primary dark:focus:border-yellow-400 px-0 py-2 text-lg font-body text-slate-900 dark:text-white outline-none transition-colors"
                id="name"
                name="name"
                type="text"
                required
              />
            </div>

            {/* Email */}
            <div className="flex flex-col group">
              <label
                className="text-slate-400 dark:text-white/60 text-sm mb-2 font-label font-bold uppercase tracking-widest transition-colors group-focus-within:text-primary dark:group-focus-within:text-yellow-400"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="w-full bg-transparent border-t-0 border-l-0 border-r-0 border-b-2 border-surface-variant dark:border-slate-600 focus:ring-0 focus:border-primary dark:focus:border-yellow-400 px-0 py-2 text-lg font-body text-slate-900 dark:text-white outline-none transition-colors"
                id="email"
                name="email"
                type="email"
                required
              />
            </div>

            {/* Tin nhắn */}
            <div className="flex flex-col group">
              <label
                className="text-slate-400 dark:text-white/60 text-sm mb-2 font-label font-bold uppercase tracking-widest transition-colors group-focus-within:text-primary dark:group-focus-within:text-yellow-400"
                htmlFor="message"
              >
                {lang === "VN" ? "Nội dung tin nhắn" : "Message"}
              </label>
              <textarea
                className="w-full bg-transparent border-t-0 border-l-0 border-r-0 border-b-2 border-surface-variant dark:border-slate-600 focus:ring-0 focus:border-primary dark:focus:border-yellow-400 px-0 py-2 text-lg font-body text-slate-900 dark:text-white outline-none transition-colors resize-none"
                id="message"
                name="message"
                rows="4"
                required
              ></textarea>
            </div>

            {/* Nút Submit */}
            <div className="pt-6">
              <button
                className="w-full bg-primary dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 font-bold px-10 py-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:brightness-110 shadow-lg group"
                type="submit"
              >
                <span className="text-2xl group-hover:rotate-90 transition-transform duration-300 font-light">
                  +
                </span>
                <span className="uppercase tracking-widest text-sm font-headline">
                  {lang === "VN" ? "Gửi Tin Nhắn" : "Send Message"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
};
