import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { chatWithAssistant, closeAssistantConversation, getAssistantConversation } from "../api/assistantApi";
import { holdSeats, releaseSeats } from "../services/tripService";
const aiButtonImage = "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/AI.png";

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
    start: "Bắt đầu",
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
    start: "Start",
  },
};

const mapServerMessage = (message) => ({
  id: message.id,
  from: message.role === "user" ? "user" : "bot",
  text: message.text,
  suggestedQuestions: Array.isArray(message.suggestedQuestions) ? message.suggestedQuestions : [],
  actions: Array.isArray(message.actions) ? message.actions : [],
});

// BE không xoá field khi vá draft (chỉ ghi đè khoá nó vừa đổi), nên nếu tuyến/ngày/loại dịch vụ vừa
// đổi mà chuyến/ghế đã chọn là của tuyến/ngày CŨ thì client phải tự dọn — theo đúng note API.
// Chặng về dọn theo cùng điều kiện của chặng đi, cộng thêm khi returnDate/isRoundTrip đổi.
const clearStaleSelection = (previous, next) => {
  if (!next || !previous) return next;
  let result = next;
  const departureChanged = ["departureDate", "fromStationCode", "toStationCode", "serviceType"]
    .some((key) => (previous[key] ?? null) !== (next[key] ?? null));
  if (departureChanged) {
    result = { ...result, selectedDepartureTrip: null, selectedSeatsDeparture: [] };
  }
  const returnChanged = departureChanged
    || (previous.returnDate ?? null) !== (next.returnDate ?? null)
    || Boolean(previous.isRoundTrip) !== Boolean(next.isRoundTrip);
  if (returnChanged) {
    result = { ...result, selectedReturnTrip: null, selectedSeatsReturn: [] };
  }
  return result;
};

// Tách tên bến tour ngắm cảnh từ routeName BE trả (dạng "Bến Bạch Đằng · Vòng sightseeing") — giống
// hệt cách Step1SearchSightseeing đang làm, vì Sightseeing không có fromStationName/toStationName.
const extractWharfLabel = (routeName) => {
  if (!routeName) return "";
  const [station] = String(routeName).split("·");
  return (station || routeName).trim();
};

// Dựng bookingData cho trang đặt vé thật (WaterbusBooking/WatersightseeingBooking) từ bookingDraft
// hiện có. Field trong selectedDepartureTrip/selectedSeatsDeparture trùng tên với TripSummaryDto/
// TripSeatMapSeatDto nên gán thẳng — không cần đổi tên hay ánh xạ lại (theo đúng note API).
const toBookingPageData = (draft) => {
  if (!draft) return null;
  const isSightseeing = draft.serviceType === "Sightseeing";
  const wharfLabel = isSightseeing ? extractWharfLabel(draft.selectedDepartureTrip?.routeName) : "";
  return {
    isRoundTrip: Boolean(draft.isRoundTrip),
    fromWharf: draft.fromStationId || "",
    toWharf: draft.toStationId || "",
    fromWharfName: isSightseeing ? wharfLabel : (draft.fromStationName || ""),
    toWharfName: isSightseeing ? wharfLabel : (draft.toStationName || ""),
    fromWharfCode: draft.fromStationCode || "",
    toWharfCode: draft.toStationCode || "",
    departureDate: draft.departureDate || "",
    returnDate: draft.returnDate || "",
    ...(isSightseeing ? { routeType: "SightseeingLoop" } : {}),
    // BE chỉ trả đúng 1 chuyến đã chọn, không trả cả danh sách — seed options bằng chính chuyến đó để
    // Step2 có gì để hiển thị/đánh dấu "đã chọn" ngay, không cần tìm lại từ đầu.
    departureTripOptions: draft.selectedDepartureTrip ? [draft.selectedDepartureTrip] : [],
    returnTripOptions: draft.selectedReturnTrip ? [draft.selectedReturnTrip] : [],
    selectedDepartureTrip: draft.selectedDepartureTrip || null,
    selectedReturnTrip: draft.selectedReturnTrip || null,
    selectedSeatsDeparture: Array.isArray(draft.selectedSeatsDeparture) ? draft.selectedSeatsDeparture : [],
    selectedSeatsReturn: Array.isArray(draft.selectedSeatsReturn) ? draft.selectedSeatsReturn : [],
    // Ghế trợ lý chọn tạm mới chỉ kiểm tra còn trống, CHƯA giữ chỗ — khách phải tự bấm giữ ghế ở
    // trang thật, nên không set seatHoldExpiresAt ở đây.
    seatHoldExpiresAt: null,
  };
};

