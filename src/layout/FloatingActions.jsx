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
        {/* Nút AI Chatbot */}
        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          title={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
          className="group relative w-34 h-34 pointer-events-auto"
        >
          {/* Vòng phát sáng nhấp nháy */}
          {!isChatOpen && (
            <span className="absolute inset-0 rounded-full bg-yellow-400/50 animate-ping" />
          )}

          <img
            src="https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/wtb-icon.png"
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
