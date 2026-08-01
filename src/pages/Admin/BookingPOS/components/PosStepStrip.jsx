const STEP_ITEMS = [
  { step: 1, labelVn: "Tìm chuyến", labelEn: "Search" },
  { step: 2, labelVn: "Chuyến & ghế", labelEn: "Trip & seats" },
  { step: 3, labelVn: "Thanh toán", labelEn: "Payment" },
];

export function PosStepStrip({ lang, currentStep }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEP_ITEMS.map((item, index) => {
        const isDone = currentStep > item.step;
        const isActive = currentStep === item.step;
        return (
          <div key={item.step} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-headline font-black transition-colors ${
                isActive
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {isDone ? <span className="material-symbols-outlined text-sm">check</span> : item.step}
            </div>
            <span
              className={`whitespace-nowrap text-[11px] font-headline font-black uppercase tracking-wide ${
                isActive ? "text-[#124757] dark:text-yellow-400" : "text-slate-400"
              }`}
            >
              {lang === "VN" ? item.labelVn : item.labelEn}
            </span>
            {index < STEP_ITEMS.length - 1 ? (
              <span className="material-symbols-outlined text-sm text-slate-300 dark:text-slate-600">chevron_right</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
