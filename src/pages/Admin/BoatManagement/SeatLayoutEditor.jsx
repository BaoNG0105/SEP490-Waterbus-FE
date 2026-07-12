import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import Swal from "sweetalert2";
import {
  generateMatrix,
  configureSeats
} from "../../../services/seatService";
import { fetchBoatDetail } from "../../../services/boatService";
import { SeatMapIcon, seatToneFromCode } from "../../../components/SeatMapIcon";
import { BoatBowLabel } from "../../../components/ShipWheelIcon";

// BỘ CÔNG CỤ VẼ Ô
const ALL_TOOLS = [
  { id: "NONE", label: "Chuột (Chỉ Xem)", icon: "pan_tool", color: "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50" },
  { id: "SEAT_STANDARD", label: "Ghế Thường (STD)", icon: "chair", tone: "standard", color: "bg-transparent border-transparent text-blue-600" },
  { id: "SEAT_CABIN", label: "Ghế Cabin (CAB)", icon: "chair_alt", tone: "cabin", color: "bg-transparent border-transparent text-purple-600" },
  { id: "SEAT_RIVER", label: "Ghế River (RIV)", icon: "deck", tone: "river", color: "bg-transparent border-transparent text-teal-600" },
  { id: "SEAT_SKY", label: "Ghế Sky (SKY)", icon: "airline_seat_recline_extra", tone: "sky", color: "bg-transparent border-transparent text-sky-600" },
  { id: "Aisle", label: "Lối đi", icon: "directions_walk", color: "bg-slate-200/60 dark:bg-slate-700/50 border-transparent text-slate-400 dark:text-slate-500 shadow-inner" },
  { id: "Empty", label: "Khoảng trống", icon: "close", color: "bg-transparent border-dashed border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600" },
];

