import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import Swal from "sweetalert2";
import {
  fetchSeatLayout,
  generateMatrix,
  configureSeats,
  deleteSeats
} from "../../../services/seatService";
import { fetchBoatDetail } from "../../../services/boatService";

// CẤU HÌNH TOOL PALETTE (BỘ CÔNG CỤ VẼ)
const TOOLS = [
  { id: "NONE", label: "Chuột (Chỉ Xem)", icon: "pan_tool", color: "bg-slate-100 text-slate-600" },
  { id: "SEAT_STANDARD", label: "Ghế Thường (STD)", icon: "chair", color: "bg-blue-100 text-blue-600" },
  { id: "SEAT_CABIN", label: "Ghế Cabin (CAB)", icon: "chair_alt", color: "bg-purple-100 text-purple-600" },
  { id: "SEAT_RIVER", label: "Ghế River (RIV)", icon: "deck", color: "bg-teal-100 text-teal-600" },
  { id: "SEAT_SKY", label: "Ghế Sky (SKY)", icon: "airline_seat_recline_extra", color: "bg-sky-100 text-sky-600" },
  { id: "Aisle", label: "Lối đi", icon: "straight", color: "bg-slate-200 text-slate-400" },
  { id: "Empty", label: "Xóa / Ô trống", icon: "check_box_outline_blank", color: "bg-white border-2 border-slate-200 text-slate-300" },
  { id: "TOILET_H", label: "WC Ngang (1x2)", icon: "wc", color: "bg-amber-100 text-amber-600" },
  { id: "TOILET_V", label: "WC Dọc (2x1)", icon: "wc", color: "bg-amber-100 text-amber-600" }
];

