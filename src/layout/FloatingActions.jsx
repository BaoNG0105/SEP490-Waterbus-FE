import { useState } from "react";
import { useApp } from "../context/AppContext";
import { AIChatbotPanel } from "../components/AIChatbotPanel";

export const FloatingActions = () => {
  // Nhúng Context để hỗ trợ đa ngôn ngữ cho các Tooltip (tiêu đề khi trỏ chuột vào)
  const { lang } = useApp();
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="fixed right-6 bottom-6 z-100 flex flex-col items-end gap-4 pointer-events-none">
      {/* Khung chat AI */}
      {isChatOpen && (
        <AIChatbotPanel lang={lang} onClose={() => setIsChatOpen(false)} />
      )}

      <div className="flex flex-col gap-4">
        {/* Nút Zalo */}
        <a
          href="https://zalo.me" // Đổi thành link Zalo thật của bạn
          target="_blank"
          rel="noopener noreferrer"
          title={lang === "VN" ? "Hỗ trợ qua Zalo" : "Zalo Support"}
          className="w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform text-white font-bold text-[10px] pointer-events-auto cursor-pointer"
        >
          ZALO
        </a>

        {/* Nút AI Chatbot */}
        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          title={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
          className="group relative w-14 h-14 pointer-events-auto"
        >
          {/* Vòng phát sáng nhấp nháy */}
          {!isChatOpen && (
            <span className="absolute inset-0 rounded-full bg-yellow-400/50 animate-ping" />
          )}

          <span
            className={`relative flex h-full w-full items-center justify-center rounded-full bg-[#124757] text-white shadow-lg shadow-[#124757]/40 transition-all duration-300 group-hover:scale-110 group-active:scale-95 dark:bg-yellow-400 dark:text-slate-900 dark:shadow-yellow-500/30 ${
              isChatOpen ? "rotate-90" : ""
            }`}
          >
            <span className="material-symbols-outlined text-2xl transition-transform duration-300">
              {isChatOpen ? "close" : "smart_toy"}
            </span>
          </span>

          {/* Chấm báo online */}
          {!isChatOpen && (
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
          )}
        </button>
      </div>
    </div>
  );
};
