import { useMemo } from "react";

const W = 100;
const H = 36;

/**
 * Sparkline mini cho stat card — đường line mượt + area fill nhẹ.
 * points: number[] (chỉ lấy giá trị, index làm trục X).
 * color: mã màu (đã chọn light/dark sẵn).
 */
export function Sparkline({ points = [], color = "#124757", fillOpacity = 0.15 }) {
  const safePoints = points.length > 0 ? points : [0];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints, 0);
  const range = Math.max(max - min, 1);
  const n = safePoints.length;
  const stepX = n > 1 ? W / (n - 1) : W;

  const { linePath, areaPath } = useMemo(() => {
    if (n === 0) return { linePath: "", areaPath: "" };
    const coords = safePoints.map((v, i) => ({
      x: i * stepX,
      y: H - ((v - min) / range) * (H - 4) - 2,
    }));
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const area = `${line} L${coords[n - 1].x.toFixed(1)},${H} L0,${H} Z`;
    return { linePath: line, areaPath: area };
  }, [safePoints, min, range, n, stepX]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="overflow-visible">
      {n > 1 && <path d={areaPath} fill={color} fillOpacity={fillOpacity} stroke="none" />}
      {n > 1 && <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
      {n > 0 && (
        <circle
          cx={(n - 1) * stepX}
          cy={H - ((safePoints[n - 1] - min) / range) * (H - 4) - 2}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}
