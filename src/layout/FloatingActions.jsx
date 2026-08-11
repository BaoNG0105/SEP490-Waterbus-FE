import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { AIChatbotPanel } from "../components/AIChatbotPanel";

const aiButtonImage = "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/AI.png";

export const FloatingActions = () => {
  // Nhúng Context để hỗ trợ đa ngôn ngữ cho các Tooltip (tiêu đề khi trỏ chuột vào)
  const { lang } = useApp();
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Bong bóng chào mừng: hiện ngay khi trang vừa mở, tự tắt sau ~5 giây
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    const showGreetingTimer = setTimeout(() => setShowGreeting(true), 750);
    const hideGreetingTimer = setTimeout(() => setShowGreeting(false), 750 + 5000);

    return () => {
      clearTimeout(showGreetingTimer);
      clearTimeout(hideGreetingTimer);
    };
  }, []);

  // Ẩn bong bóng chào mừng ngay nếu người dùng mở chat trước khi hết 5 giây
  const isGreetingVisible = showGreeting && !isChatOpen;

  return (
    <div className="fixed right-6 bottom-6 z-100 flex flex-col items-end gap-4 pointer-events-none">
      {/* Khung chat AI */}
      {isChatOpen && (
        <AIChatbotPanel lang={lang} onClose={() => setIsChatOpen(false)} />
      )}

      <div className="relative flex flex-col gap-4">
        {/* Bong bóng chào mừng: hiện ~5 giây rồi tự tắt */}
        <div
          className={`pointer-events-none absolute right-full top-1/2 mr-3 w-max max-w-55 -translate-y-1/2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-on-surface shadow-lg transition-all duration-500 ease-out dark:bg-slate-800 dark:text-white ${
            isGreetingVisible
              ? "translate-x-0 opacity-100"
              : "translate-x-3 opacity-0"
          }`}
        >
          {lang === "VN" ? "Waterbus xin chào!" : "Welcome to Waterbus!"}
          {/* Đuôi bong bóng trỏ về phía nút AI */}
          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white dark:bg-slate-800" />
        </div>

        {/* Nút AI Chatbot */}
        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          title={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
          className="animate-ai-pop-in group relative w-32 h-32 pointer-events-auto"
        >
          <img
            src={aiButtonImage}
            alt={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
            className="relative h-full w-full object-contain transition-transform duration-300 group-hover:scale-110 group-active:scale-95"
          />

          {/* Chấm báo online */}
          {!isChatOpen && (
            <span className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
          )}
        </button>
      </div>
    </div>
  );
};
