import { useEffect, useMemo, useRef, useState } from "react";
import { formatCompactCurrency } from "../../utils/revenueReport";

const DEFAULT_VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 360;
const PAD_L = 46;
const PAD_R = 14;
const PAD_T = 24;
const PAD_B = 44;

const formatExactCurrency = (value) =>
  `${(Number(value) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} VND`;

// Làm mềm các đoạn nối nhưng vẫn đi qua đúng mọi mốc doanh thu.
const createSmoothPath = (coords) => {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;

  const tension = 0.16;
  let path = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const previous = coords[i - 1] || coords[i];
    const current = coords[i];
    const next = coords[i + 1];
    const afterNext = coords[i + 2] || next;
    const control1X = current.x + (next.x - previous.x) * tension;
    const control1Y = current.y + (next.y - previous.y) * tension;
    const control2X = next.x - (afterNext.x - current.x) * tension;
    const control2Y = next.y - (afterNext.y - current.y) * tension;
    path += ` C${control1X.toFixed(1)},${control1Y.toFixed(1)} ${control2X.toFixed(1)},${control2Y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }

  return path;
};

export function RevenueVsPrevChart({ current = [], lang, isDarkMode, isLoading }) {
  const [hover, setHover] = useState(null);
  const [viewBoxWidth, setViewBoxWidth] = useState(DEFAULT_VIEWBOX_WIDTH);
  const chartFrameRef = useRef(null);
  const canMeasureChart = !isLoading && current.length > 0;
  const plotRight = viewBoxWidth - PAD_R;
  const plotBottom = VIEWBOX_HEIGHT - PAD_B;
  const plotHeight = plotBottom - PAD_T;

  useEffect(() => {
    if (!canMeasureChart) return undefined;
    const element = chartFrameRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const nextWidth = Math.max(640, Math.round(VIEWBOX_HEIGHT * (width / height)));
      setViewBoxWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [canMeasureChart]);

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
  const xStep = n > 1 ? (plotRight - PAD_L) / (n - 1) : 0;

  const coords = useMemo(
    () =>
      current.map((p, i) => ({
        x: n > 1 ? PAD_L + i * xStep : (PAD_L + plotRight) / 2,
        y: plotBottom - ((Number(p.netRevenue || 0) - yMin) / yRange) * plotHeight,
        ...p,
      })),
    [current, n, plotBottom, plotHeight, plotRight, xStep, yRange]
  );

  const linePath = createSmoothPath(coords);
  const areaPath = coords.length > 0
    ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${plotBottom} L${coords[0].x.toFixed(1)},${plotBottom} Z`
    : "";

  const yAxisLabels = useMemo(() => {
    if (niceScale.top === 0) return [];
    const steps = Math.round(niceScale.top / niceScale.step);
    return Array.from({ length: steps + 1 }, (_, i) => ({
      val: i * niceScale.step,
      y: plotBottom - ((i * niceScale.step - yMin) / yRange) * plotHeight,
      label: formatCompactCurrency(i * niceScale.step, lang),
    }));
  }, [lang, niceScale, plotBottom, plotHeight, yMin, yRange]);

  const totalNet = useMemo(
    () => current.reduce((s, p) => s + Number(p.netRevenue || 0), 0),
    [current]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-40">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-40 gap-2 text-slate-400">
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
        <div className="mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-300">
          {lang === "VN" ? "Tổng cộng" : "Total"}:{" "}
          <span className="text-xl font-black text-[#124757] dark:text-yellow-400">{formatExactCurrency(totalNet)}</span>
        </div>
        <div ref={chartFrameRef} className="flex-1 min-h-0">
        <svg viewBox={`0 0 ${viewBoxWidth} ${VIEWBOX_HEIGHT}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block">
          <defs>
            <linearGradient id="vsPrevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradTop} />
              <stop offset="100%" stopColor={gradBot} />
            </linearGradient>
          </defs>

          {/* Y grid + labels */}
          {yAxisLabels.map((lbl, i) => (
            <g key={`y-${i}`}>
              <line x1={PAD_L} x2={plotRight} y1={lbl.y} y2={lbl.y} stroke={gridColor} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.6} />
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
                  y={plotBottom + 26}
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
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {/* Tooltip */}
          {hovered && (() => {
            const curV = Number(hovered.netRevenue || 0);
            const tooltipValue = formatExactCurrency(curV);
            const tipW = Math.max(112, tooltipValue.length * 7.5 + 20);
            const tipH = 42;
            let tipX = hovered.x - tipW / 2;
            let tipY = hovered.y - tipH - 10;
            if (tipY < PAD_T) tipY = hovered.y + 10;
            if (tipX < 4) tipX = 4;
            if (tipX + tipW > plotRight) tipX = plotRight - tipW;
            return (
              <g pointerEvents="none">
                <line x1={hovered.x} x2={hovered.x} y1={PAD_T} y2={plotBottom} stroke={strokeColor} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.5} />
                <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} fill={isDarkMode ? "#0f172a" : "#124757"} opacity={0.97} />
                <text x={tipX + 10} y={tipY + 15} fontSize={9} fontWeight={700} fill={isDarkMode ? "#94a3b8" : "#d7e7ec"}>
                  {hovered.date}
                </text>
                <text x={tipX + 10} y={tipY + 31} fontSize={13} fontWeight={900} fill="#ffffff">
                  {tooltipValue}
                </text>
              </g>
            );
          })()}
        </svg>
        </div>
    </div>
  );
}
