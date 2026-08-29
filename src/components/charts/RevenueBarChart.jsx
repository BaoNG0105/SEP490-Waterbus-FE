import { useMemo, useState } from "react";
import { formatCompactCurrency, getPaymentMethodLabel } from "../../utils/revenueReport";

const W = 900;
const H = 340;
const PAD_L = 64;
const PAD_R = 28;
const PAD_T = 36;
const PAD_B = 56;
const PLOT_RIGHT = W - PAD_R;
const PLOT_BOTTOM = H - PAD_B;
const PLOT_H = PLOT_BOTTOM - PAD_T;

const PAYMENT_COLORS = {
  Cash: "#F97316", // orange
  PayOS: "#EC4899", // pink
  Free: "#6B7280", // slate
};
const PAYMENT_FALLBACK = ["#F97316", "#EC4899", "#6B7280", "#A855F7", "#10B981", "#EF4444"];

const MONTH_LABELS_VN = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const MONTH_LABELS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Combo chart: Bar (doanh thu theo ngày) + Lines (Tiền mặt / Chuyển khoản / Miễn phí).
 * Trục X gọn: chỉ ngày đầu/cuối + dòng "From – To" ở giữa.
 *
 * points: [{ date: "dd/MM/yyyy", netRevenue }]
 * paymentLines: [{ method, label, values: [v1, v2, ...] }]
 */
