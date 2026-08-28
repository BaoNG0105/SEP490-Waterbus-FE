import { useState } from "react";
import { useApp } from "../context/AppContext";
import { notify } from "../utils/swalToast";
import { getApiErrorMessage } from "../utils/apiError";
import { sendContactMessage } from "../services/contactService";
import { COMPANY_EMAIL } from "../data/homeData";
import { RequiredStar } from "../utils/requiredStar";

const INITIAL_FORM_STATE = {
  fullName: "",
  email: "",
  subject: "",
  message: "",
};

export const ContactForm = () => {
  const { lang, isDarkMode } = useApp();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await sendContactMessage({
        fullName: formData.fullName,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });

      notify({
        icon: "success",
        title: lang === "VN" ? "Đã gửi lời nhắn!" : "Message Sent!",
        text: lang === "VN"
          ? `Lời nhắn đã được gửi tới ${COMPANY_EMAIL}. Chúng tôi sẽ phản hồi sớm.`
          : `Your message was sent to ${COMPANY_EMAIL}. We will reply soon.`,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3500,
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      });

      setFormData(INITIAL_FORM_STATE);
    } catch (error) {
      console.error("Gửi form liên hệ thất bại:", error);
      notify({
        icon: "error",
        title: lang === "VN" ? "Gửi thất bại" : "Send failed",
        text: getApiErrorMessage(
          error,
          lang === "VN"
            ? "Không gửi được lời nhắn. Vui lòng thử lại hoặc gọi hotline."
            : "Could not send your message. Please try again or call the hotline.",
        ),
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 4000,
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#124757] dark:bg-slate-800 border border-white/10 dark:border-slate-700/50 p-8 md:p-10 rounded-[2.5rem] shadow-xl">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
              {lang === "VN" ? "Họ và tên" : "Full Name"}<RequiredStar />
            </label>
            <input
              type="text"
              required
              name="fullName"
              autoComplete="name"
              disabled={isSubmitting}
              value={formData.fullName}
              onChange={handleChange("fullName")}
              placeholder={lang === "VN" ? "Nhập họ tên của bạn" : "Enter your full name"}
              className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner disabled:opacity-60"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
              {lang === "VN" ? "Địa chỉ Email" : "Email Address"}<RequiredStar />
            </label>
            <input
              type="email"
              required
              name="email"
              autoComplete="email"
              disabled={isSubmitting}
              value={formData.email}
              onChange={handleChange("email")}
              placeholder={lang === "VN" ? "Địa chỉ email của bạn" : "Your email address"}
              className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
            {lang === "VN" ? "Tiêu đề liên hệ" : "Subject"}
          </label>
          <input
            type="text"
            name="subject"
            disabled={isSubmitting}
            value={formData.subject}
            onChange={handleChange("subject")}
            placeholder={lang === "VN" ? "Nhập tiêu đề nội dung" : "What is this regarding?"}
            className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-white/70 dark:text-slate-400">
            {lang === "VN" ? "Nội dung lời nhắn" : "Message Contents"}<RequiredStar />
          </label>
          <textarea
            rows={4}
            required
            name="message"
            disabled={isSubmitting}
            value={formData.message}
            onChange={handleChange("message")}
            placeholder={lang === "VN" ? "Viết nội dung tin nhắn của bạn tại đây..." : "Type your message details here..."}
            className="w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner resize-none disabled:opacity-60"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-yellow-400 text-slate-900 px-10 py-4 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-md hover:bg-yellow-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {lang === "VN" ? "Đang gửi..." : "Sending..."}
              </>
            ) : (
              <>
                {lang === "VN" ? "Gửi lời nhắn ngay" : "Send Message"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
