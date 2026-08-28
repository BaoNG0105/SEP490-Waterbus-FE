import { useMemo, useState } from "react";
import { formatCompactCurrency } from "../../utils/revenueReport";

const W = 520;
const H = 320;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 48;
const PLOT_RIGHT = W - PAD_R;
const PLOT_BOTTOM = H - PAD_B;
const PLOT_W = PLOT_RIGHT - PAD_L;
const PLOT_H = PLOT_BOTTOM - PAD_T;

// Scatter đơn giản: trục X = số booking, trục Y = doanh thu, bán kính điểm = số vé.
// Trục thời gian (W) = ngày trong kỳ.
// points: [{ date, bookingCount, ticketCount, netRevenue }]
export function RevenueScatterChart({ points = [], lang, isDarkMode, isLoading }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    if (!Array.isArray(points) || points.length === 0) return { maxX: 0, maxY: 0, maxR: 0 };
    const xs = points.map((p) => Number(p.bookingCount || 0));
    const ys = points.map((p) => Number(p.netRevenue || 0));
    const rs = points.map((p) => Number(p.ticketCount || 0));
    return {
      maxX: Math.max(1, ...xs),
      maxY: Math.max(1, ...ys),
      maxR: Math.max(1, ...rs),
    };
  }, [points]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[260px]">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[260px] gap-2 text-slate-400">
        <span className="material-symbols-outlined text-3xl">scatter_plot</span>
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  const gridColor = isDarkMode ? "#334155" : "#E2E8F0";
  const labelColor = isDarkMode ? "#cbd5e1" : "#475569";
  const pointColor = isDarkMode ? "#60a5fa" : "#124757";
  const ringColor = isDarkMode ? "#fbbf24" : "#FFD100";

  // Nice scale
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * pow;
  };
  const yMax = niceMax(data.maxY);
  const xMax = niceMax(data.maxX);

  const xToPx = (v) => PAD_L + (v / xMax) * PLOT_W;
  const yToPx = (v) => PLOT_BOTTOM - (v / yMax) * PLOT_H;
  const rToPx = (v) => 3 + (v / data.maxR) * 14;

  // Y axis labels (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  // X axis labels (4 ticks)
  const xTicks = Array.from({ length: 5 }, (_, i) => (xMax / 4) * i);

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Y gridlines + labels */}
        {yTicks.map((v, i) => (
          <g key={`yt-${i}`}>
            <line x1={PAD_L} x2={PLOT_RIGHT} y1={yToPx(v)} y2={yToPx(v)} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <text x={PAD_L - 10} y={yToPx(v) + 4} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="end">
              {formatCompactCurrency(v, lang)}
            </text>
          </g>
        ))}
        {/* X labels */}
        {xTicks.map((v, i) => (
          <g key={`xt-${i}`}>
            <line x1={xToPx(v)} x2={xToPx(v)} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM + 4} stroke={labelColor} strokeWidth={1} />
            <text x={xToPx(v)} y={PLOT_BOTTOM + 18} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="middle">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Axes labels */}
        <text x={PAD_L + PLOT_W / 2} y={H - 8} fontSize={11} fontWeight={800} fill={labelColor} textAnchor="middle">
          {lang === "VN" ? "Số booking" : "Bookings"}
        </text>
        <text
          x={-H / 2}
          y={14}
          fontSize={11}
          fontWeight={800}
          fill={labelColor}
          textAnchor="middle"
          transform="rotate(-90)"
        >
          {lang === "VN" ? "Doanh thu" : "Revenue"}
        </text>

        {/* Points */}
        {points.map((p, i) => {
          const cx = xToPx(p.bookingCount || 0);
          const cy = yToPx(p.netRevenue || 0);
          const r = rToPx(p.ticketCount || 0);
          const isHover = hover === i;
          return (
            <circle
              key={`p-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={pointColor}
              fillOpacity={hover === null || isHover ? 0.55 : 0.18}
              stroke={isHover ? ringColor : pointColor}
              strokeWidth={isHover ? 2 : 1}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            />
          );
        })}

        {/* Hover tooltip */}
        {hovered && hover !== null && (() => {
          const cx = xToPx(hovered.bookingCount || 0);
          const cy = yToPx(hovered.netRevenue || 0);
          const tipW = 170;
          const tipH = 70;
          let tipX = cx + 14;
          let tipY = cy - tipH - 10;
          if (tipX + tipW > PLOT_RIGHT) tipX = cx - tipW - 14;
          if (tipY < PAD_T) tipY = cy + 14;
          return (
            <g pointerEvents="none">
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} fill={isDarkMode ? "#0f172a" : "#fff"} stroke={isDarkMode ? "#475569" : "#E2E8F0"} strokeWidth={1} />
              <text x={tipX + 10} y={tipY + 18} fontSize={11} fontWeight={800} fill={labelColor}>
                {hovered.date}
              </text>
              <text x={tipX + 10} y={tipY + 36} fontSize={12} fontWeight={900} fill={pointColor}>
                {formatCompactCurrency(hovered.netRevenue || 0, lang)}
              </text>
              <text x={tipX + 10} y={tipY + 52} fontSize={11} fontWeight={700} fill={labelColor}>
                {hovered.bookingCount || 0} {lang === "VN" ? "booking" : "bk"} · {hovered.ticketCount || 0} {lang === "VN" ? "vé" : "tix"}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