export function RevenueBarChart({ points = [], paymentLines = [], lang, isDarkMode, isLoading }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const parsedPoints = useMemo(
    () => points.map((p) => {
      const str = String(p.date || "");
      let _day, _month, _year;
      if (str.includes("/")) {
        const [d, m, y] = str.split("/");
        _day = Number(d); _month = Number(m); _year = Number(y);
      } else {
        const parts = str.split("-");
        _year = Number(parts[0]); _month = Number(parts[1]); _day = Number(parts[2]);
      }
      return { ...p, _day, _month, _year };
    }),
    [points]
  );

  const yearsInfo = useMemo(() => {
    const years = [...new Set(parsedPoints.map((p) => p._year).filter(Boolean))].sort((a, b) => a - b);
    return { years, hasMultiple: years.length > 1 };
  }, [parsedPoints]);

  const monthLabels = lang === "VN" ? MONTH_LABELS_VN : MONTH_LABELS_EN;
  const formatXLabel = (p) => {
    if (!p._month || !p._day) return "";
    return `${monthLabels[p._month - 1]} ${p._day}`;
  };

  const values = parsedPoints.map((p) => p.netRevenue || 0);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);

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

  const yMax = barScale.top;
  const yMin = minValue >= 0 ? 0 : minValue;
  const yRange = yMax - yMin || 1;
  const n = parsedPoints.length;
  const barGap = 5;
  const barW = n > 0 ? Math.max(4, (PLOT_RIGHT - PAD_L) / n - barGap) : 0;

  // Theme tokens
  const plotBgTop = isDarkMode ? "rgba(30, 41, 59, 0.45)" : "rgba(248, 250, 252, 0.7)";
  const plotBgBot = isDarkMode ? "rgba(15, 23, 42, 0.25)" : "rgba(241, 245, 249, 0.3)";
  const gridColor = isDarkMode ? "#334155" : "#E2E8F0";
  const labelColor = isDarkMode ? "#cbd5e1" : "#475569";
  const subLabelColor = isDarkMode ? "#94a3b8" : "#64748b";
  const axisColor = isDarkMode ? "#64748b" : "#94A3B8";
  const barColor = isDarkMode ? "url(#barGradDark)" : "url(#barGradLight)";
  const barHoverColor = isDarkMode ? "#93C5FD" : "#1D4ED8";
  const barNegColor = isDarkMode ? "#F87171" : "#EF4444";

  const yAxisLabels = useMemo(() => {
    if (barScale.top === 0) return [];
    const steps = Math.round(barScale.top / barScale.step);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = i * barScale.step;
      const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
      return { val, y, label: formatCompactCurrency(val, lang) };
    });
  }, [barScale, yMin, yRange, lang]);

  const handleMove = (e) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (relX < PAD_L || relX > PLOT_RIGHT) { setHoverIdx(null); return; }
    const colW = (PLOT_RIGHT - PAD_L) / n;
    const idx = Math.floor((relX - PAD_L) / colW);
    setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
  };

  const hoverPoint = hoverIdx !== null ? parsedPoints[hoverIdx] : null;

  // Smooth path (Catmull-Rom-ish) cho line
  const getPaymentPath = (values) => {
    if (n === 0 || barScale.top === 0) return null;
    const scaleY = (v) => PLOT_BOTTOM - (v / barScale.top) * PLOT_H;
    const xStep = (PLOT_RIGHT - PAD_L) / Math.max(n - 1, 1);
    const pts = values.map((v, i) => ({ x: PAD_L + i * xStep, y: scaleY(v || 0) }));
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const getPaymentColor = (method, idx) => PAYMENT_COLORS[method] || PAYMENT_FALLBACK[idx % PAYMENT_FALLBACK.length];

  // Map method -> friendly label (Tiền mặt, Chuyển khoản, Miễn phí)
  const FRIENDLY = { Cash: "Tiền mặt", PayOS: "Chuyển khoản", Free: "Miễn phí" };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-75">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-75 gap-2 text-slate-400">
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  const first = parsedPoints[0];
  const last = parsedPoints[parsedPoints.length - 1];
  const totalRevenue = values.reduce((s, v) => s + v, 0);
  const colW = (PLOT_RIGHT - PAD_L) / n;

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
        <defs>
          <linearGradient id="plotBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={plotBgTop} />
            <stop offset="100%" stopColor={plotBgBot} />
          </linearGradient>
        <linearGradient id="barGradLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="barGradDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
          <filter id="tipShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Plot background */}
        <rect x={PAD_L} y={PAD_T} width={PLOT_RIGHT - PAD_L} height={PLOT_H} fill="url(#plotBg)" rx={6} />

        {/* Y-axis gridlines */}
        {yAxisLabels.map((lbl, i) => (
          <line key={`y-grid-${i}`} x1={PAD_L} x2={PLOT_RIGHT} y1={lbl.y} y2={lbl.y} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        ))}

        {/* X-axis baseline */}
        <line x1={PAD_L} x2={PLOT_RIGHT} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke={axisColor} strokeWidth={1.5} />

        {/* Y-axis labels */}
        {yAxisLabels.map((lbl, i) => (
          <text key={`y-label-${i}`} x={PAD_L - 10} y={lbl.y + 4} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="end">
            {lbl.label}
          </text>
        ))}

        {/* X-axis: gọn - đầu / "From–To" / cuối */}
        {(() => {
          const fromLabel = `${formatXLabel(first)}${yearsInfo.hasMultiple ? `, ${first._year}` : ""}`;
          const toLabel = `${formatXLabel(last)}${yearsInfo.hasMultiple ? `, ${last._year}` : ""}`;
          const rangeText = n > 1
            ? `${lang === "VN" ? "Từ" : "From"} ${formatXLabel(first)}${yearsInfo.hasMultiple ? `, ${first._year}` : ""}  →  ${lang === "VN" ? "đến" : "to"} ${formatXLabel(last)}${yearsInfo.hasMultiple ? `, ${last._year}` : ""}`
            : `${formatXLabel(first)}${yearsInfo.hasMultiple ? `, ${first._year}` : ""}`;
          const onlyYear = yearsInfo.years.length === 1 ? yearsInfo.years[0] : null;
          return (
            <g>
              <text x={PAD_L} y={PLOT_BOTTOM + 22} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="start">
                {fromLabel}
              </text>
              <text x={PAD_L + (PLOT_RIGHT - PAD_L) / 2} y={PLOT_BOTTOM + 22} fontSize={11} fontWeight={800} fill={subLabelColor} textAnchor="middle">
                {rangeText}
              </text>
              <text x={PLOT_RIGHT} y={PLOT_BOTTOM + 22} fontSize={11} fontWeight={700} fill={labelColor} textAnchor="end">
                {toLabel}
              </text>
              {onlyYear && (
                <text x={PAD_L + (PLOT_RIGHT - PAD_L) / 2} y={PLOT_BOTTOM + 40} fontSize={10} fontWeight={800} fill={subLabelColor} textAnchor="middle">
                  {onlyYear}
                </text>
              )}
            </g>
          );
        })()}

        {/* Baseline 0 */}
        {yMin < 0 && (
          <line x1={PAD_L} x2={PLOT_RIGHT} y1={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H} y2={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H} stroke={isDarkMode ? "#EF4444" : "#DC2626"} strokeWidth={1.5} />
        )}

        {/* Bars */}
        {parsedPoints.map((p, i) => {
          const val = p.netRevenue || 0;
          const x = PAD_L + i * colW + (colW - barW) / 2;
          const zeroY = PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H;
          const valY = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
          const top = Math.min(zeroY, valY);
          const h = Math.abs(zeroY - valY);
          const isHover = hoverIdx === i;
          const dimmed = hoverIdx !== null && !isHover;
          const fill = val < 0 ? barNegColor : barColor;
          return (
            <rect
              key={`bar-${i}`}
              x={x}
              y={top}
              width={barW}
              height={h}
              fill={fill}
              rx={4}
              opacity={dimmed ? 0.32 : 1}
              style={{ transition: "opacity 120ms ease" }}
            />
          );
        })}

        {/* Payment lines (smooth) + TB dashed */}
        {paymentLines.map((line, li) => {
          const color = getPaymentColor(line.method, li);
          const path = getPaymentPath(line.values || []);
          if (!path) return null;
          const vals = line.values || [];
          const sum = vals.reduce((s, v) => s + (v || 0), 0);
          const avg = vals.length > 0 ? sum / vals.length : 0;
          const avgLineY = avg > 0 ? PLOT_BOTTOM - (avg / barScale.top) * PLOT_H : null;
          return (
            <g key={`pm-line-${li}`}>
              {avgLineY !== null && (
                <line x1={PAD_L} x2={PLOT_RIGHT} y1={avgLineY} y2={avgLineY} stroke={color} strokeWidth={1.2} strokeDasharray="5 5" opacity={0.55} />
              )}
              <path d={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              {(line.values || []).map((v, i) => {
                if (barScale.top === 0) return null;
                const xStep = (PLOT_RIGHT - PAD_L) / Math.max(n - 1, 1);
                const x = PAD_L + i * xStep;
                const y = PLOT_BOTTOM - ((v || 0) / barScale.top) * PLOT_H;
                const isHover = hoverIdx === i;
                const dimmed = hoverIdx !== null && !isHover;
                return (
                  <circle
                    key={`dot-${li}-${i}`}
                    cx={x}
                    cy={y}
                    r={isHover ? 6 : 3.2}
                    fill={color}
                    stroke={isDarkMode ? "#0f172a" : "#ffffff"}
                    strokeWidth={1.8}
                    opacity={dimmed ? 0.35 : 1}
                    style={{ transition: "r 120ms ease, opacity 120ms ease" }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Hover vertical guide */}
        {hoverIdx !== null && (
          <line
            x1={PAD_L + hoverIdx * colW + colW / 2}
            x2={PAD_L + hoverIdx * colW + colW / 2}
            y1={PAD_T}
            y2={PLOT_BOTTOM}
            stroke={barHoverColor}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.5}
          />
        )}

        {/* Max value label */}
        {(() => {
          const maxIdx = parsedPoints.reduce((best, p, i) => ((p.netRevenue || 0) > (parsedPoints[best]?.netRevenue || 0) ? i : best), 0);
          const val = parsedPoints[maxIdx]?.netRevenue || 0;
          if (val <= 0) return null;
          const x = PAD_L + maxIdx * colW + colW / 2;
          const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H - 8;
          return (
            <g>
              <rect x={x - 32} y={y - 14} width={64} height={18} rx={9} fill={isDarkMode ? "#1e3a8a" : "#DBEAFE"} stroke={isDarkMode ? "#3B82F6" : "#3B82F6"} strokeWidth={1} />
              <text x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={900} fill={isDarkMode ? "#BFDBFE" : "#1D4ED8"}>
                {formatCompactCurrency(val, lang)}
              </text>
            </g>
          );
        })()}

        {/* Hover tooltip */}
        {hoverPoint && hoverIdx !== null && (() => {
          const x = PAD_L + hoverIdx * colW + colW / 2;
          const val = hoverPoint.netRevenue || 0;
          const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
          const tipW = 200;
          const tipH = 44 + (paymentLines.length > 0 ? paymentLines.length * 18 : 0);
          let tipX = x - tipW / 2;
          let tipY = y - tipH - 14;
          if (tipY < 4) tipY = y + 14;
          if (tipX < 4) tipX = 4;
          if (tipX + tipW > W - 4) tipX = W - tipW - 4;
          const tipBg = isDarkMode ? "#0f172a" : "#ffffff";
          const tipBorder = isDarkMode ? "#475569" : "#E2E8F0";
          return (
            <g pointerEvents="none" filter="url(#tipShadow)">
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={10} fill={tipBg} stroke={tipBorder} strokeWidth={1} />
              <text x={tipX + 12} y={tipY + 18} fontSize={11} fontWeight={700} fill={subLabelColor}>
                {formatXLabel(hoverPoint)}{hoverPoint._year ? `, ${hoverPoint._year}` : ""}
              </text>
              <text x={tipX + 12} y={tipY + 38} fontSize={14} fontWeight={900} fill={barHoverColor}>
                {formatCompactCurrency(val, lang)}
              </text>
              {paymentLines.slice(0, 3).map((l, li) => {
                const color = getPaymentColor(l.method, li);
                const pv = l.values?.[hoverIdx] || 0;
                const rowY = tipY + 58 + li * 18;
                const friendlyLabel = FRIENDLY[l.method] || l.label || getPaymentMethodLabel(l.method, lang);
                return (
                  <g key={`tip-pm-${li}`}>
                    <circle cx={tipX + 16} cy={rowY - 4} r={4} fill={color} />
                    <text x={tipX + 26} y={rowY} fontSize={10.5} fontWeight={700} fill={labelColor}>{friendlyLabel}</text>
                    <text x={tipX + tipW - 12} y={rowY} fontSize={10.5} fontWeight={800} fill={color} textAnchor="end">{formatCompactCurrency(pv, lang)}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>

      {/* Legend - pill style */}
      {paymentLines.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mt-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            {paymentLines.slice(0, 3).map((l, li) => {
              const color = getPaymentColor(l.method, li);
              const friendlyLabel = FRIENDLY[l.method] || l.label || getPaymentMethodLabel(l.method, lang);
              return (
                <div
                  key={`legend-${li}`}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-bold"
                  style={{
                    borderColor: isDarkMode ? `${color}55` : `${color}55`,
                    background: isDarkMode ? `${color}1A` : `${color}14`,
                    color: isDarkMode ? "#e2e8f0" : "#334155",
                  }}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span>{friendlyLabel}</span>
                  <span style={{ color }}>·</span>
                  <span className="tabular-nums">
                    {formatCompactCurrency((l.values || []).reduce((s, v) => s + (v || 0), 0), lang)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-[14px]">payments</span>
            <span>{lang === "VN" ? "Tổng" : "Total"}</span>
            <span className="font-black text-[#124757] dark:text-yellow-400 tabular-nums">
              {formatCompactCurrency(totalRevenue, lang)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
