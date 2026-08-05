import { useState } from "react";
import { useApp } from "../context/AppContext";
import { AIChatbotPanel } from "../components/AIChatbotPanel";
import logo from "../assets/logo-1.png";

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
          className="group relative w-20 h-20 pointer-events-auto"
        >
          {/* Vòng phát sáng nhấp nháy */}
          {!isChatOpen && (
            <span className="absolute inset-0 rounded-full bg-yellow-400/50 animate-ping" />
          )}

          {/* Nút tròn: xanh (light mode) / vàng (dark mode), logo header/footer bên trong */}
          <span className="relative flex h-full w-full items-center justify-center rounded-full bg-[#124757] p-3.5 shadow-lg shadow-[#124757]/40 transition-all duration-300 group-hover:scale-110 group-active:scale-95 dark:bg-yellow-400 dark:shadow-yellow-500/30">
            <img
              src={logo}
              alt={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
              className="h-full w-full object-contain"
            />
          </span>

          {/* Chấm báo online */}
          {!isChatOpen && (
            <span className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
          )}
        </button>
      </div>
    </div>
  );
};
