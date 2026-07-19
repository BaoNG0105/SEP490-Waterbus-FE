import { useApp } from "../../../context/AppContext";

/**
 * Lịch sử quét vé — BE chưa có bảng/API (spec mục 6).
 * Giữ chỗ trong menu Staff; khi BE sẵn sàng sẽ nối API.
 */
export function StaffScanHistoryPage() {
  const { lang } = useApp();

  return (
    <div className="space-y-6 pb-10 font-body max-w-3xl mx-auto">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành" : "Operations"}
        </p>
        <h2 className="mt-1 text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Lịch sử quét vé" : "Scan history"}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
          {lang === "VN"
            ? "Ghi nhận các lần scan / check-in / check-out để đối soát."
            : "Log of scan / check-in / check-out for auditing."}
        </p>
      </div>

      <div className="rounded-4xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">history</span>
        <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
          {lang === "VN"
            ? "Chưa có dữ liệu — lịch sử quét chưa sẵn sàng."
            : "No data yet — scan history is not available."}
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          {lang === "VN"
            ? "Hiện chỉ dùng Quét vé để tra cứu / check-in / check-out từng mã."
            : "Use Ticket scan for live lookup / check-in / check-out for now."}
        </p>
      </div>
    </div>
  );
}
