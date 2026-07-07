import { WORKFLOW_STEPS, getWorkflowStepIndex, isTerminalBookingStatus } from "../utils/charterBookingActions";

export function CharterWorkflowStepper({ status, lang = "VN", compact = false }) {
  const terminal = isTerminalBookingStatus(status);
  const currentIndex = getWorkflowStepIndex(status);

  if (terminal) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900/60 ${compact ? "py-2" : "py-3"}`}>
        <span className="material-symbols-outlined text-base text-slate-400">block</span>
        <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Yêu cầu đã đóng" : "Request closed"}
        </span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-5 gap-1 ${compact ? "" : "gap-2"}`}>
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const upcoming = index > currentIndex;

        return (
          <div key={step.id} className="min-w-0 text-center">
            <div className="relative flex items-center justify-center">
              {index > 0 && (
                <span
                  className={`absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 translate-x-[-50%] ${
                    done || active ? "bg-[#FFD100]" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  style={{ width: "calc(100% + 0.25rem)", left: "-50%" }}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                  active
                    ? "border-[#124757] bg-[#124757] text-white shadow-md shadow-[#124757]/20 dark:border-yellow-400 dark:bg-yellow-400 dark:text-slate-900"
                    : done
                      ? "border-[#FFD100] bg-[#FFD100] text-[#124757]"
                      : "border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {done ? "check" : step.icon}
                </span>
              </span>
            </div>
            {!compact && (
              <p
                className={`mt-1.5 truncate text-[9px] font-headline font-black uppercase tracking-wide ${
                  active
                    ? "text-[#124757] dark:text-yellow-400"
                    : upcoming
                      ? "text-slate-300 dark:text-slate-600"
                      : "text-slate-400"
                }`}
              >
                {lang === "VN" ? step.labelVn : step.labelEn}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