// Nhân bản đúng quy tắc "chuyến còn mở đặt hay không" mà Step2SelectTripAndSeats thật đang dùng
// (isTripBookable/isSegmentBookingClosed) — không import trực tiếp vì đó là hàm nội bộ không export
// và không được sửa file đó. selectedDepartureTrip/selectedReturnTrip trong bookingDraft khớp field
// TripSummaryDto nên đủ dữ liệu để kiểm tra availableSeats/isBookable/giờ khởi hành. Không kiểm tra
// được phần "thiếu km" (isMissingKmBookingBlock) vì field đó chỉ tính được sau khi gọi seat-map —
// nếu rơi vào trường hợp đó, holdSeats bên dưới sẽ tự bị BE từ chối và rơi về nhánh lỗi.
const SEGMENT_BOOKING_CLOSE_LEAD_MS = 10 * 60 * 1000;
const isSegmentBookingClosed = (trip) => {
  const raw = trip?.fromStopScheduledDeparture;
  if (!raw) return false;
  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + SEGMENT_BOOKING_CLOSE_LEAD_MS;
};
const isTripStillBookable = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

// Đủ điều kiện để nhảy thẳng sang Bước 3 (thanh toán): đã có chuyến đi + ít nhất 1 ghế + chuyến vẫn
// còn mở đặt; nếu khứ hồi thì chặng về cũng phải đủ chuyến + ghế + còn mở, và số ghế 2 chiều bằng
// nhau (đúng ràng buộc Step2 thật). Không đủ thì bỏ qua bước giữ ghế, để trang thật tự re-validate.
const isBookingDataReadyForCheckout = (data) => {
  if (!data?.selectedDepartureTrip?.tripId || !data?.selectedSeatsDeparture?.length) return false;
  if (!isTripStillBookable(data.selectedDepartureTrip)) return false;
  if (!data.isRoundTrip) return true;
  return Boolean(
    data.selectedReturnTrip?.tripId
    && data.selectedSeatsReturn?.length
    && data.selectedSeatsReturn.length === data.selectedSeatsDeparture.length
    && isTripStillBookable(data.selectedReturnTrip),
  );
};

// Giữ thật sự ghế trợ lý mới chỉ "chọn tạm" — trang thật chỉ vào được Bước 3 khi ghế đã có hold hợp
// lệ (seatHoldExpiresAt), nên phải tự gọi holdSeats trước khi điều hướng thẳng tới checkout. Nếu
// chặng về giữ thất bại thì nhả lại ghế chặng đi vừa giữ, tránh giữ ghế lãng phí (giống Step2 thật).
const holdBookingDataSeats = async (data) => {
  const departureHold = await holdSeats(
    data.selectedDepartureTrip.tripId,
    data.selectedSeatsDeparture.map((s) => s.seatNumber),
    data.fromWharfCode,
    data.toWharfCode,
  );
  if (departureHold?.failedSeatNumbers?.length) return null;

  let returnExpiresAt = null;
  if (data.isRoundTrip) {
    try {
      const returnHold = await holdSeats(
        data.selectedReturnTrip.tripId,
        data.selectedSeatsReturn.map((s) => s.seatNumber),
        data.toWharfCode,
        data.fromWharfCode,
      );
      if (returnHold?.failedSeatNumbers?.length) {
        releaseSeats(
          data.selectedDepartureTrip.tripId,
          data.selectedSeatsDeparture.map((s) => s.seatNumber),
          data.fromWharfCode,
          data.toWharfCode,
        ).catch(() => { /* best-effort nhả ghế */ });
        return null;
      }
      returnExpiresAt = returnHold?.holdExpiresAt || null;
    } catch {
      releaseSeats(
        data.selectedDepartureTrip.tripId,
        data.selectedSeatsDeparture.map((s) => s.seatNumber),
        data.fromWharfCode,
        data.toWharfCode,
      ).catch(() => { /* best-effort nhả ghế */ });
      return null;
    }
  }

  const expiries = [departureHold?.holdExpiresAt, returnExpiresAt]
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  return expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;
};

