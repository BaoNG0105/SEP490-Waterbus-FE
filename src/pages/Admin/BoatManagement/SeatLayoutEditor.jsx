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

// CẤU HÌNH TOOL PALETTE
const TOOLS = [
  { id: "NONE", label: "Chuột (Chỉ Xem)", icon: "pan_tool", color: "bg-slate-100 text-slate-600" },
  { id: "SEAT_STANDARD", label: "Ghế Thường (STD)", icon: "chair", color: "bg-blue-100 text-blue-600" },
  { id: "SEAT_CABIN", label: "Ghế Cabin (CAB)", icon: "chair_alt", color: "bg-purple-100 text-purple-600" },
  { id: "SEAT_RIVER", label: "Ghế River (RIV)", icon: "deck", color: "bg-teal-100 text-teal-600" },
  { id: "SEAT_SKY", label: "Ghế Sky (SKY)", icon: "airline_seat_recline_extra", color: "bg-sky-100 text-sky-600" },
  { id: "Aisle", label: "Lối đi", icon: "view_stream", color: "bg-slate-300 text-slate-700" },
  { id: "Empty", label: "Khoảng trống", icon: "check_box_outline_blank", color: "bg-white text-slate-400 border border-slate-300" },
];

export function SeatLayoutEditor() {
  const { lang } = useApp();
  const { id } = useParams(); // boatId
  const navigate = useNavigate();

  const [boatData, setBoatData] = useState(null);
  const [activeTool, setActiveTool] = useState("NONE");
  const [isDrawing, setIsDrawing] = useState(false);
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LOAD DỮ LIỆU TÀU VÀ SƠ ĐỒ GHẾ BAN ĐẦU
  useEffect(() => {
    const loadInitData = async () => {
      try {
        setIsLoading(true);
        const detail = await fetchBoatDetail(id);
        setBoatData(detail);

        // Load ma trận layout nếu tàu đã được cấu hình (seatsConfigured = true)
        if (detail.seatsConfigured) {
          const layoutData = await fetchSeatLayout(id);
          if (layoutData && layoutData.decks) {
            const mappedDecks = layoutData.decks.map(d => ({
              id: d.deckNumber,
              type: d.deckNumber === 1 ? 'MAIN' : 'UPPER',
              rows: d.rowCount,
              columns: d.columnCount,
              // Map dữ liệu API về format UI
              matrix: d.cells.map(c => ({
                row: c.row,
                column: c.column,
                type: c.type === "Seat" ? `SEAT_${c.seatTypeCode}` : c.type
              }))
            }));
            setDecks(mappedDecks);
            setActiveDeck(mappedDecks[0]?.id);
          }
        } else {
          // Khởi tạo deck ảo nếu chưa cấu hình
          const initDecks = [
            { id: 1, type: 'MAIN', rows: 10, columns: 6, matrix: [] }
          ];
          setDecks(initDecks);
          setActiveDeck(1);
        }
      } catch (error) {
        console.error("Lỗi khởi tạo sơ đồ:", error);
        Swal.fire('Lỗi', 'Không tải được dữ liệu tàu', 'error').then(() => navigate('/admin/boats-management'));
      } finally {
        setIsLoading(false);
      }
    };
    loadInitData();
  }, [id, navigate]);

  // SINH MA TRẬN TỪ BE
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
      
      const res = await generateMatrix(id, payload);
      if (res && res.decks) {
        const mappedDecks = res.decks.map(d => ({
          id: d.deckNumber,
          type: d.deckNumber === 1 ? 'MAIN' : 'UPPER',
          rows: d.rowCount,
          columns: d.columnCount,
          matrix: d.cells.map(c => ({
            row: c.row,
            column: c.column,
            type: c.type === "Seat" ? `SEAT_${c.seatTypeCode}` : c.type
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

  // LOGIC VẼ MAP BẰNG CHUỘT
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

  // LƯU CẤU HÌNH GỬI LÊN BACKEND (LOGIC OVERRIDE)
  const handleSaveConfiguration = async () => {
    if (!boatData) return;

    // 1. VALIDATE TỔNG SỐ GHẾ (Chỉ đếm các ô là SEAT)
    let totalMappedSeats = 0;
    decks.forEach(deck => {
      deck.matrix.forEach(cell => {
        if (cell.type?.startsWith("SEAT_")) totalMappedSeats++;
      });
    });

    if (totalMappedSeats !== boatData.seatCount) {
      Swal.fire({
        icon: 'error',
        title: lang === 'VN' ? 'Sai số lượng ghế' : 'Capacity Mismatch',
        text: lang === 'VN' 
            ? `Tàu có sức chứa ${boatData.seatCount} ghế, nhưng bạn đang vẽ ${totalMappedSeats} ghế trên bản đồ!`
            : `Expected ${boatData.seatCount} seats, but mapped ${totalMappedSeats} seats.`,
        confirmButtonColor: '#124757'
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // 2. NẾU TÀU ĐÃ ĐƯỢC CONFIG TRƯỚC ĐÓ -> GỌI API DELETE DỌN SẠCH DATA CŨ
      if (boatData.seatsConfigured) {
        await deleteSeats(id);
      }

      // 3. TẠO DTO THEO CƠ CHẾ GHI ĐÈ (OVERRIDE)
      const defaultSeatCode = boatData.boatType === "StandardAndVip" ? "CABIN" : "STANDARD";

      const payload = {
        decks: decks.map(deck => {
          
          // Map toàn bộ ma trận UI sang chuẩn DTO
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

          // Tiết kiệm băng thông: Chỉ gửi lên mảng Override (Bỏ đi những ô ghế đúng chuẩn Mặc định)
          const overrideCells = formattedCells.filter(c => {
            // Loại bỏ ô mặc định
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

      // 4. GỌI API CONFIGURE
      await configureSeats(id, payload);
      
      Swal.fire({
        icon: 'success',
        title: 'Cấu hình hoàn tất',
        text: 'Sơ đồ ghế đã được kích hoạt thành công!',
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
    const tool = TOOLS.find(t => t.id === cellType);
    return tool ? { icon: tool.icon, label: tool.label.split(" ")[0], color: tool.color } : { icon: "", label: "", color: "bg-white" };
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
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase">
            {lang === "VN" ? `Thiết kế sơ đồ: Tàu ${boatData?.boatName}` : `Layout Editor: ${boatData?.boatName}`}
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            Kiểu tàu: <span className="text-yellow-500">{boatData?.boatType}</span> | Sức chứa: <span className="text-emerald-500">{boatData?.seatCount} ghế</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* THANH CÔNG CỤ TOOLS */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700 shadow-sm sticky top-24">
            <h3 className="text-xs font-black font-headline uppercase text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Bảng công cụ vẽ</h3>
            <div className="space-y-2">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                    activeTool === tool.id ? 'border-[#124757] dark:border-yellow-400 shadow-md scale-105' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'
                  } ${tool.color}`}
                >
                  <span className="material-symbols-outlined text-lg">{tool.icon}</span>
                  {tool.label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
              <button onClick={handleGenerateLayout} disabled={currentDeckData?.matrix?.length > 0} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                1. Sinh ma trận lưới
              </button>
              <button onClick={handleSaveConfiguration} disabled={isSubmitting || !currentDeckData?.matrix?.length} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                2. Áp dụng lưu cấu hình
              </button>
            </div>
          </div>
        </div>

        {/* KHU VỰC BẢN VẼ LƯỚI */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex gap-2 p-2 bg-white dark:bg-slate-800 rounded-2xl w-max shadow-sm border border-slate-100 dark:border-slate-700">
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

          {currentDeckData && currentDeckData.matrix.length === 0 ? (
            <div className="h-100 bg-slate-50 dark:bg-slate-900/50 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-2">grid_on</span>
              <p className="font-bold">Nhấn "Sinh ma trận lưới" để bắt đầu thiết kế</p>
            </div>
          ) : currentDeckData && (
            <div className="w-full overflow-x-auto bg-white dark:bg-slate-800 p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center">
              
              <div className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-3 rounded-t-2xl text-[10px] font-headline font-black text-center uppercase tracking-[0.2em] shadow-sm">
                Hướng Mũi tàu (Cabin lái)
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-900 w-full flex justify-center border-x border-slate-200 dark:border-slate-700">
                <div 
                  className="grid gap-1 md:gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${currentDeckData.columns}, minmax(40px, 50px))`,
                    gridTemplateRows: `repeat(${currentDeckData.rows}, minmax(40px, 50px))`
                  }}
                >
                  {currentDeckData.matrix.map((cell) => {
                    const ui = getCellUI(cell.type);
                    return (
                      <div
                        key={`${cell.row}-${cell.column}`}
                        onMouseDown={() => handleCellMouseDown(currentDeckData.id, cell.row, cell.column)}
                        onMouseEnter={() => handleCellMouseEnter(currentDeckData.id, cell.row, cell.column)}
                        className={`flex flex-col items-center justify-center rounded-lg border text-[9px] font-bold cursor-crosshair select-none transition-colors ${ui.color} ${activeTool !== 'NONE' ? 'hover:scale-95 z-10' : ''}`}
                        style={{ gridRow: cell.row, gridColumn: cell.column }}
                      >
                        {ui.icon && <span className="material-symbols-outlined text-[16px] leading-none mb-0.5 opacity-90">{ui.icon}</span>}
                        {cell.type?.startsWith("SEAT_") && <span className="text-[7px] font-medium opacity-60 mt-0.5 leading-none tracking-normal">{cell.row}-{cell.column}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-3 rounded-b-2xl text-[10px] font-headline font-black text-center uppercase tracking-[0.2em] shadow-sm mt-0">
                Hướng Đuôi tàu (Động cơ)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}