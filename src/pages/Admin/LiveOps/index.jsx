import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";

import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";

import { LiveTracking } from "../LiveTracking";
import { IncidentManagement } from "../IncidentManagement";

/**
 * Một tab sidebar: Theo dõi tàu + Sự cố / Cứu hộ.
 * ?view=map | ?view=incidents
 */
export function LiveOps() {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const [params, setParams] = useSearchParams();
  // Admin / Manager / Staff đều xem được GPS live + sự cố.
  const canMap = isAdminUser(user) || isManagerUser(user) || isStaffUser(user);
  const canIncidents = canMap;

  const view = useMemo(() => {
    const raw = String(params.get("view") || "").toLowerCase();
    if (raw === "incidents" || raw === "incident" || raw === "sos") return "incidents";
    return "map";
  }, [params]);

  const effectiveView = !canMap && canIncidents ? "incidents" : view;

  if (!canMap && !canIncidents) {
    return <Navigate to="/admin/reports/revenue" replace />;
  }

  const setView = (next) => {
    if (next === "incidents") {
      setParams({ view: "incidents" }, { replace: true });
      return;
    }
    setParams({}, { replace: true });
  };

  const tabs = (
    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      {canMap ? (
        <button
          type="button"
          onClick={() => setView("map")}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition ${
            effectiveView === "map"
              ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {lang === "VN" ? "Bản đồ" : "Map"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setView("incidents")}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition ${
          effectiveView === "incidents"
            ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {lang === "VN" ? "Sự cố" : "Incidents"}
      </button>
    </div>
  );

  // Map: full-bleed (Live Tracking). Sự cố: layout admin chuẩn (như Phân công Staff).
  if (effectiveView === "incidents") {
    return (
      <IncidentManagement
        embedded
        hideReport={canMap}
        viewTabs={tabs}
      />
    );
  }

  return (
    <LiveTracking
      viewTabs={(
        <div className="inline-flex items-center rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700">
          {canMap ? (
            <button
              type="button"
              onClick={() => setView("map")}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-headline font-black uppercase tracking-wider transition ${
                effectiveView === "map"
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden>my_location</span>
              {lang === "VN" ? "Bản đồ" : "Map"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setView("incidents")}
            className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-headline font-black uppercase tracking-wider transition ${
              effectiveView === "incidents"
                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden>emergency</span>
            {lang === "VN" ? "Sự cố" : "Incidents"}
          </button>
        </div>
      )}
    />
  );
}
