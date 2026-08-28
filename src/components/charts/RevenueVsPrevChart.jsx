import { useMemo, useState } from "react";
import { formatCompactCurrency } from "../../utils/revenueReport";

const VB_W = 980;
const VB_H = 360;
const PAD_L = 52;
const PAD_R = 28;
const PAD_T = 24;
const PAD_B = 44;
const PLOT_RIGHT = VB_W - PAD_R;
const PLOT_BOTTOM = VB_H - PAD_B;
const PLOT_H = PLOT_BOTTOM - PAD_T;

export function RevenueVsPrevChart({ current = [], lang, isDarkMode, isLoading }) {
  const [hover, setHover] = useState(null);

  const niceScale = useMemo(() => {
    const max = Math.max(0, ...current.map((p) => Number(p.netRevenue || 0)));
    if (max === 0) return { top: 0, step: 1 };
    const targetSteps = 5;
    const rawStep = max / targetSteps;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / pow;
    const niceNorms = [1, 2, 5];
    let best = niceNorms[0];
    let minDiff = Infinity;
    for (const nn of niceNorms) {
      const diff = Math.abs(nn - norm);
      if (diff < minDiff) { minDiff = diff; best = nn; }
    }
    const step = best * pow;
    const top = Math.ceil(max / step) * step;
    return { top, step };
  }, [current]);

  const yMax = niceScale.top;
  const yMin = 0;
  const yRange = yMax - yMin || 1;
  const n = current.length;
  const xStep = n > 1 ? (PLOT_RIGHT - PAD_L) / (n - 1) : 0;

  const coords = useMemo(
    () =>
      current.map((p, i) => ({
        x: n > 1 ? PAD_L + i * xStep : (PAD_L + PLOT_RIGHT) / 2,
        y: PLOT_BOTTOM - ((Number(p.netRevenue || 0) - yMin) / yRange) * PLOT_H,
        ...p,
      })),
    [current, n, xStep, yRange]
  );

  const areaPath = coords.length > 0
    ? `${coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")} L${coords[coords.length - 1].x.toFixed(1)},${PLOT_BOTTOM} L${coords[0].x.toFixed(1)},${PLOT_BOTTOM} Z`
    : "";

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const yAxisLabels = useMemo(() => {
    if (niceScale.top === 0) return [];
    const steps = Math.round(niceScale.top / niceScale.step);
    return Array.from({ length: steps + 1 }, (_, i) => ({
      val: i * niceScale.step,
      y: PLOT_BOTTOM - ((i * niceScale.step - yMin) / yRange) * PLOT_H,
      label: formatCompactCurrency(i * niceScale.step, lang),
    }));
  }, [niceScale, yMin, yRange, lang]);

  const totalNet = useMemo(
    () => current.reduce((s, p) => s + Number(p.netRevenue || 0), 0),
    [current]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[160px]">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[160px] gap-2 text-slate-400">
        <span className="material-symbols-outlined text-3xl">show_chart</span>
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  const strokeColor = isDarkMode ? "#60a5fa" : "#124757";
  const gradTop = isDarkMode ? "rgba(96,165,250,0.6)" : "rgba(18,71,87,0.35)";
  const gradBot = isDarkMode ? "rgba(96,165,250,0.05)" : "rgba(18,71,87,0.02)";
  const gridColor = isDarkMode ? "#334155" : "#E2E8F0";
  const labelColor = isDarkMode ? "#cbd5e1" : "#475569";

  const hovered = hover !== null ? coords[hover] : null;

  return (
      <div className="relative w-full h-full flex flex-col">
        <div className="flex-1 min-h-0">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block">
          <defs>
            <linearGradient id="vsPrevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradTop} />
              <stop offset="100%" stopColor={gradBot} />
            </linearGradient>
          </defs>

          {/* Y grid + labels */}
          {yAxisLabels.map((lbl, i) => (
            <g key={`y-${i}`}>
              <line x1={PAD_L} x2={PLOT_RIGHT} y1={lbl.y} y2={lbl.y} stroke={gridColor} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.6} />
              <text x={PAD_L - 10} y={lbl.y + 5} fontSize={14} fontWeight={700} fill={labelColor} textAnchor="end">
                {lbl.label}
              </text>
            </g>
          ))}

          {/* X labels (5 evenly spaced) */}
          {(() => {
            const labelCount = Math.min(n, 5);
            const step = Math.max(1, Math.floor((n - 1) / (labelCount - 1)));
            const idxs = [];
            for (let i = 0; i < n && idxs.length < labelCount; i += step) idxs.push(i);
            if (idxs[idxs.length - 1] !== n - 1) idxs[idxs.length - 1] = n - 1;
            return idxs.map((idx, k) => {
              const isFirst = k === 0;
              const isLast = k === idxs.length - 1;
              const anchor = isFirst ? "start" : isLast ? "end" : "middle";
              const dx = isFirst ? 4 : isLast ? -4 : 0;
              return (
                <text
                  key={`xl-${idx}`}
                  x={coords[idx].x + dx}
                  y={PLOT_BOTTOM + 26}
                  fontSize={13}
                  fontWeight={700}
                  fill={labelColor}
                  textAnchor={anchor}
                >
                  {coords[idx].date}
                </text>
              );
            });
          })()}

          {/* Area */}
          <path d={areaPath} fill="url(#vsPrevGrad)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover zones */}
          {coords.map((c, i) => (
            <rect
              key={`hv-${i}`}
              x={c.x - (xStep / 2 || 12)}
              y={PAD_T}
              width={xStep || 20}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {/* Tooltip */}
          {hovered && (() => {
            const curV = Number(hovered.netRevenue || 0);
            const tipW = 112;
            const tipH = 42;
            let tipX = hovered.x - tipW / 2;
            let tipY = hovered.y - tipH - 10;
            if (tipY < PAD_T) tipY = hovered.y + 10;
            if (tipX < 4) tipX = 4;
            if (tipX + tipW > PLOT_RIGHT) tipX = PLOT_RIGHT - tipW;
            return (
              <g pointerEvents="none">
                <line x1={hovered.x} x2={hovered.x} y1={PAD_T} y2={PLOT_BOTTOM} stroke={strokeColor} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.5} />
                <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} fill={isDarkMode ? "#0f172a" : "#124757"} opacity={0.97} />
                <text x={tipX + 10} y={tipY + 15} fontSize={9} fontWeight={700} fill={isDarkMode ? "#94a3b8" : "#d7e7ec"}>
                  {hovered.date}
                </text>
                <text x={tipX + 10} y={tipY + 31} fontSize={13} fontWeight={900} fill="#ffffff">
                  {formatCompactCurrency(curV, lang)}
                </text>
              </g>
            );
          })()}
        </svg>
        </div>

      <div className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-300">
        {lang === "VN" ? "Tổng cộng" : "Total"}:{" "}
        <span className="text-[#124757] dark:text-yellow-400">{formatCompactCurrency(totalNet, lang)}</span>
      </div>
    </div>
  );
}
