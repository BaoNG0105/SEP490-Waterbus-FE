import { useMemo, useState, useCallback } from "react";

const W = 120;
const H = 40;

/**
 * Sparkline represents discrete daily data, so connect actual observations
 * directly instead of using a spline that can visually overshoot a value.
 */
function buildCurve(points) {
  if (points.length < 2) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

// Đường Q qua trung điểm: mềm hơn polyline nhưng không tạo overshoot như cubic spline.
function buildSoftCurve(points) {
  if (points.length < 2) return "";
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q${current.x.toFixed(2)},${current.y.toFixed(2)} ${midX.toFixed(2)},${midY.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  return `${path} Q${last.x.toFixed(2)},${last.y.toFixed(2)} ${last.x.toFixed(2)},${last.y.toFixed(2)}`;
}

function buildArea(points) {
  if (points.length < 2) return "";
  const curve = buildCurve(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${curve} L${last.x.toFixed(2)},${H} L${first.x.toFixed(2)},${H} Z`;
}

export function Sparkline({ points = [], color = "#124757", labels = [], variant = "line", interactive = true }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const hasData = points.length > 0 && points.some((p) => p > 0);
  const safePoints = hasData ? points : [0, 0];

  // Y scale: always include 0, add 5% headroom at top
  const max = Math.max(...safePoints, 1);
  const min = 0;
  const range = max - min || 1;
  const n = safePoints.length;
  const stepX = n > 1 ? W / (n - 1) : W;
  const barWidth = Math.max(1.5, Math.min(8, (W / Math.max(n, 1)) * 0.58));

  const coords = useMemo(() => {
    return safePoints.map((v, i) => ({
      x: i * stepX,
      y: H - ((v - min) / range) * (H - 2) - 1,
    }));
  }, [safePoints, min, range, stepX]);

  const linePath = useMemo(() => {
    if (coords.length < 2) return "";
    return variant === "soft" ? buildSoftCurve(coords) : buildCurve(coords);
  }, [coords, variant]);

  const areaPath = useMemo(() => {
    if (coords.length < 2) return "";
    if (variant === "soft") {
      const curve = buildSoftCurve(coords);
      const last = coords[coords.length - 1];
      const first = coords[0];
      return `${curve} L${last.x.toFixed(2)},${H} L${first.x.toFixed(2)},${H} Z`;
    }
    return buildArea(coords);
  }, [coords, variant]);

  // Gradient ID — unique per instance via index
  const gradId = `sg-${Math.random().toString(36).slice(2, 7)}`;

  const handleMouseMove = useCallback((e) => {
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(relX / stepX);
    setHoveredIdx(Math.min(Math.max(idx, 0), n - 1));
  }, [stepX, n]);

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  // Tooltip position
  const tipX = hoveredIdx !== null ? coords[hoveredIdx]?.x ?? 0 : 0;
  const tipY = hoveredIdx !== null ? coords[hoveredIdx]?.y ?? H : H;
  const tipVal = hoveredIdx !== null ? safePoints[hoveredIdx] : null;
  const tipLabel = hoveredIdx !== null ? (labels[hoveredIdx] || "") : "";

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        className="overflow-visible block"
        onMouseMove={interactive ? handleMouseMove : undefined}
        onMouseLeave={interactive ? handleMouseLeave : undefined}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Compact bars are clearer than a wave for KPI summaries. */}
        {hasData && variant === "bars" && coords.map((point, index) => (
          <rect
            key={`bar-${index}`}
            x={Math.max(0, Math.min(W - barWidth, point.x - barWidth / 2))}
            y={point.y}
            width={barWidth}
            height={Math.max(2, H - point.y)}
            rx={barWidth / 2}
            fill={color}
            opacity={index === coords.length - 1 ? 1 : 0.48}
          />
        ))}

        {/* Gradient fill area */}
        {hasData && (variant === "line" || variant === "soft") && areaPath && (
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        )}

        {/* Actual daily trend, with a marker at the latest observation. */}
        {hasData && (variant === "line" || variant === "soft") && linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {hasData && (variant === "line" || variant === "soft") && coords.length > 0 && (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r={2.4}
            fill={color}
            stroke="white"
            strokeWidth={1.3}
          />
        )}

        {/* Dashed line at 0 when no data */}
        {!hasData && (
          <line
            x1={0} x2={W} y1={H - 1} y2={H - 1}
            stroke={color} strokeWidth={1.5}
            strokeDasharray="4 4" opacity={0.4}
          />
        )}

        {/* Hover dot + crosshair */}
        {hoveredIdx !== null && (
          <>
            <line
              x1={tipX} x2={tipX} y1={0} y2={H}
              stroke={color} strokeWidth={1}
              strokeDasharray="3 3" opacity={0.4}
            />
            <circle cx={tipX} cy={tipY} r={3} fill={color} stroke="white" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && tipVal !== null && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-800 dark:bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap"
          style={{
            left: `${Math.min(Math.max((tipX / W) * 100, 10), 85)}%`,
            top: tipY < 15 ? 0 : undefined,
            bottom: tipY >= 15 ? 0 : undefined,
            transform: "translateY(-50%)",
          }}
        >
          {tipLabel && <div className="text-slate-300 text-[9px] font-normal">{tipLabel}</div>}
          {tipVal.toLocaleString("vi-VN")}
        </div>
      )}
    </div>
  );
}
