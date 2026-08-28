import { useMemo, useState } from "react";
import { formatCurrency } from "../../utils/bookingReport";

const SIZE = 280;
const CENTER = SIZE / 2;
const R_OUTER = 120;
const R_INNER = 75;

/**
 * Donut chart cho doanh thu theo dịch vụ / phương thức thanh toán.
 * data: [{ key, label, value, color }]
 */
export function RevenueDonutChart({ data = [], lang, isDarkMode, isLoading, title }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const total = useMemo(() => data.reduce((s, d) => s + (d.value || 0), 0), [data]);

  // Build arc paths
  const arcs = useMemo(() => {
    if (total === 0) return [];
    let cumAngle = -Math.PI / 2; // start at top
    return data.map((d, i) => {
      const slice = ((d.value || 0) / total) * 2 * Math.PI;
      const value = d.value || 0;
      const midAngle = cumAngle + slice / 2;
      const labelR = R_OUTER + 16;
      const lx = CENTER + labelR * Math.cos(midAngle);
      const ly = CENTER + labelR * Math.sin(midAngle);

      // Trường hợp segment = 100% (toàn bộ vòng tròn): arc A từ 0° đến 0° không vẽ được
      // → vẽ full circle ring bằng 2 nửa bán nguyệt.
      if (slice >= 2 * Math.PI - 1e-6) {
        const fullRing = [
          `M ${CENTER + R_OUTER} ${CENTER}`,
          `A ${R_OUTER} ${R_OUTER} 0 1 1 ${CENTER - R_OUTER} ${CENTER}`,
          `A ${R_OUTER} ${R_OUTER} 0 1 1 ${CENTER + R_OUTER} ${CENTER}`,
          `M ${CENTER + R_INNER} ${CENTER}`,
          `A ${R_INNER} ${R_INNER} 0 1 0 ${CENTER - R_INNER} ${CENTER}`,
          `A ${R_INNER} ${R_INNER} 0 1 0 ${CENTER + R_INNER} ${CENTER}`,
          "Z",
        ].join(" ");
        cumAngle += slice;
        return { path: fullRing, color: d.color, value, pct: 100, lx, ly };
      }

      const startAngle = cumAngle;
      const endAngle = cumAngle + slice;
      cumAngle = endAngle;

      const cosS = Math.cos(startAngle), sinS = Math.sin(startAngle);
      const cosE = Math.cos(endAngle), sinE = Math.sin(endAngle);
      const largeArc = slice > Math.PI ? 1 : 0;

      const x1o = CENTER + R_OUTER * cosS, y1o = CENTER + R_OUTER * sinS;
      const x2o = CENTER + R_OUTER * cosE, y2o = CENTER + R_OUTER * sinE;
      const x1i = CENTER + R_INNER * cosS, y1i = CENTER + R_INNER * sinS;
      const x2i = CENTER + R_INNER * cosE, y2i = CENTER + R_INNER * sinE;

      const path = [
        `M ${x1o} ${y1o}`,
        `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x2o} ${y2o}`,
        `L ${x2i} ${y2i}`,
        `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${x1i} ${y1i}`,
        "Z",
      ].join(" ");

      return { path, color: d.color, value, pct: (value / total) * 100, lx, ly };
    });
  }, [data, total]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px]">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-slate-400 dark:text-slate-500">
        <span className="material-symbols-outlined text-3xl">pie_chart</span>
        <p className="text-xs font-bold">
          {lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {title && (
        <h4 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1.5 text-center">
          {title}
        </h4>
      )}
      <div className="flex items-center gap-3 flex-1">
        {/* Donut SVG */}
        <div className="relative shrink-0" style={{ width: "60%" }}>
          <svg width="100%" height="auto" viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
            {arcs.map((arc, i) => (
              <path
                key={data[i]?.key || i}
                d={arc.path}
                fill={arc.color}
                stroke={isDarkMode ? "#1e293b" : "#ffffff"}
                strokeWidth={2}
                opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.35}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer transition-opacity duration-150"
              />
            ))}
            {/* Center label */}
            <text x={CENTER} y={CENTER - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="#898781">
              {lang === "VN" ? "Tổng" : "Total"}
            </text>
            <text x={CENTER} y={CENTER + 12} textAnchor="middle" fontSize={16} fontWeight={900} fill={isDarkMode ? "#e2e8f0" : "#0b0b0b"}>
              {formatCurrency(total)}
            </text>
            {hoverIdx !== null && data[hoverIdx] && (
              <text x={CENTER} y={CENTER + 32} textAnchor="middle" fontSize={14} fontWeight={800} fill={data[hoverIdx].color}>
                {total > 0 ? `${((data[hoverIdx].value || 0) / total * 100).toFixed(1)}%` : "0%"}
              </text>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 min-w-0">
          {data.map((d, i) => (
            <div
              key={d.key || i}
              className="flex items-center gap-2 cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${d.value === 0 ? "opacity-30" : ""}`}
                style={{ backgroundColor: d.color }}
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate flex-1">
                {d.label}
              </span>
              <span className="text-xs font-black text-slate-800 dark:text-white shrink-0">
                {total > 0 ? `${((d.value || 0) / total * 100).toFixed(0)}%` : "0%"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
