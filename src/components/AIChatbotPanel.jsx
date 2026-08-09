import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  chatWithAssistant,
  closeAssistantConversation,
  getAssistantConversation,
  updateAssistantBookingDraft,
} from "../api/assistantApi";
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

const mapServerMessage = (message) => ({
  id: message.id,
  from: message.role === "user" ? "user" : "bot",
  text: message.text,
  suggestedQuestions: Array.isArray(message.suggestedQuestions) ? message.suggestedQuestions : [],
  actions: Array.isArray(message.actions) ? message.actions : [],
});

const EMPTY_BOOKING_CONTEXT = {
  departureDate: "",
  fromStationName: "",
  toStationName: "",
  adultCount: null,
  childCount: 0,
  infantCount: 0,
  passengerCountConfirmed: false,
};

const toDateString = (year, month, day) => {
  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  if (candidate.getFullYear() !== Number(year) || candidate.getMonth() !== Number(month) - 1 || candidate.getDate() !== Number(day)) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseBookingDate = (text) => {
  if (/(hôm nay|hom nay|today)/i.test(text)) {
    const today = new Date();
    return toDateString(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }
  if (/(ngày mai|ngay mai|tomorrow)/i.test(text)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateString(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
  }
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return toDateString(iso[1], iso[2], iso[3]);
  const local = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  return local ? toDateString(local[3], local[2], local[1]) : "";
};

const parseBookingContext = (text, current = EMPTY_BOOKING_CONTEXT) => {
  const next = { ...EMPTY_BOOKING_CONTEXT, ...current };
  const date = parseBookingDate(text);
  if (date) next.departureDate = date;

  const routePatterns = [
    /(?:từ|from|đi|di)\s+(.+?)\s*(?:đến|tới|to|->|→|[-–—])\s*(.+?)(?=\s+(?:ngày|on|cho|với|lúc|at|for|with)\b|\s+(?:và|and)\s+\d+\b|[,.!?]|$)/i,
    /(?:^|\s)bến\s+(.+?)\s*(?:đến|tới|to|->|→|[-–—])\s*bến\s+(.+?)(?=\s+(?:ngày|on|cho|với|lúc|at|for|with)\b|\s+(?:và|and)\s+\d+\b|[,.!?]|$)/i,
    /(?:^|\s)([^\d\s][^,!?]{1,40}?)\s*(?:->|→)\s*([^,!?]{1,40}?)(?=\s+(?:ngày|on|cho|với|lúc|at|for|with)\b|\s+(?:và|and)\s+\d+\b|[,.!?]|$)/i,
  ];
  const route = routePatterns.map((pattern) => text.match(pattern)).find(Boolean);
  if (route) {
    const cleanStation = (value) => String(value || "")
      .replace(/^bến\s+/i, "")
      .replace(/\s+(?:ngày|on|cho|với|lúc|at|for|with)\b.*$/i, "")
      .trim();
    next.fromStationName = cleanStation(route[1]);
    next.toStationName = cleanStation(route[2].replace(/^>\s*/, ""));
  }

  const adult = text.match(/(\d+)\s*(?:người\s*lớn|adult(?:s)?)/i);
  const child = text.match(/(\d+)\s*(?:trẻ\s*em|trẻ\s*nhỏ|children?|kids?)/i);
  const infant = text.match(/(\d+)\s*(?:em\s*b[eé]|trẻ\s*sơ\s*sinh|infants?)/i);
  const generic = text.match(/(?:đi|cho|for)\s+(\d+)\s*(?:người|khách|people|persons)\b/i)
    || text.match(/\b(\d+)\s*(?:người|khách)\b/i);
  if (adult || generic) {
    next.adultCount = Number(adult?.[1] || generic?.[1]);
    next.passengerCountConfirmed = true;
  }
  if (child) {
    next.childCount = Number(child[1]);
    next.passengerCountConfirmed = true;
  } else if (/(?:không|khong|no)\s+(?:có\s+)?(?:trẻ\s*em|children?|kids?)/i.test(text)) {
    next.childCount = 0;
    next.passengerCountConfirmed = true;
  }
  if (infant) {
    next.infantCount = Number(infant[1]);
    next.passengerCountConfirmed = true;
  } else if (/(?:không|khong|no)\s+(?:có\s+)?(?:em\s*b[eé]|trẻ\s*sơ\s*sinh|infants?)/i.test(text)) {
    next.infantCount = 0;
    next.passengerCountConfirmed = true;
  }
  return next;
};

const hasBookingIntent = (text) => /(đặt\s+vé|mua\s+vé|book(?:ing)?\s+(?:a\s+)?ticket|ticket\s+booking)/i.test(text);
const isBookingContextComplete = (context) => Boolean(
  context?.departureDate
  && context?.fromStationName
  && context?.toStationName
  && context?.passengerCountConfirmed
  && Number(context?.adultCount || 0) >= 1,
);

const bookingDraftFromContext = (context) => ({
  stage: "CollectingInfo",
  isRoundTrip: false,
  departureDate: context.departureDate,
  returnDate: "",
  fromStationId: "",
  toStationId: "",
  fromStationCode: "",
  toStationCode: "",
  fromStationName: context.fromStationName,
  toStationName: context.toStationName,
  adultCount: context.adultCount,
  childCount: context.childCount || 0,
  infantCount: context.infantCount || 0,
  passengerCountConfirmed: Boolean(context.passengerCountConfirmed),
  departureTrips: [],
  returnTrips: [],
  selectedDepartureTrip: null,
  selectedReturnTrip: null,
  selectedSeatsDeparture: [],
  selectedSeatsReturn: [],
  passengers: [],
  contact: { name: "", phone: "", email: "" },
  insuranceSelected: false,
  promotionCode: "",
  holdExpiresAt: null,
  preview: null,
});

export const AIChatbotPanel = ({ lang, onClose }) => {
  // Khung chat dùng chung ngôn ngữ với toàn site; không tạo switch VN/EN riêng.
  const chatLang = lang === "ENG" ? "ENG" : "VN";
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
  const [bookingIntent, setBookingIntent] = useState(false);
  const [bookingContext, setBookingContext] = useState(EMPTY_BOOKING_CONTEXT);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bottomRef = useRef(null);
  const conversationVersionRef = useRef(0);
  const bookingDraftSyncVersionRef = useRef(0);
  const bookingDraftWriteRef = useRef(Promise.resolve());

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
        const restored = data.messages.map(mapServerMessage);
        setMessages([{ id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions }, ...restored]);
        setIsConversationClosed(data.status !== "Open");
        if (data.bookingDraft) {
          setBookingDraft(data.bookingDraft);
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
            return [greeting, ...data.messages.map(mapServerMessage)];
          });
          if (data.status !== "Open") setIsConversationClosed(true);
          if (data.bookingDraft) {
            setBookingDraft(data.bookingDraft);
          }
        })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [conversationId, clientSessionId, isConversationClosed, t.greeting, quickQuestions]);

  const startNewConversation = async () => {
    conversationVersionRef.current += 1;
    const previousConversationId = conversationId;
    setIsRefreshing(true);
    if (previousConversationId) {
      try {
        await closeAssistantConversation(previousConversationId, clientSessionId);
      } catch {
        // Vẫn tạo hội thoại mới nếu hội thoại cũ đã hết hạn hoặc API tạm thời lỗi.
      }
    }
    try { window.localStorage.removeItem("waterbus.chat.conversationId"); } catch { /* ignore */ }
    try { window.localStorage.removeItem("waterbus.chat.bookingDraft"); } catch { /* ignore */ }
    setConversationId(null);
    setIsConversationClosed(false);
    setBookingFlow(false);
    setBookingDraft(null);
    setBookingIntent(false);
    setBookingContext(EMPTY_BOOKING_CONTEXT);
    bookingDraftSyncVersionRef.current += 1;
    setMessages([{ id: "greeting", from: "bot", text: t.greeting, suggestedQuestions: quickQuestions }]);
    setDraft("");
    setIsTyping(false);
    setIsRefreshing(false);
  };

  const startBookingIntent = () => {
    if (isConversationClosed) return;
    // Rebuild the context from all user turns before opening the flow. The
    // assistant may have summarized route/date/passenger details in its reply,
    // while the local context was built before an earlier turn was persisted.
    const rebuiltContext = messages
      .filter((message) => message.from === "user")
      .reduce((context, message) => parseBookingContext(message.text, context), bookingContext);
    setBookingContext(rebuiltContext);
    setBookingIntent(true);
    // When the conversation already contains a complete booking request,
    // open the embedded form immediately and seed it from that context. This
    // keeps the user from having to repeat the date, route, or passenger count.
    if (isBookingContextComplete(rebuiltContext)) {
      setBookingDraft(bookingDraftFromContext(rebuiltContext));
      setBookingFlow(true);
      return;
    }
    setBookingFlow(false);
    setBookingDraft(null);
    void sendText(chatLang === "VN" ? "Tôi muốn đặt vé trong chat." : "I want to book a ticket in chat.", null);
  };

  const openBookingForm = () => {
    if (isConversationClosed || !isBookingContextComplete(bookingContext)) return;
    setBookingDraft(bookingDraftFromContext(bookingContext));
    setBookingFlow(true);
  };

  const handleRequireLogin = () => {
    const redirect = `${window.location.pathname}${window.location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

  const handleBookingDraftChange = async (nextDraft) => {
    const syncVersion = ++bookingDraftSyncVersionRef.current;
    setBookingDraft(nextDraft);
    if (!conversationId) return;
    bookingDraftWriteRef.current = bookingDraftWriteRef.current
      .catch(() => undefined)
      .then(() => updateAssistantBookingDraft(conversationId, nextDraft, clientSessionId));
    try { await bookingDraftWriteRef.current; } catch { /* local draft remains usable */ }
    if (syncVersion !== bookingDraftSyncVersionRef.current) return;
  };

  const sendText = async (text, draftOverride = bookingDraft) => {
    if (!text || isTyping || isConversationClosed) return;

    const requestVersion = conversationVersionRef.current;
    const formWasOpen = bookingFlow;
    const startsOrContinuesBooking = bookingIntent || hasBookingIntent(text);
    const contextBase = formWasOpen ? EMPTY_BOOKING_CONTEXT : bookingContext;
    // Parse every message so route/date/passenger details mentioned before the
    // user presses “Đặt vé” are retained and prefilled in the booking form.
    const nextBookingContext = parseBookingContext(text, contextBase);

    if (formWasOpen) {
      // A free-text correction invalidates the route/seat draft currently shown.
      // Unmount it immediately and clear the persisted draft before asking the AI again.
      setBookingFlow(false);
      setBookingDraft(null);
      bookingDraftSyncVersionRef.current += 1;
    }
    if (hasBookingIntent(text)) setBookingIntent(true);
    setBookingContext(nextBookingContext);

    const userMessage = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsTyping(true);

    try {
      if (formWasOpen && conversationId) {
        try {
          await bookingDraftWriteRef.current;
          await updateAssistantBookingDraft(conversationId, null, clientSessionId);
        } catch {
          // The chat request below also sends null, so a temporary clear failure is recoverable.
        }
      }
      const data = await chatWithAssistant(
        [{ role: "user", text }],
        chatLang,
        conversationId,
        clientSessionId,
        formWasOpen ? draftOverride : null,
      );
      if (requestVersion !== conversationVersionRef.current) return;
      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        try { window.localStorage.setItem("waterbus.chat.conversationId", data.conversationId); } catch { /* ignore */ }
      }
      const replyText =
        (typeof data === "string" ? data : data?.reply ?? data?.text ?? data?.message ?? data?.answer) ||
        t.errorReply;
      const apiActions = Array.isArray(data?.actions) ? data.actions : [];
      // The assistant often summarizes the complete route/date/passenger
      // details in its reply. Merge that summary back into the local context
      // so the “Đặt vé” action can open a prefilled form.
      const replyBookingContext = parseBookingContext(data?.text || "", nextBookingContext);
      setBookingContext(replyBookingContext);
      const confirmationAction = startsOrContinuesBooking
        && isBookingContextComplete(replyBookingContext)
        ? [{
          type: "booking-confirm",
          route: "/waterbus-booking",
          label: chatLang === "VN" ? "Xác nhận thông tin & mở form" : "Confirm details & open form",
        }]
        : [];
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: replyText,
          suggestedQuestions: Array.isArray(data?.suggestedQuestions) ? data.suggestedQuestions : [],
          actions: [
            ...apiActions.filter((action) => !(startsOrContinuesBooking && action.type === "booking")),
            ...confirmationAction,
          ],
        },
      ]);
      if (data?.bookingDraft && !formWasOpen) setBookingDraft(data.bookingDraft);
    } catch (error) {
      if (requestVersion !== conversationVersionRef.current) return;
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
        <button
          type="button"
          onClick={() => void startNewConversation()}
          disabled={isRefreshing}
          title={chatLang === "VN" ? "Làm mới cuộc trò chuyện" : "Refresh conversation"}
          aria-label={chatLang === "VN" ? "Làm mới cuộc trò chuyện" : "Refresh conversation"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
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
                          disabled={isTyping || isConversationClosed || isRefreshing}
                          onClick={() => {
                            if (action.type === "booking-confirm") {
                              openBookingForm();
                            } else if (action.type === "booking" || action.route === "/waterbus-booking") {
                              startBookingIntent();
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
          <button type="button" onClick={() => void startNewConversation()} className="rounded-full bg-[#124757] px-3 py-1.5 text-white">
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
          disabled={isTyping || isConversationClosed || isRefreshing}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-yellow-400"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isTyping || isConversationClosed || isRefreshing}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#124757] text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-yellow-400 dark:text-slate-900"
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </form>
    </div>
  );
};
