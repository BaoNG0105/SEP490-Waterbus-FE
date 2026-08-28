import { useMemo, useState } from "react";
import { formatCompactCurrency } from "../../utils/revenueReport";

const W = 900;
const H = 380;
const PAD_L = 44;
const PAD_R = 56;
const PAD_T = 24;
const PAD_B = 44;
const PLOT_RIGHT = W - PAD_R;
const PLOT_BOTTOM = H - PAD_B;
const PLOT_H = PLOT_BOTTOM - PAD_T;

const referenceColor = "#94A3B8"; // slate-400

/**
 * Area chart mềm với gradient fill + reference line.
 * Đọc được không cần hover (label điểm đầu + điểm cuối + giá trị cao nhất).
 * points: [{ date: "dd/MM/yyyy", netRevenue, grossRevenue, refundAmount }]
 */
export function RevenueAreaChart({ points = [], lang, isDarkMode, isLoading }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const values = points.map((p) => p.netRevenue || 0);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);

  // Nice scale: chọn step và top sao cho max nằm ở mốc trên cùng
  const niceScale = useMemo(() => {
    if (maxValue === 0) return { top: 0, step: 1, bottom: 0 };
    // Tìm step "đẹp" để có ~4-5 mốc
    const targetSteps = 5;
    const rawStep = maxValue / targetSteps;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / pow;
    // norm: 1→1, 2→2, 5→5, 10→1 (với pow*10)
    const niceNorms = [1, 2, 5];
    let bestNorm = niceNorms[0];
    let minDiff = Infinity;
    for (const nn of niceNorms) {
      const diff = Math.abs(nn - norm);
      if (diff < minDiff) { minDiff = diff; bestNorm = nn; }
    }
    const step = bestNorm * pow;
    // top = bội của step, >= maxValue
    const top = Math.ceil(maxValue / step) * step;
    // Đảm bảo có ít nhất 2 mốc
    const minSteps = Math.max(2, Math.ceil(maxValue / step));
    const actualTop = Math.max(top, minSteps * step);
    return { top: actualTop, step, bottom: 0 };
  }, [maxValue]);

  const yMax = niceScale.top;
  const yMin = minValue >= 0 ? 0 : minValue;
  const n = points.length;
  const xStep = n > 1 ? (PLOT_RIGHT - PAD_L) / (n - 1) : 0;

  const yRange = yMax - yMin || 1;
  const coords = useMemo(
    () =>
      points.map((p, i) => ({
        x: n > 1 ? PAD_L + i * xStep : (PAD_L + PLOT_RIGHT) / 2,
        y: PLOT_BOTTOM - (((p.netRevenue || 0) - yMin) / yRange) * PLOT_H,
        ...p,
      })),
    [points, n, xStep, yRange, yMin]
  );

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L${coords[n - 1].x.toFixed(1)},${PLOT_BOTTOM} L${coords[0].x.toFixed(1)},${PLOT_BOTTOM} Z`
      : "";

  // Gradient defs
  const gradId = "rev-area-grad";
  const strokeColor = isDarkMode ? "#60a5fa" : "#3B82F6"; // blue-400/500
  const gradTop = isDarkMode ? "#60a5fa" : "#93C5FD";
  const gradBot = isDarkMode ? "#1e3a5f" : "#DBEAFE";

  // Reference line at average (dashed)
  const refY = maxValue > 0 ? PLOT_BOTTOM - ((maxValue / Math.max(n, 1) - yMin) / yRange) * PLOT_H : 0;
  const refLabel =
    maxValue > 0
      ? `${lang === "VN" ? "TB" : "Avg"} ${formatCompactCurrency(maxValue / Math.max(n, 1), lang)}`
      : null;

  // Y-axis labels (left side) — chia theo niceScale
  const yAxisLabels = useMemo(() => {
    if (niceScale.top === 0) return [];
    const steps = Math.round(niceScale.top / niceScale.step);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = i * niceScale.step;
      const y = PLOT_BOTTOM - ((val - yMin) / yRange) * PLOT_H;
      return { val, y, label: formatCompactCurrency(val, lang) };
    });
  }, [niceScale, yMin, yRange, lang]);

  const maxCoord = useMemo(() => coords.reduce((best, c) => (c.y < best.y ? c : best), coords[0]), [coords]);

  const handleMove = (e) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (n === 1) { setHoverIdx(0); return; }
    const idx = Math.round((relX - PAD_L) / xStep);
    setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
  };

  const hovered = hoverIdx !== null ? coords[hoverIdx] : null;
  const tickColor = isDarkMode ? "#64748B" : "#475569";
  const labelColor = isDarkMode ? "#CBD5E1" : "#334155";
  const gridColor = isDarkMode ? "#334155" : "#E2E8F0";

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
        <span className="material-symbols-outlined text-4xl">area_chart</span>
        <p className="text-sm font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  return (
    <div className="select-none h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="overflow-hidden cursor-crosshair"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradTop} stopOpacity={0.7} />
            <stop offset="100%" stopColor={gradBot} stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {/* Y-axis labels */}
        {yAxisLabels.map((lbl, i) => (
          <text
            key={`y-label-${i}`}
            x={PAD_L - 8}
            y={lbl.y + 5}
            fontSize={13}
            fontWeight={700}
            fill={labelColor}
            textAnchor="end"
          >
            {lbl.label}
          </text>
        ))}

        {/* Y-axis gridlines */}
        {yAxisLabels.map((lbl, i) => (
          <line
            key={`y-grid-${i}`}
            x1={PAD_L}
            x2={PLOT_RIGHT}
            y1={lbl.y}
            y2={lbl.y}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}

        {/* Baseline at y = 0 */}
        {yMin < 0 && (
          <line
            x1={PAD_L}
            x2={PLOT_RIGHT}
            y1={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H}
            y2={PLOT_BOTTOM - ((0 - yMin) / yRange) * PLOT_H}
            stroke={isDarkMode ? "#EF4444" : "#DC2626"}
            strokeWidth={2}
          />
        )}

        {/* Reference line */}
        {refLabel && (
          <line
            x1={PAD_L}
            x2={PLOT_RIGHT}
            y1={refY}
            y2={refY}
            stroke={referenceColor}
            strokeWidth={1.2}
            strokeDasharray="5 5"
          />
        )}
        {refLabel && (
          <text x={PLOT_RIGHT - 4} y={refY - 6} fontSize={12} fontWeight={700} fill={referenceColor} textAnchor="end">
            {refLabel}
          </text>
        )}

        {/* Area fill */}
        {n > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Line */}
        {n > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dot at peak */}
        {maxCoord && (() => {
          const nearRight = maxCoord.x > PLOT_RIGHT - 40;
          return (
            <>
              <circle cx={maxCoord.x} cy={maxCoord.y} r={7} fill={strokeColor} stroke="#fff" strokeWidth={2.5} />
              <text
                x={nearRight ? maxCoord.x - 10 : maxCoord.x + 10}
                y={maxCoord.y - 8}
                fontSize={14}
                fontWeight={800}
                fill={isDarkMode ? "#e2e8f0" : "#1e293b"}
                textAnchor={nearRight ? "end" : "start"}
              >
                {formatCompactCurrency(maxCoord.netRevenue, lang)}
              </text>
            </>
          );
        })()}

        {/* End dot */}
        {n > 0 && (
          <circle
            cx={coords[n - 1].x}
            cy={coords[n - 1].y}
            r={hovered ? 7 : 5}
            fill={strokeColor}
            stroke="#fff"
            strokeWidth={2.5}
          />
        )}

        {/* Hover crosshair */}
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_T}
            y2={PLOT_BOTTOM}
            stroke={isDarkMode ? "#64748B" : "#94A3B8"}
            strokeWidth={1.2}
            strokeDasharray="3 3"
          />
        )}
        {hovered && (
          <circle cx={hovered.x} cy={hovered.y} r={6} fill={strokeColor} stroke="#fff" strokeWidth={2.5} />
        )}

        {/* X labels — evenly spaced */}
        {n > 0 && (() => {
          const labelCount = Math.min(n, 5);
          const step = Math.max(1, Math.floor((n - 1) / (labelCount - 1)));
          const indices = [];
          for (let i = 0; i < n && indices.length < labelCount; i += step) {
            indices.push(i);
          }
          if (indices[indices.length - 1] !== n - 1) indices[indices.length - 1] = n - 1;
          return indices.map((idx) => (
            <text
              key={`x-label-${idx}`}
              x={coords[idx].x}
              y={H - 12}
              fontSize={12}
              fontWeight={700}
              fill={labelColor}
              textAnchor="middle"
            >
              {coords[idx].date}
            </text>
          ));
        })()}

        {/* Hover tooltip */}
        {hovered && (() => {
          const tipW = 120;
          const tipX = Math.min(W - tipW - 4, Math.max(4, hovered.x - tipW / 2));
          const tipY = Math.max(4, hovered.y - 50);
          return (
            <g>
              <rect
                x={tipX}
                y={tipY}
                width={tipW}
                height={38}
                rx={6}
                fill={isDarkMode ? "#0f172a" : "#fff"}
                stroke={strokeColor}
                strokeWidth={1.5}
              />
              <text x={tipX + tipW / 2} y={tipY + 16} fontSize={12} fontWeight={700} fill={labelColor} textAnchor="middle">
                {hovered.date}
              </text>
              <text x={tipX + tipW / 2} y={tipY + 32} fontSize={14} fontWeight={900} fill={strokeColor} textAnchor="middle">
                {formatCompactCurrency(hovered.netRevenue, lang)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}