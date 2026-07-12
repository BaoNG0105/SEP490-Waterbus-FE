import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { fetchAllStations } from "../services/stationService";

const getStationId = (station) => String(station?.stationId || station?.id || "");

/**
 * Multi-select gắn bến cho Manager / Staff Ground.
 */
export function StationAssignField({
  value = [],
  onChange,
  disabled = false,
  label,
}) {
  const { lang } = useApp();
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(
    () => new Set((value || []).map(String).filter(Boolean)),
    [value]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError("");
        const data = await fetchAllStations();
        if (cancelled) return;
        const rows = (Array.isArray(data) ? data : [])
          .filter((s) => String(s?.status || "Active").toLowerCase() !== "inactive")
          .filter((s) => s?.isWaterbusStation === true)
          .sort((a, b) =>
            String(a.stationName || "").localeCompare(String(b.stationName || ""), "vi")
          );
        setStations(rows);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError(
            lang === "VN" ? "Không tải được danh sách bến." : "Failed to load stations."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      const name = String(s.stationName || "").toLowerCase();
      const code = String(s.stationCode || "").toLowerCase();
      const address = String(s.address || "").toLowerCase();
      return name.includes(q) || code.includes(q) || address.includes(q);
    });
  }, [stations, query]);

  const toggle = (stationId) => {
    if (disabled) return;
    const id = String(stationId);
    const next = selectedIds.has(id)
      ? value.filter((x) => String(x) !== id)
      : [...value.map(String), id];
    onChange(next);
  };

  const clearAll = () => {
    if (!disabled) onChange([]);
  };

  return (
    <div className={`space-y-2 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
          {label || (lang === "VN" ? "Gắn bến làm việc" : "Assigned stations")}
        </label>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] font-bold uppercase text-slate-400 hover:text-red-500 transition-colors"
          >
            {lang === "VN" ? "Bỏ chọn hết" : "Clear all"}
          </button>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={lang === "VN" ? "Tìm bến theo tên / mã..." : "Search station name / code..."}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400"
      />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 max-h-52 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <p className="px-3 py-4 text-[11px] font-bold text-red-500">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-[11px] font-semibold text-slate-400">
            {lang === "VN" ? "Không có bến phù hợp." : "No matching stations."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {filtered.map((station) => {
              const id = getStationId(station);
              if (!id) return null;
              const checked = selectedIds.has(id);
              return (
                <li key={id}>
                  <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                      className="mt-0.5 accent-[#124757] dark:accent-yellow-400"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {station.stationName || "--"}
                      </span>
                      <span className="block text-[10px] font-semibold text-slate-400 truncate">
                        {station.stationCode || id}
                        {station.address ? ` · ${station.address}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-slate-400 font-semibold">
        {lang === "VN"
          ? `Đã chọn ${selectedIds.size} bến`
          : `${selectedIds.size} station(s) selected`}
      </p>
    </div>
  );
}

/** Manager hoặc Staff Ground mới được gắn bến. */
export function canAssignStations({ roleSystemName, staffType }) {
  const role = String(roleSystemName || "").toUpperCase();
  if (role === "MANAGER") return true;
  if (role === "STAFF") {
    const type = String(staffType || "").toLowerCase().replace(/[_\s-]/g, "");
    return type === "ground" || type === "1";
  }
  return false;
}
