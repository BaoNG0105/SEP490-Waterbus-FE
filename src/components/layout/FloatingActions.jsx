import { useApp } from "../../context/AppContext";

export const FloatingActions = () => {
  // Nhúng Context để hỗ trợ đa ngôn ngữ cho các Tooltip (tiêu đề khi trỏ chuột vào)
  const { lang } = useApp();

  return (
    <div className="fixed right-6 bottom-6 flex flex-col gap-4 z-[100] pointer-events-none">
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
        title={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
        className="w-14 h-14 bg-primary dark:bg-yellow-400 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform text-on-primary-fixed dark:text-slate-900 pointer-events-auto"
      >
        <span className="material-symbols-outlined text-2xl">smart_toy</span>
      </button>
    </div>
  );
};
