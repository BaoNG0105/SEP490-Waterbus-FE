import { useMemo, useState } from "react";
import { formatCompactCurrency, getPaymentMethodLabel } from "../../utils/revenueReport";

const W = 900;
const H = 320;
const PAD_L = 60;
const PAD_R = 30;
const PAD_T = 30;
const PAD_B = 55;
const PLOT_RIGHT = W - PAD_R;
const PLOT_BOTTOM = H - PAD_B;
const PLOT_H = PLOT_BOTTOM - PAD_T;

const PAYMENT_COLORS = [
  "#3B82F6", // blue - CASH
  "#10B981", // green - BANKING
  "#8B5CF6", // purple - MOMO
  "#F59E0B", // amber - ZALO
  "#EF4444", // red
  "#06B6D4", // cyan
];

/**
 * Combo chart: Bar (doanh thu ròng theo ngày) + Line (từng phương thức thanh toán).
 * points: [{ date: "dd/MM/yyyy", netRevenue }]
 * paymentLines: [{ method: "CASH", label: "Tiền mặt", values: [v1, v2, ...] }]
 */
export function RevenueBarChart({ points = [], paymentLines = [], lang, isDarkMode, isLoading }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const values = points.map((p) => p.netRevenue || 0);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);

  // Scale cho bars (dùng maxValue)
  const barScale = useMemo(() => {
    if (maxValue === 0) return { top: 0, step: 1 };
    const targetSteps = 5;
    const rawStep = maxValue / targetSteps;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / pow;
    const niceNorms = [1, 2, 5];
    let bestNorm = niceNorms[0];
    let minDiff = Infinity;
    for (const nn of niceNorms) {
      const diff = Math.abs(nn - norm);
      if (diff < minDiff) { minDiff = diff; bestNorm = nn; }
    }
    const step = bestNorm * pow;
    const top = Math.ceil(maxValue / step) * step;
    return { top, step };
  }, [maxValue]);

  // Y scale dùng max của cả 2 - CHUNG TRỤC
  const yMax = barScale.top;
  const yMin = minValue >= 0 ? 0 : minValue;
  const yRange = yMax - yMin || 1;
  const n = points.length;
  const barGap = 4;
  const barW = n > 0 ? Math.max(4, (PLOT_RIGHT - PAD_L) / n - barGap) : 0;

  const gridColor = isDarkMode ? "#334155" : "#E2E8F0";
  const labelColor = isDarkMode ? "#cbd5e1" : "#475569";
  const axisColor = isDarkMode ? "#64748b" : "#94A3B8";
  const barColor = isDarkMode ? "#60a5fa" : "#3B82F6";
  const barHoverColor = isDarkMode ? "#93C5FD" : "#2563EB";
  const barNegColor = isDarkMode ? "#F87171" : "#EF4444";
  const avgLineColor = isDarkMode ? "#FBBF24" : "#F59E0B";

  // Y-axis labels
  const yAxisLabels = useMemo(() => {
    if (barScale.top === 0) return [];
    const steps = Math.round(barScale.top / barScale.step);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = i * barScale.step;
      const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
      return { val, y, label: formatCompactCurrency(val, lang) };
    });
  }, [barScale, yMin, yRange, lang]);

  // Avg line
  const avgValue = n > 0 ? maxValue / n : 0;
  const avgY = avgValue > 0 ? PLOT_BOTTOM - ((avgValue - yMin) / yRange) * PLOT_H : 0;
  const avgLabel = avgValue > 0 ? `${lang === "VN" ? "TB" : "Avg"} ${formatCompactCurrency(avgValue, lang)}` : null;

  // X labels
  const xLabelIndices = useMemo(() => {
    if (n === 0) return [];
    const count = Math.min(n, 7);
    const step = Math.max(1, Math.floor((n - 1) / (count - 1)));
    const idxs = [];
    for (let i = 0; i < n && idxs.length < count; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== n - 1) idxs[idxs.length - 1] = n - 1;
    return idxs;
  }, [n]);

  const handleMove = (e) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (relX < PAD_L || relX > PLOT_RIGHT) { setHoverIdx(null); return; }
    const colW = (PLOT_RIGHT - PAD_L) / n;
    const idx = Math.floor((relX - PAD_L) / colW);
    setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
  };

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  // Tạo line path cho payment lines (cùng scale với bars)
  const getPaymentPath = (values) => {
    if (n === 0 || barScale.top === 0) return null;
    const scaleY = (v) => PLOT_BOTTOM - (v / barScale.top) * PLOT_H;
    const xStep = (PLOT_RIGHT - PAD_L) / Math.max(n - 1, 1);
    const pts = values.map((v, i) => {
      const x = PAD_L + i * xStep;
      const y = scaleY(v || 0);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    });
    return pts.join(" ");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-2 text-slate-400">
        <span className="material-symbols-outlined text-4xl">bar_chart</span>
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y-axis gridlines */}
        {yAxisLabels.map((lbl, i) => (
          <line key={`y-grid-${i}`} x1={PAD_L} x2={PLOT_RIGHT} y1={lbl.y} y2={lbl.y} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" />
        ))}

        {/* X-axis baseline */}
        <line x1={PAD_L} x2={PLOT_RIGHT} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke={axisColor} strokeWidth={1.5} />

        {/* Y-axis labels */}
        {yAxisLabels.map((lbl, i) => (
          <text key={`y-label-${i}`} x={PAD_L - 8} y={lbl.y + 4} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="end">
            {lbl.label}
          </text>
        ))}

        {/* X-axis date labels */}
        {xLabelIndices.map((idx) => {
          const x = PAD_L + (idx + 0.5) * ((PLOT_RIGHT - PAD_L) / n);
          return (
            <text key={`x-label-${idx}`} x={x} y={H - 12} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="middle">
              {points[idx].date}
            </text>
          );
        })}

        {/* Baseline 0 */}
        {yMin < 0 && (
          <line x1={PAD_L} x2={PLOT_RIGHT} y1={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H} y2={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H} stroke={isDarkMode ? "#EF4444" : "#DC2626"} strokeWidth={1.5} />
        )}

        {/* Bars */}
        {points.map((p, i) => {
          const val = p.netRevenue || 0;
          const colW = (PLOT_RIGHT - PAD_L) / n;
          const x = PAD_L + i * colW + (colW - barW) / 2;
          const zeroY = PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H;
          const valY = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
          const top = Math.min(zeroY, valY);
          const h = Math.abs(zeroY - valY);
          const isHover = hoverIdx === i;
          const color = val < 0 ? barNegColor : (isHover ? barHoverColor : barColor);
          return (
            <rect key={`bar-${i}`} x={x} y={top} width={barW} height={h} fill={color} rx={3} opacity={hoverIdx === null || isHover ? 1 : 0.4} />
          );
        })}

        {/* Payment lines */}
        {paymentLines.map((line, li) => {
          const color = PAYMENT_COLORS[li % PAYMENT_COLORS.length];
          const path = getPaymentPath(line.values || []);
          if (!path) return null;
          return (
            <g key={`pm-line-${li}`}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {/* Dots */}
              {line.values?.map((v, i) => {
                if (barScale.top === 0) return null;
                const xStep = (PLOT_RIGHT - PAD_L) / Math.max(n - 1, 1);
                const x = PAD_L + i * xStep;
                const y = PLOT_BOTTOM - ((v || 0) / barScale.top) * PLOT_H;
                const isHover = hoverIdx === i;
                return <circle key={`dot-${li}-${i}`} cx={x} cy={y} r={isHover ? 5 : 3} fill={color} stroke={isDarkMode ? "#1e293b" : "#fff"} strokeWidth={1.5} opacity={hoverIdx === null || isHover ? 1 : 0.5} />;
              })}
            </g>
          );
        })}

        {/* Avg line */}
        {avgLabel && (
          <>
            <line x1={PAD_L} x2={PLOT_RIGHT} y1={avgY} y2={avgY} stroke={avgLineColor} strokeWidth={1.5} strokeDasharray="6 4" />
            <rect x={PLOT_RIGHT - 90} y={avgY - 20} width={86} height={18} fill={isDarkMode ? "#1e293b" : "#fff"} stroke={avgLineColor} strokeWidth={1} rx={4} />
            <text x={PLOT_RIGHT - 47} y={avgY - 7} textAnchor="middle" fontSize={11} fontWeight={800} fill={avgLineColor}>
              {avgLabel}
            </text>
          </>
        )}

        {/* Max value label */}
        {(() => {
          const maxIdx = points.reduce((best, p, i) => ((p.netRevenue || 0) > (points[best]?.netRevenue || 0) ? i : best), 0);
          const val = points[maxIdx]?.netRevenue || 0;
          if (val <= 0) return null;
          const colW = (PLOT_RIGHT - PAD_L) / n;
          const x = PAD_L + maxIdx * colW + colW / 2;
          const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H - 6;
          return (
            <text x={x} y={y} textAnchor="middle" fontSize={12} fontWeight={900} fill={isDarkMode ? "#93C5FD" : "#1D4ED8"}>
              {formatCompactCurrency(val, lang)}
            </text>
          );
        })()}

        {/* Hover tooltip */}
        {hoverPoint && hoverIdx !== null && (() => {
          const colW = (PLOT_RIGHT - PAD_L) / n;
          const x = PAD_L + hoverIdx * colW + colW / 2;
          const val = hoverPoint.netRevenue || 0;
          const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
          const tipW = 160;
          const tipH = 36 + (paymentLines.length > 0 ? paymentLines.length * 18 : 0);
          let tipX = x - tipW / 2;
          let tipY = y - tipH - 10;
          if (tipY < 4) tipY = y + 10;
          if (tipX < 4) tipX = 4;
          if (tipX + tipW > W - 4) tipX = W - tipW - 4;
          return (
            <g pointerEvents="none">
              <line x1={x} x2={x} y1={PAD_T} y2={PLOT_BOTTOM} stroke={barHoverColor} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill={isDarkMode ? "#0f172a" : "#fff"} stroke={isDarkMode ? "#475569" : "#cbd5e1"} />
              <text x={tipX + 10} y={tipY + 18} fontSize={11} fontWeight={700} fill={labelColor}>{hoverPoint.date}</text>
              <text x={tipX + 10} y={tipY + 34} fontSize={13} fontWeight={900} fill={barHoverColor}>{formatCompactCurrency(val, lang)}</text>
              {paymentLines.slice(0, 3).map((l, li) => {
                const color = PAYMENT_COLORS[li % PAYMENT_COLORS.length];
                const pv = l.values?.[hoverIdx] || 0;
                return (
                  <g key={`tip-pm-${li}`}>
                    <circle cx={tipX + 10} cy={tipY + 50 + li * 18} r={4} fill={color} />
                    <text x={tipX + 20} y={tipY + 54 + li * 18} fontSize={10} fontWeight={700} fill={labelColor}>{l.label || getPaymentMethodLabel(l.method, lang)}:</text>
                    <text x={tipX + tipW - 10} y={tipY + 54 + li * 18} fontSize={10} fontWeight={800} fill={color} textAnchor="end">{formatCompactCurrency(pv, lang)}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      {paymentLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 px-1">
          {paymentLines.map((l, li) => {
            const color = PAYMENT_COLORS[li % PAYMENT_COLORS.length];
            return (
              <div key={`legend-${li}`} className="flex items-center gap-1.5">
                <svg width="20" height="10" className="inline-block">
                  <line x1="0" y1="5" x2="20" y2="5" stroke={color} strokeWidth={2} />
                </svg>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{l.label || getPaymentMethodLabel(l.method, lang)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
