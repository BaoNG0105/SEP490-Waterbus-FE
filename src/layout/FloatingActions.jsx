import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { AIChatbotPanel } from "../components/AIChatbotPanel";

const aiButtonImage = "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/AI.png";

// Âm thanh chào mừng phát cùng lúc bong bóng chào hiện lên, theo ngôn ngữ đang chọn
const GREETING_AUDIO_URL = {
  VN: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/greeting-vi.wav",
  ENG: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/greeting-en.wav",
};

// Chỉ chào 1 lần cho mỗi phiên (session), reload trang trong cùng phiên sẽ không lặp lại
const GREETING_SESSION_KEY = "hasSeenAiGreeting";
// Độ trễ trước khi hiệu ứng chào (pop-in nút + bong bóng + âm thanh) bắt đầu, tính từ lúc vào web
const GREETING_START_DELAY_MS = 2000;

export const FloatingActions = () => {
  // Nhúng Context để hỗ trợ đa ngôn ngữ cho các Tooltip (tiêu đề khi trỏ chuột vào)
  const { lang } = useApp();
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Đã chào trong phiên này chưa — quyết định có chạy hiệu ứng pop-in / bong bóng / âm thanh hay không
  const [hasSeenGreeting] = useState(() => sessionStorage.getItem(GREETING_SESSION_KEY) === "true");
  // Nút AI Chatbot: nếu đã chào rồi thì hiện luôn (không delay/animation); lần đầu thì đợi
  // GREETING_START_DELAY_MS mới xuất hiện, để đồng bộ cùng lúc với bong bóng + âm thanh
  const [isButtonVisible, setIsButtonVisible] = useState(hasSeenGreeting);
  // Bong bóng chào mừng: hiện sau GREETING_START_DELAY_MS, tự tắt sau ~5 giây
  const [showGreeting, setShowGreeting] = useState(false);

  // Luôn giữ ngôn ngữ mới nhất để dùng trong setTimeout (effect dưới chỉ chạy 1 lần lúc mount)
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (hasSeenGreeting) return;

    let hideGreetingTimer;
    let greetingAudio;
    const INTERACTION_EVENTS = ["pointerdown", "keydown"];
    let playOnFirstInteraction = () => {};

    const startGreetingTimer = setTimeout(() => {
      setIsButtonVisible(true);
      setShowGreeting(true);
      sessionStorage.setItem(GREETING_SESSION_KEY, "true");

      // Phát âm thanh chào mừng theo ngôn ngữ hiện tại
      const audioUrl = GREETING_AUDIO_URL[langRef.current] || GREETING_AUDIO_URL.ENG;
      greetingAudio = new Audio(audioUrl);

      // Đa số trình duyệt chặn autoplay có tiếng nếu người dùng chưa từng tương tác với trang.
      // Nếu bị chặn thì tự phát lại ngay ở lần chạm/click/gõ phím đầu tiên của người dùng.
      playOnFirstInteraction = () => {
        greetingAudio.play().catch(() => {});
        INTERACTION_EVENTS.forEach((evt) => document.removeEventListener(evt, playOnFirstInteraction));
      };
      greetingAudio.play().catch(() => {
        INTERACTION_EVENTS.forEach((evt) =>
          document.addEventListener(evt, playOnFirstInteraction, { once: true }),
        );
      });

      hideGreetingTimer = setTimeout(() => setShowGreeting(false), 5000);
    }, GREETING_START_DELAY_MS);

    return () => {
      clearTimeout(startGreetingTimer);
      clearTimeout(hideGreetingTimer);
      greetingAudio?.pause();
      INTERACTION_EVENTS.forEach((evt) => document.removeEventListener(evt, playOnFirstInteraction));
    };
  }, [hasSeenGreeting]);

  // Ẩn bong bóng chào mừng ngay nếu người dùng mở chat trước khi hết 5 giây
  const isGreetingVisible = showGreeting && !isChatOpen;

  return (
    <div className="fixed right-6 bottom-6 z-100 flex flex-col items-end gap-4 pointer-events-none">
      {/* Khung chat AI */}
      {isChatOpen && (
        <AIChatbotPanel lang={lang} onClose={() => setIsChatOpen(false)} />
      )}

      {/* Nút AI Chatbot + bong bóng chào mừng: lần đầu vào web thì đợi GREETING_START_DELAY_MS mới
          xuất hiện cùng lúc với âm thanh; các lần sau trong cùng phiên thì hiện ngay, không delay */}
      {isButtonVisible && (
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
            className={`${hasSeenGreeting ? "" : "animate-ai-pop-in"} group relative w-32 h-32 pointer-events-auto`}
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
      )}
    </div>
  );
};
