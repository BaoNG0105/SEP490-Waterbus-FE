import { formatCurrency } from "../utils/bookingReport";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Math.round(Number(value || 0)));

export function WaterbusStationSummaryTable({ data, isLoading, lang }) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const rows = stations
    .map((station) => ({
      stationId: station.stationId ?? station.id,
      stationName: station.stationName ?? station.name ?? "—",
      stationCode: station.stationCode ?? station.code ?? "",
      departureCount: Number(station.departureCount || 0),
      arrivalCount: Number(station.arrivalCount || 0),
      departureTicketCount: Number(station.departureTicketCount || 0),
      arrivalTicketCount: Number(station.arrivalTicketCount || 0),
      totalGross: Number(station.totalGross || station.departureGross || 0),
      totalRefund: Number(station.totalRefund || station.departureRefund || 0),
      totalNet: Number(station.totalNet || 0),
    }))
    .sort((a, b) => b.totalNet - a.totalNet);
  const totalDeparture = rows.reduce((sum, row) => sum + row.departureCount, 0);
  const totalArrival = rows.reduce((sum, row) => sum + row.arrivalCount, 0);

  return (
    <section className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Waterbus theo bến" : "Waterbus by station"}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {lang === "VN" ? "Tổng hợp booking, vé và doanh thu theo từng bến." : "Bookings, tickets and revenue by station."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-xl">
            {lang === "VN" ? "Doanh thu" : "Revenue"}: {formatCurrency(data?.totalGross)}
          </span>
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-xl">
            {lang === "VN" ? "Hoàn tiền" : "Refund"}: {formatCurrency(data?.totalRefund)}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-230 text-[11px] font-bold">
          <thead>
            <tr className="text-left text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-900/50">
              <th className="px-4 py-3 w-10">#</th><th className="px-4 py-3">{lang === "VN" ? "Bến" : "Station"}</th>
              <th className="px-4 py-3 text-right">{lang === "VN" ? "Booking đi" : "Departures"}</th><th className="px-4 py-3 text-right">{lang === "VN" ? "Booking đến" : "Arrivals"}</th>
              <th className="px-4 py-3 text-right">{lang === "VN" ? "Vé đi" : "Dep. tickets"}</th><th className="px-4 py-3 text-right">{lang === "VN" ? "Vé đến" : "Arr. tickets"}</th>
              <th className="px-4 py-3 text-right">{lang === "VN" ? "Doanh thu" : "Revenue"}</th><th className="px-4 py-3 text-right">{lang === "VN" ? "Hoàn tiền" : "Refund"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{lang === "VN" ? "Đang tải..." : "Loading..."}</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{lang === "VN" ? "Chưa có dữ liệu." : "No data."}</td></tr>}
            {!isLoading && rows.map((row, index) => <tr key={row.stationId ?? index} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <td className="px-4 py-3 text-slate-400">{index + 1}</td><td className="px-4 py-3"><div><p className="text-slate-700 dark:text-white">{row.stationName}</p>{row.stationCode && <p className="text-[9px] text-slate-400 font-mono">{row.stationCode}</p>}</div></td>
              <td className="px-4 py-3 text-right">{formatNumber(row.departureCount)}</td><td className="px-4 py-3 text-right">{formatNumber(row.arrivalCount)}</td><td className="px-4 py-3 text-right">{formatNumber(row.departureTicketCount)}</td><td className="px-4 py-3 text-right">{formatNumber(row.arrivalTicketCount)}</td>
              <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(row.totalGross)}</td><td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">{formatCurrency(row.totalRefund)}</td>
            </tr>)}
          </tbody>
          {!isLoading && rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60">
            <td colSpan={2} className="px-4 py-2.5 font-black text-slate-600 dark:text-slate-300">{lang === "VN" ? "Tổng" : "Total"}</td><td className="px-4 py-2.5 text-right">{formatNumber(totalDeparture)}</td><td className="px-4 py-2.5 text-right">{formatNumber(totalArrival)}</td><td colSpan={2} />
            <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(data?.totalGross)}</td><td className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400">{formatCurrency(data?.totalRefund)}</td>
          </tr></tfoot>}
        </table>
      </div>
    </section>
  );
}