export function SeatLayoutEditor() {
  const { lang } = useApp();
  const params = useParams(); 
  const targetId = params.id || params.boatId; 
  const navigate = useNavigate();

  const [boatData, setBoatData] = useState(null);
  const [activeTool, setActiveTool] = useState("NONE");
  const [isDrawing, setIsDrawing] = useState(false);
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadInitData = async () => {
      try {
        setIsLoading(true);
        const detail = await fetchBoatDetail(targetId);

        if (detail.seatsConfigured) {
          await Swal.fire({
            icon: 'warning',
            title: lang === "VN" ? 'Sơ đồ ghế đã được cấu hình' : 'Seat Layout Already Configured',
            text: lang === "VN"
              ? 'Tàu này đã có sơ đồ ghế. Vui lòng vào trang chỉnh sửa tàu để quản lý trạng thái ghế hoặc xóa sơ đồ trước khi thiết kế lại.'
              : 'This boat already has a configured seat layout. Manage seat status or delete the layout from the boat edit page first.',
            confirmButtonColor: '#124757',
          });
          navigate(`/admin/boats-management/edit/${targetId}`);
          return;
        }

        setBoatData(detail);

        const initDecks = Array.from({ length: detail.numberOfDecks || 1 }, (_, i) => ({
          id: i + 1,
          type: i === 0 ? 'MAIN' : 'UPPER',
          rows: 10,
          columns: 7,
          matrix: []
        }));
        setDecks(initDecks);
        setActiveDeck(1);
      } catch (error) {
        console.error("Lỗi khởi tạo sơ đồ:", error);
        Swal.fire('Lỗi', 'Không tải được dữ liệu tàu', 'error').then(() => navigate('/admin/boats-management'));
      } finally {
        setIsLoading(false);
      }
    };
    loadInitData();
  }, [targetId, navigate, lang]);

  const getAvailableTools = (setupType) => {
    if (setupType === "FullStandard") {
      return ALL_TOOLS.filter(t => ["NONE", "SEAT_STANDARD", "Aisle", "Empty"].includes(t.id));
    } else {
      return ALL_TOOLS.filter(t => ["NONE", "SEAT_CABIN", "SEAT_RIVER", "SEAT_SKY", "Aisle", "Empty"].includes(t.id));
    }
  };

  const currentTools = getAvailableTools(boatData?.seatSetupType || "FullStandard");
  const hasMatrix = decks.some(d => d.matrix && d.matrix.length > 0);

  const handleGenerateLayout = async () => {
    try {
      setIsLoading(true);
      const payload = {
        decks: decks.map(d => ({
          deckNumber: d.id,
          rowCount: d.rows,
          columnCount: d.columns
        }))
      };
      
      const res = await generateMatrix(targetId, payload);
      if (res && res.decks) {
        const defaultSeatCode = boatData.seatSetupType === "StandardAndVip" ? "CABIN" : "STANDARD";
        const mappedDecks = res.decks.map(d => ({
          id: d.deckNumber,
          type: d.deckNumber === 1 ? 'MAIN' : 'UPPER',
          rows: d.rowCount,
          columns: d.columnCount,
          matrix: d.cells.map(c => ({
            row: c.row,
            column: c.column,
            type: c.type === "Seat" ? `SEAT_${c.seatTypeCode || defaultSeatCode}` : c.type
          }))
        }));
        setDecks(mappedDecks);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Đã sinh ma trận lưới thành công', showConfirmButton: false, timer: 2000 });
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể sinh ma trận ghế', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const applyToolToCell = (deckId, row, col) => {
    if (activeTool === "NONE") return;
    setDecks(prev => prev.map(deck => {
      if (deck.id !== deckId) return deck;
      const newMatrix = [...deck.matrix];
      const cellIndex = newMatrix.findIndex(c => c.row === row && c.column === col);

      if (cellIndex >= 0) {
        newMatrix[cellIndex].type = activeTool;
      }
      return { ...deck, matrix: newMatrix };
    }));
  };

  const handleCellMouseDown = (deckId, row, col) => {
    setIsDrawing(true);
    applyToolToCell(deckId, row, col);
  };

  const handleCellMouseEnter = (deckId, row, col) => {
    if (isDrawing) applyToolToCell(deckId, row, col);
  };

  const handleSaveConfiguration = async () => {
    if (!boatData) return;

    try {
      setIsSubmitting(true);

      const defaultSeatCode = boatData.seatSetupType === "StandardAndVip" ? "CABIN" : "STANDARD";

      const payload = {
        decks: decks.map(deck => {
          const formattedCells = deck.matrix.map(cell => {
            let beType = "Empty";
            let seatCode = null;

            if (cell.type?.startsWith("SEAT_")) {
              beType = "Seat";
              seatCode = cell.type.replace("SEAT_", "");
            } else if (cell.type === "Aisle" || cell.type === "Empty") {
              beType = cell.type;
            }

            return { row: cell.row, column: cell.column, type: beType, seatTypeCode: seatCode };
          });

          const overrideCells = formattedCells.filter(c => {
            if (c.type === "Seat" && c.seatTypeCode === defaultSeatCode) return false;
            return true;
          });

          return {
            deckNumber: deck.id,
            rowCount: deck.rows,
            columnCount: deck.columns,
            cells: overrideCells
          };
        })
      };

      await configureSeats(targetId, payload);

      Swal.fire({
        icon: 'success',
        title: 'Cấu hình hoàn tất',
        text: 'Sơ đồ ghế đã được lưu và đã cập nhật tổng số lượng ghế cho tàu!',
        confirmButtonColor: '#124757'
      }).then(() => navigate('/admin/boats-management'));

    } catch (error) {
      console.error(error);
      Swal.fire('Thất bại', 'Đã xảy ra lỗi khi lưu cấu hình lưới.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCellUI = (cellType) => {
    const tool = ALL_TOOLS.find(t => t.id === cellType);
    return tool
      ? { icon: tool.icon, label: tool.label.split(" ")[0], color: tool.color, tone: tool.tone || null, isSeat: Boolean(tool.tone) }
      : { icon: "", label: "", color: "bg-white", tone: null, isSeat: false };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentDeckData = decks.find(d => d.id === activeDeck);

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto" onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}>
      
      {/* HEADER BẢNG ĐIỀU KHIỂN */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button onClick={() => navigate("/admin/boats-management")} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center">
          <span className="material-symbols-outlined font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
            {lang === "VN" ? `Thiết kế sơ đồ: Tàu ${boatData?.name || boatData?.boatName}` : `Layout Editor: ${boatData?.name || boatData?.boatName}`}
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Loại: <span className="text-blue-500">{boatData?.seatSetupType}</span> | Sức chứa hiện tại: <span className="text-emerald-500">{boatData?.seatCount} ghế</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* PANEL TRÁI: CẤU HÌNH VÀ CÔNG CỤ */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700 shadow-sm sticky top-24">
            
            {!hasMatrix && (
              <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-[10px] font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider mb-3">
                  Tùy chỉnh số ô lưới
                </h4>
                <div className="space-y-3">
                  {decks.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12">Tầng {d.id}</span>
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <input 
                          type="number" min={1} value={d.rows} 
                          onChange={(e) => setDecks(prev => prev.map(deck => deck.id === d.id ? { ...deck, rows: Number(e.target.value) } : deck))}
                          className="w-12 sm:w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-[#124757]" 
                          title="Số hàng (Rows)"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">X</span>
                        <input 
                          type="number" min={1} value={d.columns} 
                          onChange={(e) => setDecks(prev => prev.map(deck => deck.id === d.id ? { ...deck, columns: Number(e.target.value) } : deck))}
                          className="w-12 sm:w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-[#124757]" 
                          title="Số cột (Columns)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="text-xs font-black font-headline uppercase text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Bảng công cụ vẽ</h3>
            
            <div className="space-y-3">
              {currentTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-bold transition-all border-2 ${
                    activeTool === tool.id ? 'border-[#124757] dark:border-yellow-400 scale-105 shadow-lg' : 'border-slate-200 dark:border-slate-700'
                  } ${tool.tone ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200' : tool.color}`}
                >
                  {tool.tone ? (
                    <span className="inline-block h-8 w-7 shrink-0">
                      <SeatMapIcon tone={tool.tone} showLabel={false} />
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">{tool.icon}</span>
                  )}
                  {tool.label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
              <button onClick={handleGenerateLayout} disabled={hasMatrix} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                1. Sinh ma trận lưới
              </button>
              <button onClick={handleSaveConfiguration} disabled={isSubmitting || !hasMatrix} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                2. Áp dụng cấu hình
              </button>
            </div>
          </div>
        </div>

        {/* PANEL PHẢI: KHU VỰC BẢN VẼ LƯỚI */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex gap-2 p-2 bg-white dark:bg-slate-800 rounded-2xl w-max shadow-sm border border-slate-100 dark:border-slate-700 mx-auto lg:mx-0">
            {decks.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDeck(d.id)}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeDeck === d.id ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Tầng {d.id} ({d.type})
              </button>
            ))}
          </div>

          {!hasMatrix ? (
            <div className="h-112.5 bg-slate-50 dark:bg-slate-900/50 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">grid_on</span>
              <p className="font-bold text-slate-500 mb-1">Thiết lập số hàng và cột ở Panel bên trái.</p>
              <p className="text-xs">Sau đó nhấn "Sinh ma trận lưới" để bắt đầu thiết kế chỗ ngồi.</p>
            </div>
          ) : currentDeckData && (
            <div className="w-full bg-white dark:bg-slate-800 p-6 md:p-10 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center overflow-x-auto">
              
              <div className={`relative overflow-visible bg-slate-100 dark:bg-slate-900/80 border-8 border-slate-300 dark:border-slate-600 rounded-t-[12rem] rounded-b-[3rem] px-8 md:px-14 pb-16 shadow-2xl min-w-max flex flex-col items-center ${Number(activeDeck) === 1 ? "pt-16" : "pt-10"}`}>
                
                {Number(activeDeck) === 1 ? (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2">
                    <BoatBowLabel lang={lang} />
                  </div>
                ) : null}

                <div
                  className="grid gap-2 relative z-10 mx-auto overflow-visible p-2"
                  style={{
                    gridTemplateColumns: `repeat(${currentDeckData.columns}, 48px)`,
                    gridTemplateRows: `repeat(${currentDeckData.rows}, 52px)`
                  }}
                >
                  {currentDeckData.matrix.map((cell) => {
                    const ui = getCellUI(cell.type);
                    const isSeatCell = cell.type?.startsWith("SEAT_");
                    return (
                      <div
                        key={`${cell.row}-${cell.column}`}
                        onMouseDown={() => handleCellMouseDown(currentDeckData.id, cell.row, cell.column)}
                        onMouseEnter={() => handleCellMouseEnter(currentDeckData.id, cell.row, cell.column)}
                        className={`relative z-[1] flex flex-col items-center justify-center rounded-xl border-2 w-full h-full text-[9px] font-bold cursor-crosshair select-none transition-all duration-300 ${ui.color} ${activeTool !== 'NONE' ? 'hover:scale-90 hover:ring-4 ring-slate-400/20 z-20' : ''}`}
                        style={{ gridRow: cell.row, gridColumn: cell.column }}
                      >
                        {isSeatCell ? (
                          <SeatMapIcon
                            label={`${cell.row}-${cell.column}`}
                            tone={ui.tone || seatToneFromCode(cell.type)}
                            className="w-[94%] h-[94%] pointer-events-none"
                          />
                        ) : (
                          ui.icon ? <span className="material-symbols-outlined text-[20px] leading-none opacity-90">{ui.icon}</span> : null
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Đuôi Tàu */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-60">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Đuôi Tàu</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}