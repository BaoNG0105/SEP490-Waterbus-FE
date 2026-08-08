import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { chatWithAssistant, getAssistantConversation, updateAssistantBookingDraft } from "../api/assistantApi";
import ChatBookingFlow from "./ChatBookingFlow";
import { logoUrl as logo } from "../data/homeData";

// Style các thẻ markdown cho vừa khung bong bóng chat (không dùng @tailwindcss/typography).
const markdownComponents = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-900/10 px-1 py-0.5 text-[12px] dark:bg-white/10">{children}</code>
  ),
};

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
    quickQuestions: ["Hôm nay có những chuyến nào?", "Giá vé Waterbus là bao nhiêu?"],
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
    quickQuestions: ["What trips are available today?", "How much is a Waterbus ticket?"],
  },
};

export const AIChatbotPanel = ({ lang, onClose }) => {
  // Ngôn ngữ riêng của khung chat (mặc định theo ngôn ngữ toàn site), có thể đổi độc lập bằng nút VN/EN.
  const [chatLang, setChatLang] = useState(lang === "ENG" ? "ENG" : "VN");
  const t = TEXT[chatLang] || TEXT.VN;
  const quickQuestions = t.quickQuestions;
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const [messages, setMessages] = useState([
    { id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions },
  ]);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    try { return window.localStorage.getItem("waterbus.chat.conversationId"); } catch { return null; }
  });
  const [clientSessionId] = useState(() => {
    try {
      const key = "waterbus.chat.clientSessionId";
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const created = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, created);
      return created;
    } catch { return `session-${Date.now()}`; }
  });
  const [isConversationClosed, setIsConversationClosed] = useState(false);
  const [bookingFlow, setBookingFlow] = useState(false);
  const [bookingDraft, setBookingDraft] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Câu chào là văn bản tĩnh theo ngôn ngữ, không phải do LLM trả về nên cần tự đồng bộ khi đổi VN/EN.
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === "greeting" ? { ...m, text: t.greeting, suggestedQuestions: quickQuestions } : m))
    );
  }, [chatLang, t.greeting, quickQuestions]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) return undefined;
    getAssistantConversation(conversationId, clientSessionId)
      .then((data) => {
        if (cancelled || !data?.messages) return;
        const restored = data.messages.map((m) => ({
          id: m.id,
          from: m.role === "user" ? "user" : "bot",
          text: m.text,
        }));
        setMessages([{ id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions }, ...restored]);
        setIsConversationClosed(data.status !== "Open");
        if (data.bookingDraft) {
          setBookingDraft(data.bookingDraft);
          if (data.bookingDraft.stage && data.bookingDraft.stage !== "Completed") setBookingFlow(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          try { window.localStorage.removeItem("waterbus.chat.conversationId"); } catch { /* ignore */ }
          setConversationId(null);
        }
      });
    return () => { cancelled = true; };
  }, [conversationId, clientSessionId, t.greeting, quickQuestions]);

  // Poll để hiển thị tin nhắn tự động đóng sau 30 phút ngay cả khi user vẫn mở widget.
  useEffect(() => {
    if (!conversationId || isConversationClosed) return undefined;
    const timer = window.setInterval(() => {
      getAssistantConversation(conversationId, clientSessionId)
        .then((data) => {
          if (!data?.messages) return;
          setMessages((prev) => {
            const greeting = prev.find((m) => m.id === "greeting") || { id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions };
            return [greeting, ...data.messages.map((m) => ({ id: m.id, from: m.role === "user" ? "user" : "bot", text: m.text }))];
          });
          if (data.status !== "Open") setIsConversationClosed(true);
          if (data.bookingDraft) {
            setBookingDraft(data.bookingDraft);
            if (data.bookingDraft.stage && data.bookingDraft.stage !== "Completed") setBookingFlow(true);
          }
        })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [conversationId, clientSessionId, isConversationClosed, t.greeting, quickQuestions]);

  const startNewConversation = () => {
    try { window.localStorage.removeItem("waterbus.chat.conversationId"); } catch { /* ignore */ }
    try { window.localStorage.removeItem("waterbus.chat.bookingDraft"); } catch { /* ignore */ }
    setConversationId(null);
    setIsConversationClosed(false);
    setBookingFlow(false);
    setBookingDraft(null);
    setMessages([{ id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions }]);
  };

  const startBookingFlow = () => {
    if (isConversationClosed) return;
    setBookingFlow(true);
    setBookingDraft((current) => current || { stage: "CollectingInfo" });
  };

  const handleRequireLogin = () => {
    navigate(`/login?redirect=${encodeURIComponent("/")}`);
  };

  const handleBookingDraftChange = async (nextDraft) => {
    setBookingDraft(nextDraft);
    if (!conversationId) return;
    try {
      await updateAssistantBookingDraft(conversationId, nextDraft, clientSessionId);
    } catch {
      // The local draft remains usable if persistence is temporarily unavailable.
    }
  };

  const sendText = async (text, draftOverride = bookingDraft) => {
    if (!text || isTyping || isConversationClosed) return;

    const userMessage = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsTyping(true);

    try {
      const data = await chatWithAssistant(
        [{ role: "user", text }],
        chatLang,
        conversationId,
        clientSessionId,
        draftOverride,
      );
      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        try { window.localStorage.setItem("waterbus.chat.conversationId", data.conversationId); } catch { /* ignore */ }
      }
      const replyText =
        (typeof data === "string" ? data : data?.reply ?? data?.text ?? data?.message ?? data?.answer) ||
        t.errorReply;
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: replyText,
          suggestedQuestions: data?.suggestedQuestions || [],
          actions: data?.actions || [],
        },
      ]);
      if (data?.bookingDraft) setBookingDraft(data.bookingDraft);
    } catch (error) {
      if (error?.response?.status === 409) {
        setIsConversationClosed(true);
      }
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, from: "bot", text: t.errorReply },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendText(text);
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
          <img src={logo} alt="" className="h-57 w-57 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-headline font-black">{t.title}</p>
          <p className="flex items-center gap-1.5 truncate text-[11px] font-bold opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 p-0.5 dark:bg-yellow-400/15">
          {["VN", "ENG"].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setChatLang(code)}
              title={code === "VN" ? "Tiếng Việt" : "English"}
              className={`rounded-full px-2 py-1 text-[10px] font-black transition-colors ${
                chatLang === code
                  ? "bg-white text-[#124757] dark:bg-yellow-400 dark:text-slate-900"
                  : "text-white/80 hover:text-white dark:text-yellow-400/70 dark:hover:text-yellow-400"
              }`}
            >
              {code === "VN" ? "VN" : "EN"}
            </button>
          ))}
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
              {m.from === "user" ? (
                m.text
              ) : (
                <>
                  <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                  {m.suggestedQuestions?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.suggestedQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => sendText(question)}
                          disabled={isTyping || isConversationClosed}
                          className="rounded-full border border-[#124757]/30 px-2.5 py-1 text-left text-[11px] font-bold text-[#124757] transition-colors hover:bg-[#124757]/10 disabled:opacity-50 dark:border-yellow-400/40 dark:text-yellow-300"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.actions?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((action) => (
                        <button
                          key={`${action.type}-${action.route}-${action.label}`}
                          type="button"
                          onClick={() => {
                            if (action.type === "booking" || action.route === "/waterbus-booking") {
                              startBookingFlow();
                            } else if (action.type === "navigate" && action.route?.startsWith("/")) {
                              navigate(action.route);
                            }
                          }}
                          className="rounded-full bg-[#124757] px-2.5 py-1 text-[11px] font-bold text-white transition-transform hover:scale-[1.02] dark:bg-yellow-400 dark:text-slate-900"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {bookingFlow && !isConversationClosed && (
          <ChatBookingFlow
            lang={chatLang}
            initialDraft={bookingDraft}
            isAuthenticated={Boolean(isAuthenticated)}
            user={user}
            onRequireLogin={handleRequireLogin}
            onDraftChange={handleBookingDraftChange}
            onDone={(booking) => {
              setMessages((prev) => [...prev, {
                id: `b-booking-${Date.now()}`,
                from: "bot",
                text: chatLang === "VN"
                  ? `Đã tạo booking ${booking?.bookingCode || ""}. Bạn có thể tiếp tục theo dõi thanh toán.`
                  : `Booking ${booking?.bookingCode || ""} was created. You can continue with payment.`,
              }]);
            }}
          />
        )}

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

      {isConversationClosed && (
        <div className="flex items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <span>{chatLang === "VN" ? "Hội thoại đã đóng." : "This conversation is closed."}</span>
          <button type="button" onClick={startNewConversation} className="rounded-full bg-[#124757] px-3 py-1.5 text-white">
            {chatLang === "VN" ? "Chat mới" : "New chat"}
          </button>
        </div>
      )}

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
          disabled={isTyping || isConversationClosed}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-yellow-400"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isTyping || isConversationClosed}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#124757] text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-yellow-400 dark:text-slate-900"
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </form>
    </div>
  );
};
