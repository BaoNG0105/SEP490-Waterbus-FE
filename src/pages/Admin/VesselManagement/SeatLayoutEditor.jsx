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
    const [matrixData, setMatrixData] = useState(null); // Lưu cấu trúc sơ đồ từ API GET về
    const [activeDeck, setActiveDeck] = useState(0); // Quản lý tầng đang chọn để xem/sửa (Mặc định tầng 0)
    const [cellsLayout, setCellsLayout] = useState({}); // Lưu trạng thái ma trận ô lưới thiết kế { "deck_row_col": { type, seatTypeCode, rowSpan, columnSpan } }

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // State dành cho Form nhập thông số sinh ma trận thô (Nếu tàu chưa từng tạo sơ đồ)
    const [inputDecks, setInputDecks] = useState([
        { deckNumber: 1, rowCount: 0, columnCount: 0 }
    ]);

    // Bộ cọ vẽ Admin chọn: 
    // 1: Seat (Ghế thường), 2: Aisle (Lối đi), 3: Empty (Ô trống), 4: Toilet (WC), 5: Seat-VIP (Ghế VIP)
    const [activeTool, setActiveTool] = useState("NONE");

    // ==========================================
    // EFFECT: TẢI DỮ LIỆU SƠ ĐỒ GHẾ BAN ĐẦU
    // ==========================================
    const loadLayoutData = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const response = await fetchSeatLayout(vesselId);

            // Khớp dữ liệu: Nếu Backend trả về sơ đồ hợp lệ
            if (response && response.decks && response.decks.length > 0) {
                setMatrixData(response);
                setActiveDeck(response.decks[0].deckNumber);

                // Dựng lại dữ liệu ô lưới từ API Backend trả về (nếu tàu đã từng cấu hình hoặc sinh ma trận)
                const initialCells = {};
                response.decks.forEach(deck => {
                    // Khởi tạo ô trống mặc định cho toàn bộ grid rowCount x columnCount
                    for (let r = 1; r <= deck.rowCount; r++) {
                        for (let c = 1; c <= deck.columnCount; c++) {
                            initialCells[`${deck.deckNumber}_${r}_${c}`] = {
                                row: r,
                                column: c,
                                type: 3, // Mặc định ban đầu coi như Empty ô trống
                                seatTypeCode: "STANDARD",
                                rowSpan: 1,
                                columnSpan: 1
                            };
                        }
                    }

                    // Điền dữ liệu các ô cells thật từ database nếu có
                    if (deck.cells && deck.cells.length > 0) {
                        deck.cells.forEach(cell => {
                            initialCells[`${deck.deckNumber}_${cell.row}_${cell.column}`] = {
                                row: cell.row,
                                column: cell.column,
                                type: cell.type,
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
            // Nếu lỗi 404 hoặc trống model, coi như tàu chưa sinh ma trận
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
        setInputDecks(prev => [
            ...prev,
            { deckNumber: prev.length + 1, rowCount: 0, columnCount: 0 }
        ]);
    };

    const handleRemoveDeckInput = (index) => {
        if (inputDecks.length === 1) return; // Không cho xóa nếu chỉ còn 1 tầng
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
            // ĐÓNG GÓI PAYLOAD CHUẨN JSON BACKEND YÊU CẦU
            const payload = { decks: inputDecks };
            console.log("Payload gửi lên API Generate:", payload); // Bạn có thể F12 xem thử JSON trước khi gửi
            // Gọi API POST /vessels/{vesselId}/seats/generate
            await generateMatrix(vesselId, payload);
            // Sinh xong ma trận thô, reload lại để hiển thị lưới Grid
            await loadLayoutData();
        } catch (error) {
            console.error("Generate matrix error:", error);
            setErrorMsg(lang === "VN" ? "Không thể sinh ma trận lưới khoang tàu. Vui lòng thử lại." : "Failed to generate vessel blueprint matrix.");
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
            const updated = { ...prev };

            if (activeTool === "SEAT_STANDARD") {
                updated[key] = { ...updated[key], type: 1, seatTypeCode: "STANDARD", rowSpan: 1, columnSpan: 1 };
            } else if (activeTool === "SEAT_VIP") {
                updated[key] = { ...updated[key], type: 1, seatTypeCode: "VIP", rowSpan: 1, columnSpan: 1 };
            } else if (activeTool === "AISLE") {
                updated[key] = { ...updated[key], type: 2, seatTypeCode: "", rowSpan: 1, columnSpan: 1 };
            } else if (activeTool === "EMPTY") {
                updated[key] = { ...updated[key], type: 3, seatTypeCode: "", rowSpan: 1, columnSpan: 1 };
            } else if (activeTool === "TOILET") {
                // Nghiệp vụ Toilet: Chiếm đúng 2 ô (Ví dụ nằm ngang: rowSpan=1, columnSpan=2)
                // Ô hiện tại là ô gốc bên trái của nhà vệ sinh
                updated[key] = { ...updated[key], type: 4, seatTypeCode: "", rowSpan: 1, columnSpan: 2 };

                // Tự động sơn ô bên cạnh (phải) là ô thuộc Toilet (Hợp nhất phụ)
                const nextKey = `${deckNum}_${row}_${col + 1}`;
                if (updated[nextKey] && col < matrixData.decks.find(d => d.deckNumber === deckNum).columnCount) {
                    updated[nextKey] = { ...updated[nextKey], type: 4, seatTypeCode: "", rowSpan: 1, columnSpan: 0 }; // columnSpan=0 ký hiệu ô bị gộp
                }
            }

            return updated;
        });
    };

    // ==========================================
    // HÀM ĐÓNG GÓI PAYLOAD GỬI API POST /CONFIGURE
    // ==========================================
    const handleExecuteConfigure = async () => {
        try {
            setIsSaving(true);
            setErrorMsg("");

            // Đóng gói dữ liệu chuẩn chỉ từng tầng theo yêu cầu Request Body của Backend
            const decksPayload = matrixData.decks.map(deck => {
                const deckCells = [];
                const deckFacilities = [];

                // Quét toàn bộ lưới của tầng hiện tại (deck.deckNumber)
                for (let r = 1; r <= deck.rowCount; r++) {
                    for (let c = 1; c <= deck.columnCount; c++) {
                        const cellData = cellsLayout[`${deck.deckNumber}_${r}_${c}`];

                        if (cellData) {
                            // 1. Thêm vào mảng cells chi tiết từng ô (Kể cả ghế, lối đi, ô trống)
                            deckCells.push({
                                row: cellData.row,
                                column: cellData.column,
                                type: cellData.type,
                                // Chỉ gửi seatTypeCode nếu ô đó là Ghế (type === 1)
                                seatTypeCode: cellData.type === 1 ? cellData.seatTypeCode : "",
                                rowSpan: cellData.rowSpan,
                                columnSpan: cellData.columnSpan
                            });

                            // 2. Nghiệp vụ Toilet: Nếu ô này là Toilet (type = 4) và là ô gốc (columnSpan > 0)
                            if (cellData.type === 4 && cellData.columnSpan > 0) {
                                deckFacilities.push({
                                    type: 1, // Ký hiệu Toilet của Backend
                                    startRow: cellData.row,
                                    startColumn: cellData.column,
                                    rowSpan: cellData.rowSpan,
                                    columnSpan: cellData.columnSpan
                                });
                            }
                        }
                    }
                }

                return {
                    deckNumber: deck.deckNumber, // 💡 Lấy chuẩn xác số thứ tự tầng (1, 2...)
                    rowCount: deck.rowCount,
                    columnCount: deck.columnCount,
                    seatBlocks: [], // Bỏ trống vì chúng ta đã map chi tiết vỡ lòng bằng mảng cells ở dưới
                    facilities: deckFacilities,
                    cells: deckCells
                };
            });

            // 💡 Sửa root key thành "decks" (chữ d viết thường) khớp với mẫu JSON của bạn
            const finalPayload = { decks: decksPayload };

            // In ra Console để bạn dễ dàng F12 kiểm tra JSON trước khi Backend nhận
            console.log("Payload Configure chuẩn bị gửi API:", finalPayload);

            // Gọi API POST /api/vessels/{vesselId}/seats/configure
            await configureSeats(vesselId, finalPayload);

            alert(lang === "VN" ? "✓ Cấu hình sơ đồ và kích hoạt tàu thành công!" : "✓ Vessel seating map configured successfully!");
            navigate("/admin/vessels-management");
        } catch (error) {
            console.error("Configure seats error:", error);
            const backendMsg = error.response?.data?.message;
            setErrorMsg(backendMsg || (lang === "VN" ? "Cấu hình thất bại. Vui lòng kiểm tra tổng số ghế khớp với sức chứa đăng ký." : "Failed to save layout configuration. Please ensure rules match."));
        } finally {
            setIsSaving(false);
        }
    };

    // ==========================================
    // HÀM VẼ MA TRẬN LƯỚI KHANG TÀU (GRID LABELS)
    // ==========================================
    const renderCurrentDeckGrid = () => {
        const currentDeckInfo = matrixData?.decks?.find(d => d.deckNumber === activeDeck);
        if (!currentDeckInfo) return null;

        let gridRows = [];
        for (let r = 1; r <= currentDeckInfo.rowCount; r++) {
            let gridCells = [];
            for (let c = 1; c <= currentDeckInfo.columnCount; c++) {
                const cell = cellsLayout[`${activeDeck}_${r}_${c}`];

                // Nếu ô này bị gộp sang ô Toilet bên trái (columnSpan = 0), ẩn nó đi để ô gốc kéo dài
                if (cell?.type === 4 && cell?.columnSpan === 0) {
                    continue;
                }

                let cellClasses = "border h-14 rounded-xl font-headline font-black text-xs transition-all flex flex-col items-center justify-center cursor-pointer relative select-none shadow-sm ";
                let icon = "border_clear";
                let label = `${String.fromCharCode(64 + r)}${c}`; // Ví dụ: Hàng 1 Cột 1 -> A1

                if (cell?.type === 1) {
                    // Ô ghế ngồi Seat
                    if (cell.seatTypeCode === "VIP") {
                        cellClasses += "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40";
                        icon = "workspace_premium";
                        label = `${lang === "VN" ? "VIP" : "VIP"}-${label}`;
                    } else {
                        cellClasses += "bg-white border-slate-200 text-[#124757] dark:bg-slate-800 dark:border-slate-700 dark:text-white";
                        icon = "chair";
                    }
                } else if (cell?.type === 2) {
                    // Lối đi Aisle
                    cellClasses += "bg-slate-50 border-transparent text-slate-400 border-dashed dark:bg-slate-900/40";
                    icon = "horizontal_distribute";
                    label = lang === "VN" ? "Lối đi" : "Aisle";
                } else if (cell?.type === 4) {
                    // Nhà vệ sinh Toilet
                    cellClasses += "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/30";
                    icon = "wc";
                    label = "WC";
                } else {
                    // Ô trống rỗng Empty (type = 3)
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
                        style={{ gridColumn: cell?.type === 4 && cell?.columnSpan > 0 ? `span ${cell.columnSpan}` : "auto" }}
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

        return <div className="space-y-2 px-2 min-w-[640px]">{gridRows}</div>;
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

            // Gọi API DELETE
            await deleteSeats(vesselId);

            // Xóa thành công, đưa UI về trạng thái rỗng (Trường hợp 1)
            setMatrixData(null);
            setCellsLayout({});

            alert(lang === "VN" ? "✓ Đã xóa sạch sơ đồ ghế!" : "✓ Layout blueprint wiped successfully!");
        } catch (error) {
            console.error("Delete layout error:", error);
            setErrorMsg(lang === "VN" ? "Không thể xóa sơ đồ hiện tại. Vui lòng thử lại." : "Failed to reset layout. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 select-none font-body max-w-7xl mx-auto">

            {/* HEADER BAR CHÍNH */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/vessels-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Thiết lập sơ đồ khoang tàu matrix" : "Cabin Seating Architecture Setup"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Khởi dựng kích thước lưới màng thô và phân bổ cấu hình chi tiết loại ghế ngồi, hành lang phụ trợ." : "Build matrix dimension grid boundaries and align standard or premium hardware cells."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
                    <span className="material-symbols-outlined">error</span>
                    {errorMsg}
                </div>
            )}

            {/* TRƯỜNG HỢP 1: TÀU CHƯA TỪNG KHỞI TẠO MA TRẬN PHÂN THÂN (matrixData === null) */}
            {!isLoading && !matrixData ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="material-symbols-outlined text-5xl text-amber-500 animate-pulse">grid_on</span>
                        <h3 className="text-lg font-headline font-black text-slate-800 dark:text-white uppercase">{lang === "VN" ? "Bước 1: Khởi tạo chiều kích ma trận lưới" : "Phase 1: Initialize Grid Boundaries"}</h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">{lang === "VN" ? "Tàu này chưa có lưới vật lý. Hãy chỉ định số tầng, số hàng dọc và cột ngang để đúc khuôn ma trận sơ đồ nháp." : "Specify deck rows and columns count blueprint parameters to generate basic physics grid arrays."}</p>
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
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Số hàng (X)" : "Rows Count"}</label>
                                        <input
                                            type="number" min={1} max={30} value={deck.rowCount}
                                            onChange={(e) => handleFormInputChange(idx, "rowCount", e.target.value)}
                                            className="w-20 bg-white dark:bg-slate-800 border rounded-xl px-3 py-1.5 text-xs font-bold text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Số cột (Y)" : "Columns Count"}</label>
                                        <input
                                            type="number" min={1} max={15} value={deck.columnCount}
                                            onChange={(e) => handleFormInputChange(idx, "columnCount", e.target.value)}
                                            className="w-20 bg-white dark:bg-slate-800 border rounded-xl px-3 py-1.5 text-xs font-bold text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
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
                                {lang === "VN" ? "Thêm tầng bốc mái" : "Add Upper Deck"}
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
                /* TRƯỜNG HỢP 2: ĐA CÓ KHUÔN MA TRẬN GRID -> HIỂN THỊ TRÌNH THIẾT KẾ */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">

                    {/* PHẦN LƯỚI GRID DESIGNER (9/12) */}
                    <div className="lg:col-span-9 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm relative min-h-[460px] flex flex-col justify-between overflow-hidden">

                        {/* Thanh Tab chọn Tầng nếu tàu có nhiều tầng (Deck navigation) */}
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

                        {/* Khung khoang lái mũi tàu */}
                        <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[10px] font-headline font-black text-center uppercase tracking-widest mb-6 shadow-inner">
                            🚢 {lang === "VN" ? "Buồng lái - Mũi tàu phương tiện" : "Vessel Command Bridge - Bow Direction"}
                        </div>

                        {/* Hiển thị lưới grid chính */}
                        <div className="overflow-x-auto pb-4 custom-scrollbar">
                            {renderCurrentDeckGrid()}
                        </div>

                        {/* Sàn sau khoang tàu */}
                        <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[10px] font-headline font-black text-center uppercase tracking-widest mt-6 shadow-inner">
                            {lang === "VN" ? "Sàn ngắm cảnh phía sau - Đuôi tàu" : "Stern Back Deck - Exit Area"}
                        </div>
                    </div>

                    {/* THANH PANEL HỘP CÔNG CỤ CỌ VẼ BÊN PHẢI (3/12) */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* CỌ SƠN LOẠI Ô */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                            <h4 className="font-headline font-black text-xs text-slate-400 uppercase tracking-widest border-b pb-2">
                                {lang === "VN" ? "Bảng màu cọ vẽ ô" : "Cell Node Brush Palette"}
                            </h4>

                            <div className="space-y-2">
                                {/* 1. Pointer xem */}
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

                                {/* 2. Ghế tiêu chuẩn standard */}
                                <button
                                    type="button" onClick={() => setActiveTool("SEAT_STANDARD")}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "SEAT_STANDARD"
                                        ? "bg-white text-[#124757] border-slate-300 ring-2 ring-[#124757] shadow-sm font-black"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-base text-slate-400">chair</span>
                                    <span className="text-left">{lang === "VN" ? "Cọ: Ghế tiêu chuẩn (Standard)" : "Brush: Standard Seat"}</span>
                                </button>

                                {/* 3. Ghế VIP thương gia */}
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

                                {/* 4. Hành lang lối đi */}
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

                                {/* 5. Gôm tẩy thành ô trống */}
                                <button
                                    type="button" onClick={() => setActiveTool("EMPTY")}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${activeTool === "EMPTY"
                                        ? "bg-red-50 text-red-600 border-red-300 ring-2 ring-red-500 shadow-sm font-black dark:bg-red-500/10 dark:text-red-400"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-base text-red-500">ink_eraser</span>
                                    <span className="text-left">{lang === "VN" ? "Gôm: Xóa bỏ ô trống" : "Eraser: Set Blank Node"}</span>
                                </button>

                                {/* 6. Nhà vệ sinh Toilet */}
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
                                        <p className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">{lang === "VN" ? "*Sơn sẽ chiếm 2 ô ngang" : "*Occupies 2 horizontal cells"}</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* CAM KẾT SUBMIT ACTION CARD */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                            <h4 className="font-headline font-black text-xs text-slate-400 uppercase tracking-widest border-b pb-2">
                                {lang === "VN" ? "Đồng bộ thiết kế" : "Publish Architecture"}
                            </h4>

                            <div className="text-[11px] font-medium text-slate-400 space-y-1.5 leading-normal">
                                <p>💡 {lang === "VN" ? "Tổng số ghế ngồi cấu hình bắt buộc phải bằng sức chứa quy chuẩn đăng ký của tàu." : "Total allocated seat cells must match vessel original physical capacity."}</p>
                                <p>💡 {lang === "VN" ? "Sau khi lưu thành công, tàu sẽ tự động chuyển sang trạng thái Active mở bán vé." : "Once deployed, the fleet vehicle status model flips to Active ready for operation."}</p>
                            </div>

                            <div className="space-y-2 pt-2">
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
                                            <span className="material-symbols-outlined text-base">layers</span>
                                            {lang === "VN" ? "Lưu và Kích hoạt tàu" : "Configure & Active Fleet"}
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResetLayout} // <--- Gắn hàm mới vào đây
                                    className="w-full bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 text-center py-2.5 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors"
                                >
                                    {lang === "VN" ? "Xóa làm lại từ đầu" : "Reset Grid Mold"}
                                </button>
                            </div>
                        </div>

                    </div>

                </div>
            )}

            {/* HIỆU ỨNG LOADING CHỜ ĐỒNG BỘ BAN ĐẦU */}
            {isLoading && (
                <div className="py-24 text-center text-slate-400 font-medium">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-xs tracking-widest animate-pulse uppercase">{lang === "VN" ? "Đang truy vấn kiến trúc sơ đồ tàu..." : "Fetching cloud model blueprints..."}</p>
                </div>
            )}

        </div>
    );
}