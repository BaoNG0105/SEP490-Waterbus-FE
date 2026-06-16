import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  fetchSeatLayout,
  generateMatrix,
  configureSeats,
  deleteSeats
} from "../../../services/seatService";

export function SeatLayoutEditor() {
  const { lang } = useApp();
  const { vesselId } = useParams();
  const navigate = useNavigate();

  // ==========================================
  // STATE HỆ THỐNG QUẢN LÝ DỮ LIỆU SƠ ĐỒ GHẾ
  // ==========================================
  const [matrixData, setMatrixData] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  const [cellsLayout, setCellsLayout] = useState({});

  const [history, setHistory] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [inputDecks, setInputDecks] = useState([
    { deckNumber: 1, rowCount: 1, columnCount: 1 }
  ]);

  const [activeTool, setActiveTool] = useState("NONE");

  // ==========================================
  // EFFECT: TẢI DỮ LIỆU SƠ ĐỒ GHẾ BAN ĐẦU
  // ==========================================
  const loadLayoutData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const response = await fetchSeatLayout(vesselId);

      if (response && response.decks && response.decks.length > 0) {
        setMatrixData(response);
        setActiveDeck(response.decks[0].deckNumber);

        const initialCells = {};
        response.decks.forEach(deck => {
          // Mặc định là ghế STANDARD (Theo Enum String: type = "Seat")
          for (let r = 1; r <= deck.rowCount; r++) {
            for (let c = 1; c <= deck.columnCount; c++) {
              initialCells[`${deck.deckNumber}_${r}_${c}`] = {
                row: r,
                column: c,
                type: "Seat",
                seatTypeCode: "STANDARD",
                rowSpan: 1,
                columnSpan: 1
              };
            }
          }

          if (deck.cells && deck.cells.length > 0) {
            deck.cells.forEach(cell => {
              initialCells[`${deck.deckNumber}_${cell.row}_${cell.column}`] = {
                row: cell.row,
                column: cell.column,
                type: cell.type, // Chuỗi trả về từ BE: "Seat", "Aisle", "Empty", "Toilet"
                seatTypeCode: cell.seatTypeCode || "STANDARD",
                rowSpan: cell.rowSpan || 1,
                columnSpan: cell.columnSpan || 1
              };
            });
          }
        });
        setCellsLayout(initialCells);
      } else {
        setMatrixData(null);
      }
    } catch (error) {
      console.error("Failed to load seat layout:", error);
      setMatrixData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (vesselId) {
      loadLayoutData();
    }
  }, [vesselId]);

  // ==========================================
  // HÀM XỬ LÝ FORM GENERATE MA TRẬN THÔ
  // ==========================================
  const handleAddDeckInput = () => {
    setInputDecks(prev => [...prev, { deckNumber: prev.length + 1, rowCount: 11, columnCount: 8 }]);
  };

  const handleRemoveDeckInput = (index) => {
    if (inputDecks.length === 1) return;
    setInputDecks(prev =>
      prev.filter((_, i) => i !== index)
        .map((deck, i) => ({ ...deck, deckNumber: i + 1 }))
    );
  };

  const handleFormInputChange = (index, field, value) => {
    setInputDecks(prev => prev.map((d, i) => i === index ? { ...d, [field]: Number(value) } : d));
  };

  const handleExecuteGenerate = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMsg("");
      const payload = { decks: inputDecks };
      await generateMatrix(vesselId, payload);
      await loadLayoutData();
    } catch (error) {
      console.error("Generate matrix error:", error);

      let backendMsg = error.response?.data?.message;
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        backendMsg = `Lỗi hệ thống: ${validationErrors}`;
      }

      setErrorMsg(backendMsg || (lang === "VN" ? "Không thể sinh ma trận lưới khoang tàu. Vui lòng thử lại." : "Failed to generate vessel blueprint matrix."));
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // HÀM TƯƠNG TÁC CLICK SƠN CỌ LÊN Ô LƯỚI GRID
  // ==========================================
  const handleCellClick = (deckNum, row, col) => {
    if (activeTool === "NONE") return;

    const key = `${deckNum}_${row}_${col}`;

    setCellsLayout(prev => {
      // 💡 THÊM MỚI: Chụp lại lưới hiện tại cất vào lịch sử TRƯỚC KHI bị sơn đè
      setHistory(prevHistory => {
        const newHistory = [...prevHistory, prev];
        if (newHistory.length > 50) newHistory.shift(); // Tối ưu bộ nhớ: Chỉ nhớ tối đa 50 bước gần nhất
        return newHistory;
      });

      const updated = { ...prev };

      // Logic cập nhật chuẩn Enum String ("Empty", "Aisle", "Seat", "Toilet")
      if (activeTool === "SEAT_STANDARD") {
        updated[key] = { ...updated[key], type: "Seat", seatTypeCode: "STANDARD", rowSpan: 1, columnSpan: 1 };
      } else if (activeTool === "SEAT_VIP") {
        updated[key] = { ...updated[key], type: "Seat", seatTypeCode: "VIP", rowSpan: 1, columnSpan: 1 };
      } else if (activeTool === "AISLE") {
        updated[key] = { ...updated[key], type: "Aisle", seatTypeCode: "", rowSpan: 1, columnSpan: 1 };
      } else if (activeTool === "EMPTY") {
        updated[key] = { ...updated[key], type: "Empty", seatTypeCode: "", rowSpan: 1, columnSpan: 1 };
      } else if (activeTool === "TOILET") {
        const maxCols = matrixData.decks.find(d => d.deckNumber === deckNum).columnCount;
        if (col >= maxCols) {
          alert(lang === "VN" ? "Không đủ không gian chiều ngang đặt Toilet (Yêu cầu 2 ô ngang)!" : "Not enough column width for Toilet span!");
          return prev;
        }
        updated[key] = { ...updated[key], type: "Toilet", seatTypeCode: "", rowSpan: 1, columnSpan: 2 };
        const nextKey = `${deckNum}_${row}_${col + 1}`;
        updated[nextKey] = { ...updated[nextKey], type: "Toilet", seatTypeCode: "", rowSpan: 1, columnSpan: 0 };
      }

      return updated;
    });
  };

  // ==========================================
  // HÀM HOÀN TÁC (UNDO)
  // ==========================================
  const handleUndo = () => {
    if (history.length === 0) return;

    setHistory(prevHistory => {
      const newHistory = [...prevHistory];
      const previousLayout = newHistory.pop(); // Lấy bản sao gần nhất ra khỏi lịch sử
      setCellsLayout(previousLayout);          // Phục hồi lại lưới
      return newHistory;
    });
  };

  // ==========================================
  // HÀM ĐÓNG GÓI PAYLOAD GỬI API POST /CONFIGURE
  // ==========================================
  const handleExecuteConfigure = async () => {
    try {
      setIsSaving(true);
      setErrorMsg("");

      const decksPayload = matrixData.decks.map(deck => {
        const deckCells = [];
        for (let r = 1; r <= deck.rowCount; r++) {
          for (let c = 1; c <= deck.columnCount; c++) {
            const cellData = cellsLayout[`${deck.deckNumber}_${r}_${c}`];

            if (cellData) {
              // 1. Lọc các ghế STANDARD theo mặc định để không gửi lên (Tối ưu payload)
              const isDefaultStandardSeat = cellData.type === "Seat" && cellData.seatTypeCode === "STANDARD";

              // 2. Lọc bỏ "Ô Gộp Ảo" của Toilet (Bên UI ta set columnSpan = 0 để ẩn nó đi)
              const isHiddenDummyCell = cellData.columnSpan === 0;

              // NẾU Ô BỊ OVERRIDE & KHÔNG PHẢI LÀ Ô ẢO -> ĐÓNG GÓI VÀO CELLS
              if (!isDefaultStandardSeat && !isHiddenDummyCell) {
                deckCells.push({
                  row: cellData.row,
                  column: cellData.column,
                  type: cellData.type,     // Backend sẽ nhận diện "Toilet", "Aisle", "Seat", "Empty" ở đây
                  seatTypeCode: cellData.type === "Seat" ? cellData.seatTypeCode : "",
                  rowSpan: cellData.rowSpan,
                  columnSpan: cellData.columnSpan
                });
              }
            }
          }
        }
        return {
          deckNumber: deck.deckNumber,
          rowCount: deck.rowCount,
          columnCount: deck.columnCount,
          cells: deckCells
        };
      });

      const finalPayload = { decks: decksPayload };
      console.log("Payload Gửi đi (Chỉ dùng Cells):", JSON.stringify(finalPayload, null, 2));

      await configureSeats(vesselId, finalPayload);

      alert(lang === "VN" ? "Cấu hình sơ đồ và kích hoạt tàu thành công!" : "Vessel seating map configured successfully!");
      navigate("/admin/vessels-management");
    } catch (error) {
      console.error("Configure seats error:", error);

      let backendMsg = error.response?.data?.message;
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        backendMsg = `Lỗi Validation: ${validationErrors}`;
      } else if (error.response?.data?.title) {
        backendMsg = `Lỗi hệ thống: ${error.response.data.title}`;
      }

      setErrorMsg(backendMsg || (lang === "VN" ? "Cấu hình thất bại. Vui lòng kiểm tra lại." : "Failed to save configuration."));
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // HÀM GỌI API DELETE XÓA SẠCH MA TRẬN GHẾ
  // ==========================================
  const handleResetLayout = async () => {
    if (!window.confirm(lang === "VN" ? "Bạn chắc chắn muốn xóa toàn bộ sơ đồ/ma trận hiện tại để làm lại từ đầu chứ?" : "Are you sure you want to completely wipe the current matrix blueprint?")) {
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg("");
      await deleteSeats(vesselId);
      setMatrixData(null);
      setCellsLayout({});
      alert(lang === "VN" ? "Đã xóa sạch sơ đồ ghế!" : "Layout blueprint wiped successfully!");
    } catch (error) {
      console.error("Delete layout error:", error);
      setErrorMsg(lang === "VN" ? "Không thể xóa sơ đồ hiện tại. Vui lòng thử lại." : "Failed to reset layout.");
    } finally {
      setIsLoading(false);
    }
  };

  // Bộ đếm tự động
  const currentTotalSeats = Object.values(cellsLayout).filter(cell => cell.type === "Seat").length;

  // ==========================================
  // HÀM VẼ MA TRẬN LƯỚI KHANG TÀU (GRID RENDERING)
  // ==========================================
  const renderCurrentDeckGrid = () => {
    const currentDeckInfo = matrixData?.decks?.find(d => d.deckNumber === activeDeck);
    if (!currentDeckInfo) return null;

    let gridRows = [];
    for (let r = 1; r <= currentDeckInfo.rowCount; r++) {
      let gridCells = [];
      for (let c = 1; c <= currentDeckInfo.columnCount; c++) {
        const cell = cellsLayout[`${activeDeck}_${r}_${c}`];

        if (cell?.type === "Toilet" && cell?.columnSpan === 0) {
          continue;
        }

        let cellClasses = "border h-14 rounded-xl font-headline font-black text-xs transition-all flex flex-col items-center justify-center cursor-pointer relative select-none shadow-sm ";
        let icon = "chair";
        let label = `${String.fromCharCode(64 + r)}${c}`;

        if (cell?.type === "Seat") {
          if (cell.seatTypeCode === "VIP") {
            cellClasses += "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40";
            icon = "workspace_premium";
            label = `VIP-${label}`;
          } else {
            cellClasses += "bg-white border-slate-200 text-[#124757] dark:bg-slate-800 dark:border-slate-700 dark:text-white";
            icon = "chair";
          }
        } else if (cell?.type === "Aisle") {
          cellClasses += "bg-slate-50 border-transparent text-slate-400 border-dashed dark:bg-slate-900/40";
          icon = "horizontal_distribute";
          label = lang === "VN" ? "Lối đi" : "Aisle";
        } else if (cell?.type === "Toilet") {
          cellClasses += "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/30";
          icon = "wc";
          label = "WC";
        } else {
          // Trạng thái ô trống rỗng (type = "Empty")
          cellClasses += "bg-slate-100/50 border-slate-200/50 text-slate-300 border-dashed dark:bg-slate-900/10 dark:text-slate-700";
          icon = "close";
          label = "";
        }

        if (activeTool !== "NONE") cellClasses += " hover:ring-2 hover:ring-yellow-400";

        gridCells.push(
          <div
            key={`cell-${r}-${c}`}
            onClick={() => handleCellClick(activeDeck, r, c)}
            className={cellClasses}
            style={{ gridColumn: cell?.type === "Toilet" && cell?.columnSpan > 0 ? `span ${cell.columnSpan}` : "auto" }}
          >
            <span className="material-symbols-outlined text-[16px] opacity-70 mb-0.5">{icon}</span>
            <span className="text-[10px] tracking-tight">{label}</span>
          </div>
        );
      }

      gridRows.push(
        <div key={`row-${r}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${currentDeckInfo.columnCount}, minmax(0, 1fr))` }}>
          {gridCells}
        </div>
      );
    }

    return <div className="space-y-2 px-2 min-w-160">{gridRows}</div>;
  };

  return (
    <div className="space-y-6 select-none font-body max-w-7xl mx-auto">

      {/* HEADER TITLE */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/vessels-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-slate-700 hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Thiết lập sơ đồ khoang tàu matrix" : "Cabin Seating Architecture Setup"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Khởi dựng khuôn ma trận thô và gán cọ sơn để tạo điểm nhấn override lối đi, nhà vệ sinh hoặc hạng ghế VIP." : "Build basic matrix boundary dimensions and override custom structural node blocks."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
          <span className="material-symbols-outlined">error</span>
          {errorMsg}
        </div>
      )}

      {/* GIAI ĐOẠN 1: TÀU CHƯA CÓ BLUEPRINT MATRIX (HIỂN THỊ FORM GENERATE) */}
      {!isLoading && !matrixData ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-headline font-black text-slate-800 dark:text-white uppercase">{lang === "VN" ? "Bước 1: Khởi tạo chiều kích ma trận lưới" : "Phase 1: Initialize Grid Boundaries"}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{lang === "VN" ? "Hãy chỉ định số thứ tự tầng (bắt đầu từ 1), số hàng dọc và cột ngang để đúc khuôn ma trận sơ đồ rỗng." : "Specify deck rows and columns count blueprint parameters to generate basic physics grid arrays."}</p>
          </div>

          <form onSubmit={handleExecuteGenerate} className="space-y-4 pt-2">
            {inputDecks.map((deck, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border flex flex-wrap items-center gap-4 justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-headline font-black text-[#124757] dark:text-yellow-400 uppercase bg-white dark:bg-slate-800 border px-2.5 py-1.5 rounded-xl shadow-inner">
                    {lang === "VN" ? `TẦNG ${deck.deckNumber}` : `DECK ${deck.deckNumber}`}
                  </span>
                </div>

                <div className="flex items-center gap-4 grow justify-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Số hàng (rowCount)" : "Rows Count"}</label>
                    <input
                      type="number" min={1} max={30} value={deck.rowCount}
                      onChange={(e) => handleFormInputChange(idx, "rowCount", e.target.value)}
                      className="w-20 bg-white dark:bg-slate-800 border rounded-xl px-3 py-1.5 text-xs font-bold text-center dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Số cột (columnCount)" : "Columns Count"}</label>
                    <input
                      type="number" min={1} max={15} value={deck.columnCount}
                      onChange={(e) => handleFormInputChange(idx, "columnCount", e.target.value)}
                      className="w-20 bg-white dark:bg-slate-800 border rounded-xl px-3 py-1.5 text-xs font-bold text-center dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  {inputDecks.length > 1 && (
                    <button
                      type="button" onClick={() => handleRemoveDeckInput(idx)}
                      className="text-rose-500 hover:text-rose-600 self-end mb-1 p-1"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button" onClick={handleAddDeckInput}
                className="text-xs font-bold text-[#124757] dark:text-yellow-400 hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">add</span>
                {lang === "VN" ? "Thêm tầng" : "Add Upper Deck"}
              </button>

              <button
                type="submit"
                className="bg-yellow-400 text-[#124757] font-headline font-black uppercase text-xs tracking-wider px-6 py-3 rounded-xl shadow-sm hover:scale-[1.01] transition-transform"
              >
                {lang === "VN" ? "Khởi dựng khuôn ma trận" : "Generate Core Matrix"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* GIAI ĐOẠN 2: ĐÃ CÓ KHUÔN LƯỚI (HIỂN THỊ GRID EDITOR + CỌ SƠN TỐI ƯU OVERRIDE) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">

          {/* LƯỚI ĐỒ HỌA KHOANG TÀU (9/12) */}
          <div className="lg:col-span-9 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative min-h-115 flex flex-col justify-between overflow-hidden">

            {matrixData?.decks?.length > 1 && (
              <div className="flex items-center gap-2 mb-6 border-b pb-3 overflow-x-auto">
                {matrixData.decks.map(deck => (
                  <button
                    key={deck.deckNumber} type="button"
                    onClick={() => setActiveDeck(deck.deckNumber)}
                    className={`px-4 py-2 rounded-xl text-xs font-headline font-black uppercase transition-all tracking-wider ${activeDeck === deck.deckNumber
                      ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                      : "bg-slate-50 text-slate-400 border hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                      }`}
                  >
                    {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[10px] font-headline font-black text-center uppercase tracking-widest mb-6 shadow-inner">
              {lang === "VN" ? "Buồng lái - Phía mũi tàu" : "Vessel Command Bridge - Bow Direction"}
            </div>

            <div className="overflow-x-auto pb-4 custom-scrollbar">
              {renderCurrentDeckGrid()}
            </div>

            <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[10px] font-headline font-black text-center uppercase tracking-widest mt-6 shadow-inner">
              {lang === "VN" ? "Sàn sau tàu - Khu vực thoát hiểm" : "Stern Back Deck - Exit Area"}
            </div>
          </div>

          {/* HỘP CÔNG CỤ SIDEBAR (3/12) */}
          <div className="lg:col-span-3 space-y-6">

            {/* BOX CHỌN LOẠI CỌ SƠN */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-headline font-black text-xs text-slate-400 uppercase tracking-widest">
                  {lang === "VN" ? "Bảng màu cọ vẽ ô" : "Cell Node Brush Palette"}
                </h4>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-[#124757] dark:hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border shadow-inner"
                  title="Hoàn tác bước vừa rồi"
                >
                  <span className="material-symbols-outlined text-[14px]">undo</span>
                  {lang === "VN" ? "Quay lại" : "Undo"}
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button" onClick={() => setActiveTool("NONE")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "NONE"
                    ? "bg-[#124757] text-white border-transparent shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base">ads_click</span>
                  <span className="text-left">{lang === "VN" ? "Chuột con trỏ (Chỉ xem)" : "Pointer (Inspect Mode)"}</span>
                </button>

                <button
                  type="button" onClick={() => setActiveTool("SEAT_STANDARD")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "SEAT_STANDARD"
                    ? "bg-white text-[#124757] border-slate-300 ring-2 ring-[#124757] shadow-sm font-black"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base text-slate-400">chair</span>
                  <span className="text-left">{lang === "VN" ? "Cọ: Ghế Thường" : "Brush: Reset Standard"}</span>
                </button>

                <button
                  type="button" onClick={() => setActiveTool("SEAT_VIP")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "SEAT_VIP"
                    ? "bg-amber-500/20 text-amber-700 border-amber-400 ring-2 ring-amber-500 shadow-sm font-black dark:text-amber-400"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base text-amber-500">workspace_premium</span>
                  <span className="text-left">{lang === "VN" ? "Cọ: Ghế thương gia (VIP)" : "Brush: VIP Seating"}</span>
                </button>

                <button
                  type="button" onClick={() => setActiveTool("AISLE")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "AISLE"
                    ? "bg-slate-200 text-slate-700 border-slate-400 ring-2 ring-slate-500 shadow-sm font-black"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base text-slate-400">horizontal_distribute</span>
                  <span className="text-left">{lang === "VN" ? "Cọ: Hành lang lối đi" : "Brush: Corridor Aisle"}</span>
                </button>

                <button
                  type="button" onClick={() => setActiveTool("EMPTY")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "EMPTY"
                    ? "bg-red-50 text-red-600 border-red-300 ring-2 ring-red-500 shadow-sm font-black dark:bg-red-500/10 dark:text-red-400"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base text-red-500">ink_eraser</span>
                  <span className="text-left">{lang === "VN" ? "Gôm: Biến thành ô trống" : "Eraser: Set Blank Node"}</span>
                </button>

                <button
                  type="button" onClick={() => setActiveTool("TOILET")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "TOILET"
                    ? "bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-600 shadow-sm font-black"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-base text-indigo-500">wc</span>
                  <div className="text-left">
                    <p>{lang === "VN" ? "Cọ: Nhà vệ sinh (WC)" : "Brush: Restroom Toilet"}</p>
                    <p className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">{lang === "VN" ? "*Sơn tự gộp 2 ô ngang" : "*Spans 2 horizontal cells"}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* BOX ĐỒNG BỘ SUBMIT */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
              <h4 className="font-headline font-black text-xs text-slate-400 uppercase tracking-widest border-b pb-2">
                {lang === "VN" ? "Đồng bộ thiết kế" : "Publish Architecture"}
              </h4>

              <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 flex items-center justify-between shadow-inner">
                <span className="text-xs font-bold text-slate-500">
                  {lang === "VN" ? "Số ghế (Seat) trên lưới:" : "Seats on grid:"}
                </span>
                <span
                  className={`text-base font-black font-headline ${currentTotalSeats === matrixData?.totalSeats
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                    }`}
                >
                  {currentTotalSeats}
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">
                    / {matrixData?.totalSeats || "?"}
                  </span>
                </span>
              </div>

              <div className="text-[11px] font-medium text-slate-400 space-y-2 leading-normal">
                <p className="text-emerald-600 font-bold dark:text-emerald-400">- {lang === "VN" ? "Hệ thống tối ưu: Chỉ upload các ô bị override." : "Optimized: Only changed cells will sync."}</p>
                <p>- {lang === "VN" ? "Tổng số ô Seat thật cuối cùng phải bằng sức chứa SeatCount quy chuẩn của tàu." : "Total allocated seat elements must equal vessel passenger limits."}</p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleExecuteConfigure}
                  disabled={isSaving}
                  className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-md hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      {lang === "VN" ? "Lưu và Kích hoạt tàu" : "Configure & Active Fleet"}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 text-center py-2.5 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors"
                >
                  {lang === "VN" ? "Xóa làm lại từ đầu" : "Reset Grid Mold"}
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* LOADING SPINNER CORES */}
      {isLoading && (
        <div className="py-24 text-center text-slate-400 font-medium">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs tracking-widest animate-pulse uppercase">{lang === "VN" ? "Đang truy vấn kiến trúc sơ đồ tàu..." : "Fetching cloud model blueprints..."}</p>
        </div>
      )}

    </div>
  );
}