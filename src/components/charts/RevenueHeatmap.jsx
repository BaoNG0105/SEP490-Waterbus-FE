import { useMemo } from "react";
import { formatCompactCurrency } from "../../utils/revenueReport";

// Lưới 7 cột (T2..CN) x N hàng (~4 tuần gần nhất).
// Mỗi ô: ngày + doanh thu, intensity theo % max.
// points: [{ date: "dd/MM/yyyy", netRevenue }]

const DOW_LABELS_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DOW_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  // dd/MM/yyyy
  if (str.includes("/")) {
    const [d, m, y] = str.split("/");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  // yyyy-MM-dd (ISO)
  const iso = str.split("-");
  if (iso.length === 3) {
    const [y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return null;
};

const startOfWeekMon = (date) => {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = CN
  const diff = (dow + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const colorForIntensity = (intensity, isDarkMode) => {
  // intensity 0..1
  if (intensity <= 0) return isDarkMode ? "rgba(51,65,85,0.35)" : "rgba(241,245,249,0.85)";
  const base = isDarkMode
    ? { r: 250, g: 204, b: 21 } // yellow-400
    : { r: 18, g: 71, b: 87 }; // #124757
  // Mix toward background by intensity: 0 = faint, 1 = full color
  const alpha = 0.25 + intensity * 0.75;
  return `rgba(${base.r},${base.g},${base.b},${alpha})`;
};

export function RevenueHeatmap({ points = [], lang, isDarkMode, isLoading, weeks = 6 }) {
  const data = useMemo(() => {
    if (!Array.isArray(points) || points.length === 0) return { grid: [], max: 0, totalDays: 0 };
    const parsed = points
      .map((p) => ({ date: parseDate(p.date), raw: p, revenue: Number(p.netRevenue || 0) }))
      .filter((x) => x.date && !Number.isNaN(x.date.getTime()))
      .sort((a, b) => a.date - b.date);
    if (parsed.length === 0) return { grid: [], max: 0, totalDays: 0 };

    const lastDate = parsed[parsed.length - 1].date;
    const lastMonday = startOfWeekMon(lastDate);
    const firstMonday = new Date(lastMonday);
    firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);

    const lookup = new Map();
    parsed.forEach((p) => {
      const key = `${p.date.getFullYear()}-${p.date.getMonth()}-${p.date.getDate()}`;
      lookup.set(key, p);
    });

    const grid = [];
    for (let w = 0; w < weeks; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(firstMonday);
        cellDate.setDate(cellDate.getDate() + w * 7 + d);
        const key = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
        const hit = lookup.get(key);
        row.push({ date: cellDate, raw: hit || null, revenue: hit ? hit.revenue : 0 });
      }
      grid.push(row);
    }

    const max = parsed.reduce((m, p) => Math.max(m, p.revenue), 0);
    return { grid, max, totalDays: parsed.length };
  }, [points, weeks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[180px]">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (data.grid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[180px] gap-2 text-slate-400">
        <span className="material-symbols-outlined text-3xl">calendar_view_month</span>
        <p className="text-xs font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
      </div>
    );
  }

  const dowLabels = lang === "VN" ? DOW_LABELS_VN : DOW_LABELS_EN;
  const monthFmt = new Intl.DateTimeFormat(lang === "VN" ? "vi-VN" : "en-US", { month: "short" });

  return (
    <div className="w-full">
      <div className="flex gap-1.5 items-stretch">
        {data.grid.map((row, wi) => (
          <div key={`col-${wi}`} className="flex-1 flex flex-col gap-1">
            {/* Month label trên cột đầu tiên của tháng */}
            <div className="h-3 text-[9px] font-bold text-slate-400 text-center uppercase">
              {wi === 0 || row[0].date.getMonth() !== data.grid[wi - 1][0].date.getMonth()
                ? monthFmt.format(row[0].date)
                : ""}
            </div>
            {row.map((cell, di) => {
              const intensity = data.max > 0 ? cell.revenue / data.max : 0;
              const bg = colorForIntensity(intensity, isDarkMode);
              const inRange = cell.raw !== null;
              return (
                <div
                  key={`cell-${wi}-${di}`}
                  className="aspect-square rounded-md border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-center text-[9px] font-black relative group cursor-default"
                  style={{ backgroundColor: bg, color: intensity > 0.55 ? (isDarkMode ? "#0f172a" : "#fff") : (isDarkMode ? "#cbd5e1" : "#475569") }}
                  title={inRange ? `${cell.date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US")} · ${formatCompactCurrency(cell.revenue, lang)}` : ""}
                >
                  {cell.date.getDate()}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {dowLabels.map((lbl, i) => (
          <div key={lbl} className={`text-center text-[9px] font-bold uppercase ${i >= 5 ? "text-rose-500" : "text-slate-400"}`}>
            {lbl}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-bold text-slate-400">
        <span>{lang === "VN" ? "Thấp" : "Low"}</span>
        {[0.15, 0.4, 0.7, 1].map((v) => (
          <span key={v} className="w-4 h-3 rounded-sm" style={{ backgroundColor: colorForIntensity(v, isDarkMode) }} />
        ))}
        <span>{lang === "VN" ? "Cao" : "High"}</span>
      </div>
    </div>
  );
}
