import { useMemo, useState } from "react";
import { niceMax, formatShortDate, pickColor, categorical } from "../../utils/chartPalette";

const W = 600;
const H = 220;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 18;
const PAD_B = 28;
const PLOT_RIGHT = W - PAD_R;
const PLOT_BOTTOM = H - PAD_B;

const lineColor = categorical[0]; // slot 1 — blue, 1 series nên không cần legend riêng.

/**
 * Xu hướng số booking theo ngày — line + area 1 series, có crosshair/tooltip khi hover
 * và nút "Xem bảng" để dữ liệu vẫn đọc được không cần hover (đúng nguyên tắc tooltip chỉ bổ trợ).
 */
export function BookingTrendChart({ points, lang, isDarkMode, isLoading }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const counts = points.map((p) => p.count);
  const maxCount = Math.max(0, ...counts);
  const yMax = niceMax(maxCount);
  const n = points.length;
  const xStep = n > 1 ? (PLOT_RIGHT - PAD_L) / (n - 1) : 0;

  const coords = useMemo(
    () =>
      points.map((p, i) => ({
        x: n > 1 ? PAD_L + i * xStep : (PAD_L + PLOT_RIGHT) / 2,
        y: PLOT_BOTTOM - (yMax > 0 ? (p.count / yMax) * (PLOT_BOTTOM - PAD_T) : 0),
        ...p,
      })),
    [points, n, xStep, yMax]
  );

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = n > 0 ? `${linePath} L${coords[n - 1].x.toFixed(1)},${PLOT_BOTTOM} L${coords[0].x.toFixed(1)},${PLOT_BOTTOM} Z` : "";

  const gridFractions = [0, 1 / 3, 2 / 3, 1];
  const color = pickColor(lineColor, isDarkMode);
  const surfaceRing = isDarkMode ? "#1e293b" : "#ffffff"; // khớp bg-slate-800 / bg-white của card

  // Nhãn trục X: đầu, cuối và tối đa vài mốc giữa để tránh chồng chữ.
  const maxLabels = 6;
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels));
  const xLabelIndexes = coords
    .map((_, i) => i)
    .filter((i) => i === 0 || i === n - 1 || i % labelEvery === 0);

  const handleMove = (e) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (n === 1) {
      setHoverIndex(0);
      return;
    }
    const idx = Math.round((relX - PAD_L) / xStep);
    setHoverIndex(Math.min(n - 1, Math.max(0, idx)));
  };

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  if (isLoading) {
    return (
      <div className="h-55 flex items-center justify-center">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="h-55 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
        <span className="material-symbols-outlined text-3xl">show_chart</span>
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu trong khoảng thời gian này." : "No data in this date range."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{showTable ? "show_chart" : "table_rows"}</span>
          {showTable ? (lang === "VN" ? "Xem biểu đồ" : "View chart") : (lang === "VN" ? "Xem bảng" : "View table")}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-55 overflow-y-auto custom-scrollbar rounded-xl border border-slate-100 dark:border-slate-700/60">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-400 font-bold uppercase">
              <tr>
                <th className="text-left py-2 px-3">{lang === "VN" ? "Ngày" : "Date"}</th>
                <th className="text-right py-2 px-3">{lang === "VN" ? "Số booking" : "Bookings"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold">{formatShortDate(p.date)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-800 dark:text-white font-bold">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative select-none">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
            className="overflow-visible cursor-crosshair"
          >
            {/* Gridlines */}
            {gridFractions.map((f) => {
              const y = PLOT_BOTTOM - f * (PLOT_BOTTOM - PAD_T);
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={PLOT_RIGHT} y1={y} y2={y} stroke={isDarkMode ? "#2c2c2a" : "#e1e0d9"} strokeWidth={1} />
                  <text x={0} y={y - 3} fontSize={9} fill={isDarkMode ? "#898781" : "#898781"} fontWeight={700}>
                    {Math.round(yMax * f)}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {n > 1 && <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />}

            {/* Line */}
            {n > 1 && <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

            {/* Crosshair */}
            {hovered && (
              <line x1={hovered.x} x2={hovered.x} y1={PAD_T} y2={PLOT_BOTTOM} stroke={isDarkMode ? "#383835" : "#c3c2b7"} strokeWidth={1} />
            )}

            {/* Điểm cuối — direct label giá trị mới nhất */}
            <circle cx={coords[n - 1].x} cy={coords[n - 1].y} r={5} fill={color} stroke={surfaceRing} strokeWidth={2} />
            <text
              x={Math.min(coords[n - 1].x, W - 24)}
              y={Math.max(coords[n - 1].y - 10, PAD_T)}
              fontSize={11}
              fontWeight={800}
              textAnchor="end"
              fill={isDarkMode ? "#ffffff" : "#0b0b0b"}
            >
              {coords[n - 1].count}
            </text>

            {/* Điểm hover */}
            {hovered && (
              <circle cx={hovered.x} cy={hovered.y} r={5} fill={color} stroke={surfaceRing} strokeWidth={2} />
            )}

            {/* Nhãn trục X */}
            {xLabelIndexes.map((i) => (
              <text
                key={i}
                x={coords[i].x}
                y={H - 8}
                fontSize={9}
                fontWeight={700}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fill={isDarkMode ? "#898781" : "#898781"}
              >
                {formatShortDate(coords[i].date)}
              </text>
            ))}
          </svg>

          {hovered && (
            <div
              className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap"
              style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100 - 4}%` }}
            >
              <p className="text-slate-400 dark:text-slate-500 font-bold">{formatShortDate(hovered.date)}</p>
              <p className="text-slate-800 dark:text-white font-black">
                {hovered.count} {lang === "VN" ? "booking" : "bookings"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