export function SeatLayoutEditor() {
  const { lang } = useApp();
  const { boatId } = useParams();
  const navigate = useNavigate();

  const [boatData, setBoatData] = useState(null);
  const [decksData, setDecksData] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  const [activeTool, setActiveTool] = useState("NONE");

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Form thông số tạo ma trận
  const [inputDecks, setInputDecks] = useState([]);

  // UX Kéo thả chuột để vẽ (Drag to paint)
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // ==========================================
  // EFFECT: TẢI THÔNG TIN TÀU & LAYOUT
  // ==========================================
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Gọi API lấy chi tiết tàu trước để kiểm tra sự tồn tại của ID
      const boat = await fetchBoatDetail(boatId);
      
      // Nếu vì lý do nào đó API không văng lỗi nhưng object tàu trả về trống rỗng
      if (!boat || !boat.id) {
        throw new Error("NOT_FOUND");
      }
      
      setBoatData(boat);
      
      // 2. Nếu tìm thấy tàu hợp lệ, tiếp tục gọi API lấy Layout ghế
      const layout = await fetchSeatLayout(boatId);
      
      // Nếu API trả về ma trận hợp lệ
      if (layout && layout.decks && layout.decks.length > 0) {
        parseAndSetDecksData(layout.decks);
      } else {
        // Tàu chưa có ma trận -> Hiển thị form khởi tạo lưới ban đầu (Generate Form)
        setDecksData(null); 
        const initialDecks = [];
        for (let i = 1; i <= boat.numberOfDecks; i++) {
          initialDecks.push({ deckNumber: i, rowCount: 14, columnCount: 8 });
        }
        setInputDecks(initialDecks);
      }
    } catch (e) {
      console.error("Lỗi khởi tạo Editor hoặc không tìm thấy ID tàu:", e);
      
      // Bắt lỗi 404 (Not Found) từ API hoặc lỗi tự định nghĩa "NOT_FOUND"
      if (e.message === "NOT_FOUND" || e.response?.status === 404) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không tìm thấy phương tiện!" : "Boat Not Found!",
          text: lang === "VN" 
            ? "Mã định danh tàu không tồn tại trên hệ thống." 
            : "The requested boat ID does not exist.",
          confirmButtonColor: "#124757",
          allowOutsideClick: false // Chặn kích bên ngoài để ép người dùng bấm nút
        }).then(() => {
          // Đẩy người dùng văng ra lại trang danh sách quản lý tàu
          navigate("/admin/boats-management");
        });
      } else {
        // Dự phòng cho các lỗi kết nối server hoặc lỗi hệ thống khác
        Swal.fire({
          icon: "warning",
          title: lang === "VN" ? "Lỗi kết nối mạng" : "Connection Error",
          text: lang === "VN" ? "Không thể tải cấu hình tàu vào lúc này." : "Failed to load boat configuration matrix.",
          confirmButtonColor: "#124757"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [boatId]);

  // HÀM HELPER: MAP API RESPONSE VÀO STATE
  const parseAndSetDecksData = (decksArray) => {
    const parsedDecks = {};
    decksArray.forEach(d => {
      const grid = {};

      // 1. Phủ trắng toàn bộ grid mặc định
      for (let r = 1; r <= d.rowCount; r++) {
        for (let c = 1; c <= d.columnCount; c++) {
          grid[`${r}-${c}`] = { row: r, column: c, type: "Empty", rowSpan: 1, columnSpan: 1 };
        }
      }

      // 2. Ghi đè Cells từ BE
      if (d.cells) {
        d.cells.forEach(cell => {
          const typeCode = cell.seatType?.seatTypeCode || cell.seatTypeCode;
          grid[`${cell.row}-${cell.column}`] = {
            row: cell.row, column: cell.column,
            type: cell.type, seatTypeCode: typeCode,
            rowSpan: 1, columnSpan: 1
          };
        });
      }

      // 3. Ghi đè Facilities (Toilet) và mark Hidden ô phụ
      if (d.facilities) {
        d.facilities.forEach(fac => {
          grid[`${fac.startRow}-${fac.startColumn}`] = {
            row: fac.startRow, column: fac.startColumn,
            type: "Toilet", rowSpan: fac.rowSpan, columnSpan: fac.columnSpan
          };
          if (fac.columnSpan === 2) {
            grid[`${fac.startRow}-${fac.startColumn + 1}`] = { row: fac.startRow, column: fac.startColumn + 1, type: "Hidden", rowSpan: 1, columnSpan: 1 };
          } else if (fac.rowSpan === 2) {
            grid[`${fac.startRow + 1}-${fac.startColumn}`] = { row: fac.startRow + 1, column: fac.startColumn, type: "Hidden", rowSpan: 1, columnSpan: 1 };
          }
        });
      }

      parsedDecks[d.deckNumber] = {
        deckNumber: d.deckNumber, rowCount: d.rowCount, columnCount: d.columnCount,
        cells: grid
      };
    });

    setDecksData(parsedDecks);
    if (decksArray.length > 0) setActiveDeck(decksArray[0].deckNumber);
  };

  // LOGIC: GENERATE MỚI HOẶC XÓA SƠ ĐỒ
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      // Gọi API POST /boats/{boatId}/seats/generate
      const res = await generateMatrix(boatId, { decks: inputDecks });
      parseAndSetDecksData(res.decks);
    } catch (e) {
      console.error("Lỗi khi tạo ma trận:", e);
      Swal.fire("Lỗi", "Không thể sinh ma trận. Vui lòng kiểm tra lại.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // HÀM XÓA SƠ ĐỒ
  const handleDeleteLayout = async () => {
    if (!window.confirm(lang === "VN" ? "Cảnh báo: Toàn bộ cấu hình ghế sẽ bị xóa và tàu sẽ trở về Inactive. Trở lại Form tạo lưới ban đầu?" : "Warning: All seating layout will be deleted. Continue?")) return;
    try {
      await deleteSeats(boatId);
      setDecksData(null);
    } catch (e) {
      console.error("Lỗi khi xóa sơ đồ:", e);
      Swal.fire("Lỗi", "Không thể xóa sơ đồ", "error");
    }
  };

  // HÀM HELPER: CẬP NHẬT THÔNG SỐ ROW/COLUMN TRONG FORM GENERATE
  const handleDeckChange = (index, field, value) => {
    setInputDecks(prev => {
      const arr = [...prev];
      arr[index][field] = Number(value);
      return arr;
    });
  };

  // THUẬT TOÁN EDITOR CỐT LÕI (VẼ LƯỚI & GHÉP Ô)
  const handleCellClick = (r, c) => {
    if (activeTool === "NONE") return;

    setDecksData(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      const deck = newState[activeDeck];
      let cell = deck.cells[`${r}-${c}`];

      // 1. Nếu click vào ô Hidden (nửa kia của WC) -> Chuyển về click ô Toilet chính
      if (cell.type === "Hidden") {
        if (deck.cells[`${r}-${c - 1}`]?.type === "Toilet" && deck.cells[`${r}-${c - 1}`].columnSpan === 2) {
          deck.cells[`${r}-${c}`] = { row: r, column: c, type: "Empty", rowSpan: 1, columnSpan: 1 };
          deck.cells[`${r}-${c - 1}`] = { row: r, column: c - 1, type: "Empty", rowSpan: 1, columnSpan: 1 };
        } else if (deck.cells[`${r - 1}-${c}`]?.type === "Toilet" && deck.cells[`${r - 1}-${c}`].rowSpan === 2) {
          deck.cells[`${r}-${c}`] = { row: r, column: c, type: "Empty", rowSpan: 1, columnSpan: 1 };
          deck.cells[`${r - 1}-${c}`] = { row: r - 1, column: c, type: "Empty", rowSpan: 1, columnSpan: 1 };
        }
        cell = deck.cells[`${r}-${c}`];
      }

      // 2. Nếu click ghi đè lên WC cũ -> Phá vỡ WC cũ giải phóng ô bị gộp
      if (cell.type === "Toilet") {
        if (cell.columnSpan === 2) deck.cells[`${r}-${c + 1}`] = { row: r, column: c + 1, type: "Empty", rowSpan: 1, columnSpan: 1 };
        else if (cell.rowSpan === 2) deck.cells[`${r + 1}-${c}`] = { row: r + 1, column: c, type: "Empty", rowSpan: 1, columnSpan: 1 };
      }

      // 3. Xử lý ghi đè Data mới
      let newType = activeTool;
      let seatTypeCode = null;
      let rowSpan = 1;
      let columnSpan = 1;

      if (activeTool.startsWith("SEAT_")) {
        newType = "Seat";
        seatTypeCode = activeTool.split("_")[1];
      }
      else if (activeTool === "TOILET_H") {
        if (c + 1 > deck.columnCount) {
          Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Không đủ không gian viền chèn WC', showConfirmButton: false, timer: 1500 });
          return prev;
        }
        if (deck.cells[`${r}-${c + 1}`].type === "Toilet" || deck.cells[`${r}-${c + 1}`].type === "Hidden") {
          Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Vướng ô khác, hãy xóa ô bên cạnh trước', showConfirmButton: false, timer: 1500 });
          return prev;
        }
        newType = "Toilet"; columnSpan = 2;
        deck.cells[`${r}-${c + 1}`] = { row: r, column: c + 1, type: "Hidden", rowSpan: 1, columnSpan: 1 };
      }
      else if (activeTool === "TOILET_V") {
        if (r + 1 > deck.rowCount) {
          Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Không đủ không gian đáy chèn WC', showConfirmButton: false, timer: 1500 });
          return prev;
        }
        if (deck.cells[`${r + 1}-${c}`].type === "Toilet" || deck.cells[`${r + 1}-${c}`].type === "Hidden") {
          Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Vướng ô khác, hãy xóa ô bên dưới trước', showConfirmButton: false, timer: 1500 });
          return prev;
        }
        newType = "Toilet"; rowSpan = 2;
        deck.cells[`${r + 1}-${c}`] = { row: r + 1, column: c, type: "Hidden", rowSpan: 1, columnSpan: 1 };
      }

      deck.cells[`${r}-${c}`] = { row: r, column: c, type: newType, seatTypeCode, rowSpan, columnSpan };
      return newState;
    });
  };

  const handleMouseDown = (r, c) => {
    setIsMouseDown(true);
    handleCellClick(r, c);
  };

  const handleMouseEnter = (r, c) => {
    // Chỉ kích hoạt tô màu drag nếu Tool không phải Toilet (WC dễ bị kẹt nếu drag quá nhanh)
    if (isMouseDown && activeTool !== "NONE" && !activeTool.startsWith("TOILET_")) {
      handleCellClick(r, c);
    }
  };

  // XUẤT UI CHO TỪNG Ô CELL TRONG GRID
  const getCellUI = (cell) => {
    switch (cell.type) {
      case "Seat":
        if (cell.seatTypeCode === "STANDARD") return { bg: "bg-blue-100 text-blue-700 border-blue-300", label: "STD", icon: "chair" };
        if (cell.seatTypeCode === "CABIN") return { bg: "bg-purple-100 text-purple-700 border-purple-300", label: "CAB", icon: "chair_alt" };
        if (cell.seatTypeCode === "RIVER") return { bg: "bg-teal-100 text-teal-700 border-teal-300", label: "RIV", icon: "deck" };
        if (cell.seatTypeCode === "SKY") return { bg: "bg-sky-100 text-sky-700 border-sky-300", label: "SKY", icon: "airline_seat_recline_extra" };
        return { bg: "bg-slate-200 text-slate-700 border-slate-400", label: cell.seatTypeCode };
      case "Aisle": return { bg: "bg-slate-100 text-slate-400 border-slate-300 border-dashed opacity-50", label: "Lối đi", icon: "straight" };
      case "Empty": return { bg: "bg-white text-slate-300 border-slate-200 border-dashed opacity-40", label: "", icon: "" };
      case "Toilet": return { bg: "bg-amber-100 text-amber-700 border-amber-400 shadow-inner", label: "TOILET", icon: "wc" };
      default: return { bg: "bg-gray-100", label: "?" };
    }
  };

  // VALIDATE & GỬI API CONFIGURE SEATS
  const getTotalSeats = () => {
    let count = 0;
    if (!decksData) return count;
    Object.values(decksData).forEach(deck => {
      Object.values(deck.cells).forEach(c => { if (c.type === "Seat") count++; });
    });
    return count;
  };

  const handleConfigure = async () => {
    const totalDrawn = getTotalSeats();
    if (boatData && totalDrawn !== boatData.seatCount) {
      Swal.fire("Lỗi logic", `Tổng số ghế vẽ trên sơ đồ (${totalDrawn}) ĐANG KHÔNG KHỚP với thông số sức chứa của tàu (${boatData.seatCount}). Cần vẽ thêm hoặc xóa bớt để khớp 100%!`, "error");
      return;
    }

    try {
      setIsConfiguring(true);

      const payloadDecks = Object.values(decksData).map(d => {
        const cells = [];

        Object.values(d.cells).forEach(c => {
          if (c.type === "Hidden") return; // Bỏ qua ô ẩn (thuộc nửa kia của Toilet)

          cells.push({
            row: c.row,
            column: c.column,
            type: c.type,
            seatTypeCode: c.type === "Seat" ? c.seatTypeCode : undefined,
            rowSpan: c.rowSpan || 1,
            columnSpan: c.columnSpan || 1
          });
        });

        return {
          deckNumber: d.deckNumber,
          rowCount: d.rowCount,
          columnCount: d.columnCount,
          cells: cells
        };
      });

      // Gọi API POST /boats/{boatId}/seats/configure
      await configureSeats(boatId, { decks: payloadDecks });

      Swal.fire({
        icon: "success", title: "Cấu hình thành công",
        text: "Sơ đồ ma trận đã được thiết lập. Phương tiện hiện đã chuyển sang trạng thái Active và sẵn sàng mở bán vé!",
        confirmButtonColor: "#124757"
      }).then(() => navigate("/admin/boats-management"));

    } catch (e) {
      // Bóc tách mảng lỗi từ Backend nếu có để hiển thị chi tiết (VD: lỗi validation)
      let errorMessage = e.response?.data?.message || "Lưu sơ đồ cấu hình thất bại từ máy chủ";
      if (e.response?.data?.errors) {
        errorMessage = Object.values(e.response.data.errors).flat().join(" | ");
      }
      Swal.fire("Lỗi cấu hình", errorMessage, "error");
    } finally {
      setIsConfiguring(false);
    }
  };

  // HIỂN THỊ LOADING BAN ĐẦU
  if (isLoading || !boatData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="font-body max-w-350 mx-auto pb-10 space-y-6">

      {/* HEADER GIAO DIỆN CHUNG */}
      <div className="flex flex-col lg:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full">
          <button
            type="button" onClick={() => navigate("/admin/boats-management")}
            className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
          >
            <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? `Cấu hình ghế: ${boatData.name}` : `Seat Config: ${boatData.name}`}
            </h2>
            <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider flex gap-3">
              <span>Mã: {boatData.code}</span>
              <span className="text-slate-300">|</span>
              <span>Layout: {boatData.seatSetupType}</span>
              <span className="text-slate-300">|</span>
              <span className={getTotalSeats() === boatData.seatCount ? 'text-emerald-500' : 'text-rose-500'}>
                TỔNG GHẾ: {boatData.seatCount}
              </span>
            </p>
          </div>
        </div>

        {/* NẾU ĐÃ CÓ DATA -> HIỆN BỘ ĐẾM KIỂM SOÁT UX */}
        {decksData && (
          <div className="shrink-0 text-right bg-slate-50 dark:bg-slate-900 px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner w-full lg:w-auto">
            <div className="text-3xl font-black text-[#124757] dark:text-yellow-400 leading-none flex items-baseline justify-end gap-1">
              <span className={getTotalSeats() !== boatData.seatCount ? 'text-rose-500' : ''}>{getTotalSeats()}</span>
              <span className="text-lg text-slate-400">/ {boatData.seatCount}</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === "VN" ? "Số ô Seat đã vẽ" : "Configured Seats"}
            </p>
          </div>
        )}
      </div>

      {/* MÀN HÌNH 1: NHẬP SỐ DÒNG CỘT ĐỂ GENERATE */}
      {!decksData && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-xl text-center mt-10 animate-fade-in-up">
          <h3 className="text-xl font-black font-headline text-slate-800 dark:text-white uppercase tracking-wider mb-2">
            Khởi tạo ma trận sàn tàu
          </h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
            Khai báo kích thước khung lưới rỗng (Row x Column) cho phương tiện. Hệ thống sẽ đổ toàn bộ ghế lên sàn để bạn bôi/xóa chỉnh sửa sau.
          </p>

          <div className="space-y-4 mb-8 text-left">
            {inputDecks.map((deck, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="w-24 text-sm font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 text-center sm:text-left">
                  Tầng {deck.deckNumber}
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Số hàng ngang (Row)</label>
                  <input type="number" min={1} max={100} value={deck.rowCount} onChange={(e) => handleDeckChange(idx, "rowCount", e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner" />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Số cột dọc (Column)</label>
                  <input type="number" min={1} max={50} value={deck.columnCount} onChange={(e) => handleDeckChange(idx, "columnCount", e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
            {isGenerating ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-lg"></span>}
            Tiến hành tạo lưới
          </button>
        </div>
      )}

      {/* MÀN HÌNH 2: EDITOR PAINT CHÍNH THỨC */}
      {decksData && (
        <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">

          {/* SIDEBAR BỘ CÔNG CỤ TOOLS */}
          <div className="w-full lg:w-75 shrink-0 bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm lg:sticky lg:top-6">
            <h3 className="font-headline font-black text-[10px] text-[#124757] dark:text-yellow-400 uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">construction</span> Hộp công cụ vẽ
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              {TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left overflow-hidden ${activeTool === tool.id ? 'border-[#124757] bg-slate-50 dark:bg-slate-900 dark:border-yellow-400 shadow-sm scale-[1.02]' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${tool.color}`}>
                    <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight uppercase tracking-wider">{tool.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <button onClick={handleConfigure} disabled={isConfiguring} className="w-full bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl shadow-md hover:bg-emerald-600 transition-colors flex justify-center items-center gap-2">
                {isConfiguring ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-base"></span>}
                Lưu Sơ đồ
              </button>
              <button onClick={handleDeleteLayout} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-bold uppercase text-[9px] tracking-widest py-3 rounded-xl hover:bg-rose-100 transition-colors flex justify-center items-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-base">delete</span>
                Xóa làm lại từ đầu
              </button>
            </div>
          </div>

          {/* KHU VỰC GRID HIỂN THỊ */}
          <div className="grow w-full bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col">

            {/* TABS SELECT TẦNG */}
            {Object.keys(decksData).length > 1 && (
              <div className="flex gap-2 mb-6 bg-slate-50 dark:bg-slate-900 p-1.5 w-fit rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                {Object.keys(decksData).map(dk => (
                  <button
                    key={dk}
                    onClick={() => setActiveDeck(dk)}
                    className={`px-6 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeDeck == dk ? 'bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                  >
                    Tầng {dk}
                  </button>
                ))}
              </div>
            )}

            {/* NOTE HƯỚNG MŨI TÀU */}
            <div className="w-full bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 py-2.5 rounded-t-2xl text-[9px] font-headline font-black text-center uppercase tracking-widest shadow-inner">
              Buồng lái - Hướng Mũi tàu
            </div>

            {/* VÙNG GRID BẢN ĐỒ KÉO THẢ */}
            <div className="bg-slate-100/50 dark:bg-slate-900/40 border-x border-dashed border-slate-300 dark:border-slate-700 p-6 overflow-auto custom-scrollbar flex justify-center min-h-100">
              <div
                className="gap-1.5 inline-grid select-none"
                style={{
                  gridTemplateColumns: `repeat(${decksData[activeDeck].columnCount}, 3rem)`,
                  gridTemplateRows: `repeat(${decksData[activeDeck].rowCount}, 3rem)`
                }}
              >
                {Object.values(decksData[activeDeck].cells).map(cell => {
                  if (cell.type === "Hidden") return null;
                  const ui = getCellUI(cell);
                  return (
                    <div
                      key={`${cell.row}-${cell.column}`}
                      onMouseDown={() => handleMouseDown(cell.row, cell.column)}
                      onMouseEnter={() => handleMouseEnter(cell.row, cell.column)}
                      className={`border rounded-lg cursor-pointer flex flex-col items-center justify-center text-[9px] font-black tracking-tighter transition-all duration-75 overflow-hidden shadow-sm ${ui.bg} ${activeTool !== 'NONE' ? 'hover:scale-90 hover:ring-2 hover:ring-[#124757]/30 dark:hover:ring-yellow-400/50 z-10' : ''}`}
                      style={{
                        gridRow: `${cell.row} / span ${cell.rowSpan}`,
                        gridColumn: `${cell.column} / span ${cell.columnSpan}`
                      }}
                    >
                      {ui.icon && <span className="material-symbols-outlined text-[16px] leading-none mb-0.5 opacity-90">{ui.icon}</span>}
                      <span className="leading-none opacity-90">{ui.label}</span>
                      {cell.type === "Seat" && <span className="text-[7px] font-medium opacity-60 mt-0.5 leading-none tracking-normal">{cell.row}-{cell.column}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NOTE HƯỚNG ĐUÔI TÀU */}
            <div className="w-full bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 py-2.5 rounded-b-2xl text-[9px] font-headline font-black text-center uppercase tracking-widest shadow-inner">
              Hướng Đuôi tàu (Động cơ)
            </div>

            <p className="text-[10px] font-bold text-slate-400 text-center mt-4 uppercase tracking-widest">
              💡 Tip: Bạn có thể nhấn giữ chuột trái và kéo lướt qua các ô để vẽ hàng loạt nhanh chóng!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}