export const AIChatbotPanel = ({ lang, onClose }) => {
  // Khung chat dùng chung ngôn ngữ với toàn site; không tạo switch VN/EN riêng.
  const chatLang = lang === "ENG" ? "ENG" : "VN";
  const t = TEXT[chatLang] || TEXT.VN;
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth || {});
  const [messages, setMessages] = useState([
    { id: "greeting", from: "bot", text: t.greeting },
  ]);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    try { return window.localStorage.getItem("waterbus.chat.conversationId"); } catch { return null; }
  });
  // Khoá ô nhập chữ cho tới khi khách bấm "Bắt đầu" — nút này thuần FE, không gọi API. Nếu đã có sẵn
  // hội thoại (conversationId từ trước) thì coi như đã "bắt đầu" rồi, khỏi bắt bấm lại.
  const [hasStarted, setHasStarted] = useState(() => {
    try { return Boolean(window.localStorage.getItem("waterbus.chat.conversationId")); } catch { return false; }
  });
  const [clientSessionId, setClientSessionId] = useState(() => {
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Đang gọi API giữ ghế thật trước khi nhảy thẳng sang Bước 3 checkout (bấm action "open-booking").
  const [isHoldingSeats, setIsHoldingSeats] = useState(false);
  // BE không lưu bookingDraft giữa các lượt — chỉ trả về bản đã merge sẵn trong response của lượt
  // đó. Client phải tự giữ (localStorage) và gửi lại y nguyên ở lượt sau, nếu không trợ lý sẽ hỏi
  // lại từ đầu sau khi khách F5.
  const [bookingDraft, setBookingDraft] = useState(() => {
    try {
      const raw = window.localStorage.getItem("waterbus.chat.bookingDraft");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const bottomRef = useRef(null);
  const conversationVersionRef = useRef(0);
  // Luôn giữ giá trị mới nhất để effect phát hiện-logout bên dưới đọc được conversationId/
  // clientSessionId hiện tại mà không cần liệt kê chúng vào dependency (tránh effect chạy lại
  // mỗi khi 2 giá trị này đổi trong lúc đang chat bình thường).
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const clientSessionIdRef = useRef(clientSessionId);
  clientSessionIdRef.current = clientSessionId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    try {
      if (bookingDraft) window.localStorage.setItem("waterbus.chat.bookingDraft", JSON.stringify(bookingDraft));
      else window.localStorage.removeItem("waterbus.chat.bookingDraft");
    } catch { /* ignore */ }
  }, [bookingDraft]);

  // Câu chào là văn bản tĩnh theo ngôn ngữ, không phải do LLM trả về nên cần tự đồng bộ khi đổi VN/EN.
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === "greeting" ? { ...m, text: t.greeting } : m))
    );
  }, [chatLang, t.greeting]);

  // Chỉ khôi phục hội thoại từ server ĐÚNG MỘT LẦN lúc mount (case F5/đổi tab, dùng conversationId đã
  // có sẵn trong localStorage lúc khởi tạo state). KHÔNG chạy lại mỗi khi conversationId đổi, vì nó
  // cũng đổi ngay trong lúc đang chat (lượt tin nhắn đầu tiên, sendText mới nhận conversationId từ
  // server) — nếu chạy lại lúc đó, GET sẽ ghi đè luôn tin nhắn bot vừa nhận (đang có actions) bằng
  // bản GET không có actions/suggestedQuestions, làm nút biến mất chỉ vài giây sau khi vừa hiện ra.
  const initialConversationIdRef = useRef(conversationId);
  useEffect(() => {
    let cancelled = false;
    const idToRestore = initialConversationIdRef.current;
    if (!idToRestore) return undefined;
    getAssistantConversation(idToRestore, clientSessionId)
      .then((data) => {
        if (cancelled || !data?.messages) return;
        const restored = data.messages.map(mapServerMessage);
        setMessages([{ id: "greeting", from: "bot", text: t.greeting }, ...restored]);
        setIsConversationClosed(data.status !== "Open");
      })
      .catch(() => {
        if (!cancelled) {
          try { window.localStorage.removeItem("waterbus.chat.conversationId"); } catch { /* ignore */ }
          setConversationId(null);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chỉ chạy 1 lần lúc mount, xem comment trên.
  }, []);

  // Poll để hiển thị tin nhắn tự động đóng sau 30 phút ngay cả khi user vẫn mở widget.
  useEffect(() => {
    if (!conversationId || isConversationClosed) return undefined;
    const timer = window.setInterval(() => {
      getAssistantConversation(conversationId, clientSessionId)
        .then((data) => {
          if (!data?.messages) return;
          setMessages((prev) => {
            // GET conversation không chắc trả kèm actions[]/suggestedQuestions[] y hệt response của
            // POST /assistant/chat — nếu ghi đè thẳng, nút/gợi ý đang hiện sẽ biến mất khi tới lượt
            // poll. Tin nhắn bot cục bộ dùng id tự sinh (b-<timestamp>), khác hẳn id thật server trả
            // ở GET này, nên KHÔNG thể match theo id để giữ lại bản có actions (match sẽ luôn trượt).
            // Thay vào đó chỉ APPEND các tin nhắn mới nằm sau những gì đã có cục bộ (đúng thứ tự BE
            // trả), không đụng tới tin đã hiển thị (đã có sẵn actions/suggestedQuestions từ chính
            // response POST /chat của lượt đó).
            const existing = prev.filter((m) => m.id !== "greeting");
            const serverMapped = data.messages.map(mapServerMessage);
            if (serverMapped.length <= existing.length) return prev;
            const appended = serverMapped.slice(existing.length);
            const greeting = prev.find((m) => m.id === "greeting") || { id: "greeting", from: "bot", text: t.greeting };
            return [greeting, ...existing, ...appended];
          });
          if (data.status !== "Open") setIsConversationClosed(true);
        })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [conversationId, clientSessionId, isConversationClosed, t.greeting]);

  // authSlice.logout() đã tự xoá 3 key localStorage (conversationId/bookingDraft/clientSessionId) ở
  // MỌI nơi gọi dispatch(logout()), kể cả khi khung chat đang đóng (chưa mount). Effect này chỉ lo
  // phần localStorage không tự lo được: nếu khung chat đang MỞ đúng lúc logout thì state trong bộ
  // nhớ (messages, bookingDraft, conversationId...) vẫn còn nguyên — phải tự reset, đồng thời best-
  // effort đóng hội thoại phía server rồi phát hành 1 clientSessionId mới cho phiên tiếp theo.
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;
    if (!wasAuthenticated || isAuthenticated) return; // chỉ xử lý đúng lúc true -> false (vừa đăng xuất)

    conversationVersionRef.current += 1; // huỷ mọi request chat của phiên cũ đang bay dở
    const closingConversationId = conversationIdRef.current;
    const closingClientSessionId = clientSessionIdRef.current;
    if (closingConversationId) {
      closeAssistantConversation(closingConversationId, closingClientSessionId).catch(() => {
        // best-effort — hội thoại cũ tự hết hạn/tự dọn theo thời gian nếu đóng lỗi, không chặn logout
      });
    }

    const nextClientSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { window.localStorage.setItem("waterbus.chat.clientSessionId", nextClientSessionId); } catch { /* ignore */ }
    setClientSessionId(nextClientSessionId);
    setConversationId(null);
    setIsConversationClosed(false);
    setBookingDraft(null);
    setMessages([{ id: "greeting", from: "bot", text: t.greeting }]);
    setDraft("");
    setIsTyping(false);
    setHasStarted(false);
  }, [isAuthenticated, t.greeting]);

  // Bấm nút "open-booking" (do trợ lý gợi ý): nếu đã đủ chuyến + ghế (và khách đã đăng nhập), thử
  // giữ ghế thật rồi nhảy thẳng sang Bước 3 checkout; nếu chưa đủ hoặc giữ ghế thất bại thì vẫn mở
  // đúng route/step BE gợi ý như bình thường, để khách tự hoàn tất ở trang thật.
  const handleOpenBookingAction = async (action) => {
    if (action.type !== "open-booking") {
      if (action.route?.startsWith("/")) navigate(action.route);
      return;
    }

    const bookingData = toBookingPageData(bookingDraft);
    if (!bookingData) {
      navigate(action.route);
      return;
    }

    if (isAuthenticated && action.step === 2 && isBookingDataReadyForCheckout(bookingData)) {
      setIsHoldingSeats(true);
      let seatHoldExpiresAt = null;
      try {
        seatHoldExpiresAt = await holdBookingDataSeats(bookingData);
      } catch {
        // API giữ ghế ném lỗi (vd ghế đã bị người khác khoá trước) — coi như thất bại, xử lý chung
        // với trường hợp trả về null bên dưới thay vì âm thầm bỏ qua.
        seatHoldExpiresAt = null;
      } finally {
        setIsHoldingSeats(false);
      }

      if (seatHoldExpiresAt) {
        navigate(action.route, { state: { step: 3, bookingData: { ...bookingData, seatHoldExpiresAt } } });
        return;
      }

      // Giữ ghế thất bại (ghế vừa bị người khác khoá/đặt, hoặc lỗi API) — báo ngay trong chat thay vì
      // đợi khách tự bấm nút ở Bước 2 mới biết. Đồng thời xoá ghế đã chọn khỏi bookingData trước khi
      // rơi về Bước 2, tránh hiển thị lại ghế thật ra đã bị khoá như đang còn chọn được.
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: chatLang === "VN"
            ? "Ghế trợ lý chọn tạm vừa hết hoặc có người khác giữ mất rồi. Bạn chọn lại ghế trên trang đặt vé giúp mình nhé."
            : "The seats picked earlier are no longer available. Please reselect on the booking page.",
        },
      ]);
      navigate(action.route, {
        state: {
          step: action.step || 1,
          bookingData: { ...bookingData, selectedSeatsDeparture: [], selectedSeatsReturn: [] },
        },
      });
      return;
    }

    navigate(action.route, { state: { step: action.step || 1, bookingData } });
  };

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
    setConversationId(null);
    setIsConversationClosed(false);
    setBookingDraft(null);
    setMessages([{ id: "greeting", from: "bot", text: t.greeting }]);
    setDraft("");
    setIsTyping(false);
    setIsRefreshing(false);
    // Hội thoại mới (dù do bấm nút làm mới, hay bấm "Chat mới" sau khi tự đóng sau 30 phút) đều coi
    // như quay lại trạng thái ban đầu — khoá lại ô nhập, bắt bấm "Bắt đầu" lần nữa.
    setHasStarted(false);
  };

  const sendText = async (text) => {
    if (!text || isTyping || isConversationClosed) return;

    const requestVersion = conversationVersionRef.current;
    const userMessage = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsTyping(true);

    try {
      // Chỉ gửi câu nói hiện tại — BE tự đọc lại lịch sử theo conversationId và tự hiểu ngữ cảnh.
      // bookingDraft gửi lại NGUYÊN KHỐI những gì lượt trước BE trả về (không tự đoán/parse/đổi tên
      // field) — đúng cách dùng BE khuyến nghị.
      const data = await chatWithAssistant([{ text }], conversationId, clientSessionId, bookingDraft);
      if (requestVersion !== conversationVersionRef.current) return;
      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        try { window.localStorage.setItem("waterbus.chat.conversationId", data.conversationId); } catch { /* ignore */ }
      }
      setBookingDraft((prev) => clearStaleSelection(prev, data?.bookingDraft ?? null));
      const replyText =
        (typeof data === "string" ? data : data?.reply ?? data?.text ?? data?.message ?? data?.answer) ||
        t.errorReply;
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: replyText,
          suggestedQuestions: Array.isArray(data?.suggestedQuestions) ? data.suggestedQuestions : [],
          actions: Array.isArray(data?.actions) ? data.actions : [],
        },
      ]);
      if (data?.status && data.status !== "Open") setIsConversationClosed(true);
    } catch (error) {
      if (requestVersion !== conversationVersionRef.current) return;
      const status = error?.response?.status;
      if (status === 409) {
        setIsConversationClosed(true);
      } else if (status === 404) {
        // Hội thoại không tồn tại hoặc không khớp clientSessionId/userId — bỏ conversationId hỏng
        // để lượt chat tiếp theo tự tạo hội thoại mới thay vì lặp lại lỗi 404 mãi.
        try { window.localStorage.removeItem("waterbus.chat.conversationId"); } catch { /* ignore */ }
        setConversationId(null);
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

  // Chatbot chỉ dành cho khách đã đăng nhập — khách chưa đăng nhập bấm nút này để sang trang login,
  // có kèm redirect quay lại đúng trang đang đứng sau khi đăng nhập xong.
  const handleRequireLogin = () => {
    const redirect = `${window.location.pathname}${window.location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
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
        <img src={aiButtonImage} alt="" className="h-16 w-16 shrink-0 object-contain" />
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

      {/* Chatbot chỉ dùng được khi đã đăng nhập — chưa đăng nhập thì làm mờ + khoá toàn bộ khung bên
          dưới, chỉ còn overlay thông báo + nút sang trang login còn tương tác được. */}
      <div className="relative flex flex-1 flex-col min-h-0">
        <div className={`flex flex-1 flex-col min-h-0 ${!isAuthenticated ? "pointer-events-none select-none blur-sm" : ""}`}>
          {/* Messages */}
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-950">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] font-medium leading-snug shadow-sm ${m.from === "user"
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
                              key={`${action.type}-${action.route}-${action.step ?? ""}-${action.label}`}
                              type="button"
                              disabled={isTyping || isConversationClosed || isRefreshing || isHoldingSeats || !action.route?.startsWith("/")}
                              onClick={() => void handleOpenBookingAction(action)}
                              className="rounded-full bg-[#124757] px-2.5 py-1 text-[11px] font-bold text-white transition-transform hover:scale-[1.02] dark:bg-yellow-400 dark:text-slate-900 disabled:opacity-60"
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
              <span>{chatLang === "VN" ? "Hội thoại đã hết hạn." : "This conversation has expired."}</span>
              <button type="button" onClick={() => void startNewConversation()} className="rounded-full bg-[#124757] px-3 py-1.5 text-white">
                {chatLang === "VN" ? "Chat mới" : "New chat"}
              </button>
            </div>
          )}

          {/* Input — khoá bằng nút "Bắt đầu"/"Start" thuần FE cho tới khi khách bấm, chưa gọi API gì */}
          {hasStarted ? (
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
          ) : (
            <div className="flex items-center justify-center border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  // Bấm "Bắt đầu"/"Start" vừa mở khoá ô nhập, vừa gửi luôn chính chữ đó làm câu hỏi đầu tiên lên BE.
                  setHasStarted(true);
                  void sendText(t.start);
                }}
                className="w-full rounded-full bg-[#124757] py-3 text-sm font-headline font-bold uppercase tracking-wide text-white transition-transform hover:scale-[1.01] dark:bg-yellow-400 dark:text-slate-900"
              >
                {t.start}
              </button>
            </div>
          )}

          {/* Footer note */}
          <p className="bg-white px-3 pb-2.5 pt-1 text-center text-[10px] leading-snug text-slate-400 dark:bg-slate-900 dark:text-slate-500">
            {chatLang === "VN"
              ? "Trợ lý ảo có thể sai sót, hãy kiểm tra thông tin quan trọng."
              : "The AI assistant can make mistakes. Check important info."}
            {" "}
            <a
              href="/terms-and-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {chatLang === "VN" ? "Điều khoản sử dụng" : "Terms of use"}
            </a>
          </p>
        </div>

        {!isAuthenticated && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center dark:bg-slate-900/85">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {chatLang === "VN" ? "Bạn cần đăng nhập để sử dụng trợ lý ảo." : "Please sign in to use the AI assistant."}
            </p>
            <button
              type="button"
              onClick={handleRequireLogin}
              className="rounded-full bg-[#124757] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] dark:bg-yellow-400 dark:text-slate-900"
            >
              {chatLang === "VN" ? "Đăng nhập" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
