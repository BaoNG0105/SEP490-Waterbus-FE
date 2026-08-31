import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AIChatbotPanel } from "../components/AIChatbotPanel";

const aiButtonImage = "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/AI.png";

// Chỉ chào 1 lần cho mỗi phiên (session), reload trang trong cùng phiên sẽ không lặp lại
const GREETING_SESSION_KEY = "hasSeenAiGreeting";
// Độ trễ trước khi hiệu ứng chào (pop-in nút + bong bóng) bắt đầu, tính từ lúc vào web
const GREETING_START_DELAY_MS = 2000;

export const FloatingActions = () => {
  // Nhúng Context để hỗ trợ đa ngôn ngữ cho các Tooltip (tiêu đề khi trỏ chuột vào)
  const { lang } = useApp();
  const { pathname } = useLocation();
  // Nút AI Chatbot chỉ hiện ở trang chủ ("/") — sang trang khác thì ẩn hẳn, kể cả khung chat đang mở.
  const isHomePage = pathname === "/";
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Đã chào trong phiên này chưa — quyết định có chạy hiệu ứng pop-in / bong bóng hay không
  const [hasSeenGreeting] = useState(() => sessionStorage.getItem(GREETING_SESSION_KEY) === "true");
  // Nút AI Chatbot: nếu đã chào rồi thì hiện luôn (không delay/animation); lần đầu thì đợi
  // GREETING_START_DELAY_MS mới xuất hiện, để đồng bộ cùng lúc với bong bóng
  const [isButtonVisible, setIsButtonVisible] = useState(hasSeenGreeting);
  // Bong bóng chào mừng: hiện sau GREETING_START_DELAY_MS, tự tắt sau ~5 giây
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    if (hasSeenGreeting) return;

    let hideGreetingTimer;

    const startGreetingTimer = setTimeout(() => {
      setIsButtonVisible(true);
      setShowGreeting(true);
      sessionStorage.setItem(GREETING_SESSION_KEY, "true");

      hideGreetingTimer = setTimeout(() => setShowGreeting(false), 5000);
    }, GREETING_START_DELAY_MS);

    return () => {
      clearTimeout(startGreetingTimer);
      clearTimeout(hideGreetingTimer);
    };
  }, [hasSeenGreeting]);

  // Ẩn bong bóng chào mừng ngay nếu người dùng mở chat trước khi hết 5 giây
  const isGreetingVisible = showGreeting && !isChatOpen;

  // Rời trang chủ (kể cả điều hướng SPA không reload) → ẩn hẳn nút + khung chat; AIChatbotPanel
  // unmount theo nên không cần tự reset isChatOpen riêng.
  if (!isHomePage) return null;

  return (
    <div className="fixed right-6 bottom-6 z-100 flex flex-col items-end gap-4 pointer-events-none">
      {/* Khung chat AI */}
      {isChatOpen && (
        <AIChatbotPanel lang={lang} onClose={() => setIsChatOpen(false)} />
      )}

      {/* Nút AI Chatbot + bong bóng chào mừng: lần đầu vào web thì đợi GREETING_START_DELAY_MS mới
          xuất hiện; các lần sau trong cùng phiên thì hiện ngay, không delay.
          Ẩn hẳn nút khi khung chat đang mở*/}
      {isButtonVisible && !isChatOpen && (
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
            onClick={() => setIsChatOpen(true)}
            title={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
            className={`${hasSeenGreeting ? "" : "animate-ai-pop-in"} group relative w-32 h-32 pointer-events-auto`}
          >
            <img
              src={aiButtonImage}
              alt={lang === "VN" ? "Trợ lý ảo AI" : "AI Assistant"}
              className="relative h-full w-full object-contain transition-transform duration-300 group-hover:scale-110 group-active:scale-95"
            />

            {/* Chấm báo online */}
            <span className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
          </button>
        </div>
      )}
    </div>
  );
};
