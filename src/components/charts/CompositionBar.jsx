import { pickColor } from "../../utils/chartPalette";

/**
 * Biểu đồ cột ngang dạng "part-to-whole" (stacked bar 1 hàng) — dùng thay donut/pie
 * theo khuyến nghị dataviz (donut bị deprioritize). Legend bên dưới liệt kê đủ giá trị/%,
 * nên dữ liệu luôn đọc được mà không cần hover (table-view tương đương).
 *
 * segments: [{ key, label, value, color: { light, dark } }]
 */
export function CompositionBar({ segments, isDarkMode, valueFormatter = (v) => v.toLocaleString("vi-VN"), emptyLabel = "--" }) {
  const visibleSegments = segments.filter((s) => s.value > 0);
  const total = visibleSegments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      {total > 0 ? (
        <div className="flex w-full h-6 gap-[2px]" role="img" aria-label={visibleSegments.map((s) => `${s.label}: ${valueFormatter(s.value)}`).join(", ")}>
          {visibleSegments.map((seg, idx) => (
            <div
              key={seg.key}
              style={{
                width: `${(seg.value / total) * 100}%`,
                backgroundColor: pickColor(seg.color, isDarkMode),
              }}
              title={`${seg.label}: ${valueFormatter(seg.value)}`}
              className={`h-full min-w-[3px] transition-all duration-500 ${idx === 0 ? "rounded-l-full" : ""} ${idx === visibleSegments.length - 1 ? "rounded-r-full" : ""}`}
            />
          ))}
        </div>
      ) : (
        <div className="w-full h-6 rounded-full bg-slate-100 dark:bg-slate-900" />
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3.5">
        {(total > 0 ? visibleSegments : segments).map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pickColor(seg.color, isDarkMode) }} />
            <span>{seg.label}</span>
            <span className="text-slate-800 dark:text-white">{total > 0 ? valueFormatter(seg.value) : emptyLabel}</span>
            {total > 0 && (
              <span className="text-slate-400 dark:text-slate-500 font-medium">
                ({Math.round((seg.value / total) * 100)}%)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
