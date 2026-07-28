import { useEffect, useRef, useState } from "react";
import { chatWithAssistant } from "../api/assistantApi";

const TEXT = {
  VN: {
    title: "Trợ lý ảo Waterbus",
    subtitle: "Luôn sẵn sàng hỗ trợ bạn",
    greeting:
      "Xin chào, Mình là trợ lý ảo của Waterbus. Bạn cần hỗ trợ gì về lịch trình, đặt vé hay thuê tàu không?",
    placeholder: "Nhập tin nhắn...",
    errorReply:
      "Xin lỗi, mình đang gặp sự cố kết nối. Bạn vui lòng thử lại sau ít phút nhé.",
    close: "Đóng",
  },
  ENG: {
    title: "Waterbus AI Assistant",
    subtitle: "Always here to help",
    greeting:
      "Hi, I'm the Waterbus AI Assistant. How can I help you with schedules, bookings, or boat booking requests?",
    placeholder: "Type a message...",
    errorReply:
      "Sorry, I'm having connection trouble right now. Please try again in a few minutes.",
    close: "Close",
  },
};

export const AIChatbotPanel = ({ lang, onClose }) => {
  const t = TEXT[lang] || TEXT.VN;
  const [messages, setMessages] = useState([
    { id: "greeting", from: "bot", text: t.greeting },
  ]);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isTyping) return;

    const userMessage = { id: `u-${Date.now()}`, from: "user", text };
    // Lịch sử gửi lên server: bỏ câu chào mặc định (không phải do LLM sinh ra).
    const history = [...messages, userMessage]
      .filter((m) => m.id !== "greeting")
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", text: m.text }));

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsTyping(true);

    try {
      const data = await chatWithAssistant(history);
      const replyText =
        (typeof data === "string" ? data : data?.reply ?? data?.text ?? data?.message ?? data?.answer) ||
        t.errorReply;
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, from: "bot", text: replyText },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, from: "bot", text: t.errorReply },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      className="pointer-events-auto flex h-130 w-[92vw] max-w-95 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 animate-[chatPopIn_0.25s_ease-out]"
      role="dialog"
      aria-label={t.title}
    >
      <style>{`
        @keyframes chatPopIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 bg-[#124757] px-4 py-3.5 text-white dark:bg-slate-800 dark:text-yellow-400">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 dark:bg-yellow-400/15">
          <span className="material-symbols-outlined text-xl">smart_toy</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-headline font-black">{t.title}</p>
          <p className="flex items-center gap-1.5 truncate text-[11px] font-bold opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 dark:hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-950">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] font-medium leading-snug shadow-sm ${
                m.from === "user"
                  ? "rounded-br-sm bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          disabled={isTyping}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-yellow-400"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isTyping}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#124757] text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-yellow-400 dark:text-slate-900"
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </form>
    </div>
  );
};
