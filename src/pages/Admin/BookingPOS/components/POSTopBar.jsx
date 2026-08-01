import { useEffect, useState } from "react";
const SERVICES = [
  { id: "waterbus", labelVn: "Waterbus", labelEn: "Waterbus"},
  { id: "sightseeing", labelVn: "Tham quan", labelEn: "Sightseeing" },
];

export function POSTopBar({ lang, service, onSwitchService }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(lang === "VN" ? "vi-VN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
        {SERVICES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSwitchService(item.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wide transition ${
              service === item.id
                ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {lang === "VN" ? item.labelVn : item.labelEn}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400">{dateLabel}</p>
          <p className="font-headline text-sm font-black tabular-nums text-[#124757] dark:text-yellow-400">
            {timeLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
