import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

import { fetchAllRoutes, fetchRouteDetail, mergeGpsRoutes } from "../../../services/routeService";

import { getApiErrorMessage } from "../../../utils/apiError";
import {
  canSelectForMerge,
  getRouteKindLabel,
  validateMergeRouteChain,
} from "../../../utils/routeTypes";
import { notify } from "../../../utils/swalToast";
import { REGISTRATION_NUMBER_REGEX } from "../../../utils/boatValidation";
import { required } from "../../../utils/required";

const getRouteId = (route) => String(route?.routeId || route?.id || "");

const getOrderedStops = (route) =>
  (route?.stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);

export function MergeGpsRoutes() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailCache, setDetailCache] = useState({});

  const [formData, setFormData] = useState({
    routeCode: "",
    routeName: "",
    description: lang === "VN" ? "Ghép từ tuyến GPS" : "Merged from GPS routes",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchAllRoutes();
        setRoutes(data || []);
      } catch (error) {
        console.error(error);
        setErrorMsg(lang === "VN" ? "Không tải được danh sách tuyến." : "Failed to load routes.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [lang]);

  const gpsRoutes = useMemo(
    () => (routes || []).filter((r) => canSelectForMerge(r)),
    [routes]
  );

  const routeById = useMemo(() => {
    const map = new Map();
    gpsRoutes.forEach((r) => map.set(getRouteId(r), r));
    return map;
  }, [gpsRoutes]);

  const existingCodes = useMemo(
    () => new Set((routes || []).map((r) => String(r.routeCode || "").toUpperCase())),
    [routes]
  );

  // Validate real-time field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi ít
  // nhất 1 lần), nhưng nút Ghép tuyến bị khóa ngay khi còn field lỗi dù chưa touched hết.
  const [touchedFields, setTouchedFields] = useState({});
  const handleFieldBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };
  const fieldErrors = {
    ...(formData.routeCode.trim()
      ? (!REGISTRATION_NUMBER_REGEX.test(formData.routeCode.trim())
        ? { routeCode: lang === "VN" ? "Mã tuyến chỉ được gồm chữ cái, số và dấu gạch ngang (-)" : "Route code may only contain letters, numbers and hyphens" }
        : existingCodes.has(formData.routeCode.trim().toUpperCase())
          ? { routeCode: lang === "VN" ? `Mã tuyến "${formData.routeCode.trim().toUpperCase()}" đã tồn tại` : `Route code "${formData.routeCode.trim().toUpperCase()}" already exists` }
          : {})
      : { routeCode: lang === "VN" ? "Vui lòng nhập mã tuyến" : "Route code is required" }),
    ...(formData.routeName.trim() ? {} : {
      routeName: lang === "VN" ? "Vui lòng nhập tên tuyến" : "Route name is required",
    }),
  };
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const visibleFieldErrors = {
    ...(touchedFields.routeCode ? { routeCode: fieldErrors.routeCode } : {}),
    ...(touchedFields.routeName ? { routeName: fieldErrors.routeName } : {}),
  };

  const ensureDetail = async (routeId) => {
    if (detailCache[routeId]?.stops) return detailCache[routeId];
    const detail = await fetchRouteDetail(routeId);
    setDetailCache((prev) => ({ ...prev, [routeId]: detail }));
    return detail;
  };

  const toggleSelect = async (routeId) => {
    const id = String(routeId);
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    const route = routeById.get(id);
    if (route && !canSelectForMerge(route)) {
      setErrorMsg(
        lang === "VN"
          ? "Chỉ chọn tuyến nguồn GPS để ghép (không chọn Vòng tham quan / Tuyến booking)."
          : "Only GPS source routes can be merged (not sightseeing / booking)."
      );
      return;
    }
    try {
      await ensureDetail(id);
      setSelectedIds((prev) => [...prev, id]);
      setErrorMsg("");
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, lang === "VN" ? "Không tải được chi tiết tuyến." : "Failed to load route detail."));
    }
  };

  const moveSelected = (index, direction) => {
    setSelectedIds((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const orderedSelectedRoutes = useMemo(
    () =>
      selectedIds.map((id) => detailCache[id] || routeById.get(id)).filter(Boolean),
    [selectedIds, detailCache, routeById]
  );

  const chainPreview = useMemo(() => {
    return orderedSelectedRoutes.map((route) => {
      const stops = getOrderedStops(route);
      const first = stops[0];
      const last = stops[stops.length - 1];
      return {
        id: getRouteId(route),
        code: route.routeCode,
        from: first?.stationName || first?.stationCode || first?.stationId || "—",
        to: last?.stationName || last?.stationCode || last?.stationId || "—",
        fromId: String(first?.stationId || ""),
        toId: String(last?.stationId || ""),
      };
    });
  }, [orderedSelectedRoutes]);

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle =
    "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const errorInputStyle =
    "w-full bg-slate-50 dark:bg-slate-900 border border-rose-500 dark:border-rose-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 shadow-inner transition-all";
  const errorTextStyle = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Bấm submit khi còn field lỗi (VD: nhấn Enter) → hiện hết lỗi lên thay vì âm thầm chặn.
    setTouchedFields({ routeCode: true, routeName: true });
    if (hasFieldErrors) return;
    try {
      setErrorMsg("");
      const code = formData.routeCode.trim().toUpperCase();
      const name = formData.routeName.trim();

      // Đảm bảo mỗi tuyến đã có stops từ GET detail
      const detailed = [];
      for (const id of selectedIds) {
        detailed.push(await ensureDetail(id));
      }

      const chainError = validateMergeRouteChain(detailed, lang);
      if (chainError) {
        setErrorMsg(chainError);
        return;
      }

      setIsSubmitting(true);
      // BE tạo Regular; payload theo from-routes (không cần gửi routeType)
      const created = await mergeGpsRoutes({
        routeCode: code,
        routeName: name,
        description: formData.description.trim() || (lang === "VN" ? "Tuyến booking thường" : "Regular booking route"),
        sourceRouteIds: selectedIds,
      });

      const routeId = created?.routeId || created?.id || created?.data?.routeId;
      if (routeId) {
        await fetchRouteDetail(routeId);
      }

      await notify({
        icon: "success",
        title: lang === "VN" ? "Ghép tuyến thành công!" : "Routes merged!",
        confirmButtonColor: "#124757",
      });

      navigate(routeId ? `/admin/routes-management/${routeId}` : "/admin/routes-management");
    } catch (error) {
      console.error(error);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Ghép tuyến thất bại." : "Failed to merge routes."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/routes-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "GPS — Ghép tuyến" : "GPS — Merge routes"}
          </h2>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm whitespace-pre-line">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
            {lang === "VN" ? "Tuyến sau khi ghép" : "Merged route profile"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Mã tuyến" : "Route code"}{required()}</label>
              <input
                required
                value={formData.routeCode}
                onChange={(e) => setFormData((p) => ({ ...p, routeCode: e.target.value.toUpperCase() }))}
                onBlur={() => handleFieldBlur("routeCode")}
                className={`${visibleFieldErrors.routeCode ? errorInputStyle : inputStyle} uppercase`}
                placeholder="A-B-C"
              />
              {visibleFieldErrors.routeCode && <p className={errorTextStyle}>{visibleFieldErrors.routeCode}</p>}
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Tên tuyến" : "Route name"}{required()}</label>
              <input
                required
                value={formData.routeName}
                onChange={(e) => setFormData((p) => ({ ...p, routeName: e.target.value }))}
                onBlur={() => handleFieldBlur("routeName")}
                className={visibleFieldErrors.routeName ? errorInputStyle : inputStyle}
                placeholder="A - B - C"
              />
              {visibleFieldErrors.routeName && <p className={errorTextStyle}>{visibleFieldErrors.routeName}</p>}
            </div>
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Mô tả" : "Description"}</label>
            <input
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              className={inputStyle}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
            {lang === "VN" ? `Tuyến nguồn GPS (${selectedIds.length} đã chọn)` : `GPS source routes (${selectedIds.length} selected)`}
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold">
            {lang === "VN"
              ? "Chọn ít nhất 2 tuyến GPS nối đuôi nhau (A→B rồi B→C)."
              : "Pick at least 2 GPS routes that connect end-to-start (A→B then B→C)."}
          </p>

          {selectedIds.length > 0 && (
            <div className="space-y-2 mb-4">
              {chainPreview.map((item, index) => {
                const next = chainPreview[index + 1];
                const ok = !next || item.toId === next.fromId;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
                      ok
                        ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        : "border-rose-100 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/10"
                    }`}
                  >
                    <span className="text-[10px] font-black text-slate-500 w-6">#{index + 1}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.code}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.from} → {item.to}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => moveSelected(index, -1)} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-[#124757]">
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                      </button>
                      <button type="button" onClick={() => moveSelected(index, 1)} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-[#124757]">
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => toggleSelect(item.id)} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-500">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-100 dark:border-slate-700">
            {gpsRoutes.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 font-semibold">
                {lang === "VN" ? "Chưa có Route nguồn GPS nào." : "No GPS source routes yet."}
              </p>
            ) : (
              gpsRoutes.map((route) => {
                const id = getRouteId(route);
                const checked = selectedIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(id)}
                      className="mt-1 accent-[#124757] dark:accent-yellow-400"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                        {route.routeCode} · {route.routeName}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {getRouteKindLabel(route, lang)}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedIds.length < 2 || hasFieldErrors}
          className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {lang === "VN" ? "Ghép tuyến" : "Merge routes"}
        </button>
      </form>
    </div>
  );
}
