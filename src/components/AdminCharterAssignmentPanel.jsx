import { useCallback, useEffect, useState } from "react";
import { assignAdminCharterBookingManager } from "../services/charterBookingService";
import { fetchManagerUsers } from "../services/userService";
import { fetchStationManagers } from "../services/stationService";
import { getApiErrorMessage } from "../utils/apiError";
import { pick } from "../utils/charterBookingAdmin";
import { showToast } from "../utils/swalToast";

function getUserInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function UserPicker({
  lang,
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  emptyMessage,
  icon = "person",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.id === value);

  const filteredOptions = options.filter((option) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return (
      option.fullName.toLowerCase().includes(keyword)
      || option.phone.toLowerCase().includes(keyword)
      || option.email.toLowerCase().includes(keyword)
    );
  });

  const renderUserRow = (option, compact = false) => (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-[#124757]/10 font-headline font-black text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400 ${compact ? "h-10 w-10 text-xs" : "h-11 w-11 text-sm"}`}>
        {getUserInitials(option.fullName)}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className={`truncate font-bold text-slate-800 dark:text-white ${compact ? "text-sm" : "text-sm"}`}>
            {option.fullName}
          </p>
          {option.isPrimary ? (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {lang === "VN" ? "Chính" : "Primary"}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
          {[option.phone, option.email].filter(Boolean).join(" · ") || (lang === "VN" ? "Không có liên hệ" : "No contact")}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
            setSearch("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            setSearch("");
          }
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 text-left outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 ${
            isOpen
              ? "border-[#124757] ring-2 ring-[#124757]/15 dark:border-yellow-400 dark:ring-yellow-400/20"
              : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {selected ? (
            renderUserRow(selected, true)
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="material-symbols-outlined text-xl text-slate-400">{icon}</span>
              </span>
              <p className="text-sm font-bold text-slate-400">{placeholder}</p>
            </div>
          )}
          <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </button>

        {isOpen && !disabled ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="material-symbols-outlined text-lg text-slate-400">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={lang === "VN" ? "Tìm tên, SĐT, email..." : "Search name, phone, email..."}
                  className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5" role="listbox">
              {filteredOptions.length > 0 ? filteredOptions.map((option) => {
                const isSelected = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-[#124757]/5 ring-1 ring-[#124757]/15 dark:bg-yellow-400/10 dark:ring-yellow-400/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {renderUserRow(option)}
                    {isSelected ? (
                      <span className="material-symbols-outlined shrink-0 text-lg text-[#124757] dark:text-yellow-400">check_circle</span>
                    ) : null}
                  </button>
                );
              }) : (
                <p className="px-3 py-6 text-center text-xs font-bold text-slate-400">
                  {emptyMessage || (lang === "VN" ? "Không có kết quả." : "No results.")}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminCharterAssignmentPanel({
  lang,
  booking,
  capabilities,
  isSubmitting = false,
  onReload,
}) {
  const [managerOptions, setManagerOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState("");
  const [managerSource, setManagerSource] = useState("station");
  const [fromStationName, setFromStationName] = useState(booking?.fromStationName || "");
  const [selectedManagerId, setSelectedManagerId] = useState(booking?.assignedManagerId || "");

  const fromStationId = String(
    booking?.fromStationId
    || pick(booking?.raw, ["fromStationId", "fromStation.id", "fromStation.stationId"], "")
    || "",
  );

  const loadManagers = useCallback(async () => {
    if (!booking?.id || !capabilities.canAssignManager) return;
    try {
      setIsLoading(true);
      setUsersLoadError("");
      let managerUsers = [];
      let nextManagerSource = "station";
      let nextStationName = booking?.fromStationName || "";

      try {
        if (fromStationId) {
          const stationResult = await fetchStationManagers(fromStationId);
          nextStationName = stationResult.stationName || nextStationName;
          if (stationResult.managers.length > 0) {
            managerUsers = stationResult.managers;
            nextManagerSource = "station";
          } else {
            managerUsers = await fetchManagerUsers({ force: true });
            nextManagerSource = "all";
          }
        } else {
          managerUsers = await fetchManagerUsers({ force: true });
          nextManagerSource = "all";
        }
      } catch (error) {
        try {
          managerUsers = await fetchManagerUsers({ force: true });
          nextManagerSource = "fallback";
        } catch (fallbackError) {
          setUsersLoadError(getApiErrorMessage(
            fallbackError || error,
            lang === "VN" ? "Không tải được danh sách quản lý." : "Unable to load managers.",
          ));
        }
      }

      setManagerOptions(managerUsers);
      setManagerSource(nextManagerSource);
      setFromStationName(nextStationName);
      const preferredManagerId = booking.assignedManagerId
        || managerUsers.find((item) => item.isPrimary)?.id
        || (managerUsers.length === 1 ? managerUsers[0].id : "")
        || "";
      setSelectedManagerId(preferredManagerId);
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không tải được phân công" : "Unable to load assignments",
        text: getApiErrorMessage(error, lang === "VN" ? "Vui lòng thử lại." : "Please try again."),
        timer: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    booking?.assignedManagerId,
    booking?.fromStationName,
    booking?.id,
    capabilities.canAssignManager,
    fromStationId,
    lang,
  ]);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  const handleAssignManager = async () => {
    if (!booking?.id || !selectedManagerId) return;
    try {
      setIsSaving(true);
      await assignAdminCharterBookingManager(booking.id, { managerUserId: selectedManagerId });
      await onReload?.();
      await loadManagers();
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã gán quản lý" : "Manager assigned",
        timer: 1800,
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Gán quản lý thất bại" : "Manager assignment failed",
        text: getApiErrorMessage(error),
        timer: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!capabilities.canAssignManager) {
    return null;
  }

  return (
    <section className="rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
      <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
        <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
          {lang === "VN" ? "Gán quản lý phụ trách" : "Assign manager"}
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-400">
          {lang === "VN"
            ? "Gán sau khi báo giá / xác nhận chuyến. Quản lý được chọn sẽ phụ trách vận hành booking này."
            : "Assign after quoting / confirming the trip. The selected manager will operate this booking."}
        </p>
      </div>

      <div className="space-y-6 px-6 py-6 md:px-8">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Quản lý hiện tại" : "Current manager"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                {booking?.assignedManagerName || (lang === "VN" ? "Chưa gán" : "Not assigned")}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${
              booking?.assignedManagerId
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-200/80 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {booking?.assignedManagerId
                ? (lang === "VN" ? "Đã gán" : "Assigned")
                : (lang === "VN" ? "Chưa gán" : "Unassigned")}
            </span>
          </div>

          {usersLoadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {usersLoadError}
              <button
                type="button"
                onClick={loadManagers}
                className="ml-2 font-bold underline"
              >
                {lang === "VN" ? "Thử lại" : "Retry"}
              </button>
            </div>
          ) : null}
          {managerOptions.length === 0 && !isLoading && !usersLoadError ? (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
              {lang === "VN"
                ? "Không tìm thấy tài khoản role MANAGER. Kiểm tra màn Quản lý nhân viên đã tạo user MANAGER chưa."
                : "No MANAGER role accounts found. Create a MANAGER user first."}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <UserPicker
              lang={lang}
              label={lang === "VN" ? "Chọn quản lý phụ trách" : "Select manager"}
              value={selectedManagerId}
              options={managerOptions}
              onChange={setSelectedManagerId}
              disabled={isSubmitting || isSaving || isLoading}
              placeholder={
                isLoading
                  ? (lang === "VN" ? "Đang tải danh sách..." : "Loading managers...")
                  : (lang === "VN" ? "Tìm và chọn quản lý..." : "Search and choose manager...")
              }
              emptyMessage={lang === "VN" ? "Không tìm thấy tài khoản MANAGER." : "No MANAGER accounts found."}
              icon="supervisor_account"
            />
            <button
              type="button"
              onClick={handleAssignManager}
              disabled={
                !selectedManagerId
                || selectedManagerId === booking?.assignedManagerId
                || isSubmitting
                || isSaving
                || isLoading
              }
              className="h-[52px] w-full rounded-2xl bg-[#124757] px-6 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 sm:min-w-[148px] dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
            >
              {booking?.assignedManagerId
                ? (lang === "VN" ? "Đổi quản lý" : "Change manager")
                : (lang === "VN" ? "Gán quản lý" : "Assign manager")}
            </button>
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            {managerSource === "station"
              ? (lang === "VN"
                ? `Đang lấy manager thuộc bến đi${fromStationName ? `: ${fromStationName}` : ""}.`
                : `Showing managers of departure station${fromStationName ? `: ${fromStationName}` : ""}.`)
              : managerSource === "fallback"
                ? (lang === "VN"
                  ? "Không lấy được manager theo bến — đang hiện toàn bộ MANAGER."
                  : "Could not load station managers — showing all MANAGER accounts.")
                : (lang === "VN"
                  ? "Bến chưa có manager gắn sẵn — đang hiện toàn bộ MANAGER."
                  : "Station has no linked managers — showing all MANAGER accounts.")}
          </p>
        </div>
      </div>
    </section>
  );
}
