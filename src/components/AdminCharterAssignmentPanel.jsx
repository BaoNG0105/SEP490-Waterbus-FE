import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  assignAdminCharterBookingManager,
  createCharterBookingStaffAssignment,
  fetchCharterBookingStaffAssignments,
  replaceCharterBookingStaffAssignment,
} from "../services/charterBookingService";
import { fetchManagerUsers, fetchStaffUsers } from "../services/userService";
import { fetchStationManagers } from "../services/stationService";
import { getApiErrorMessage } from "../utils/apiError";
import { getBoatId, getBoatNameOnly, pick } from "../utils/charterBookingAdmin";

const SHIFT_OPTIONS = ["Day", "Night"];
const DUTY_ROLE_OPTIONS = ["Captain", "DeckHand", "Ticketing"];

const normalizeStaffAssignment = (item) => ({
  assignmentId: String(pick(item, ["assignmentId", "id", "staffAssignmentId"], "")),
  staffUserId: String(pick(item, ["staffUserId", "staffId", "userId", "staff.id"], "")),
  staffName: pick(item, ["staffName", "staff.fullName", "staff.name", "fullName"], "--"),
  boatId: String(pick(item, ["boatId", "boat.id"], "")),
  boatName: pick(item, ["boatName", "boat.name", "boat.code"], ""),
  shiftCode: pick(item, ["shiftCode"], ""),
  dutyRole: pick(item, ["dutyRole"], ""),
  status: pick(item, ["status", "assignmentStatus"], "Active"),
});

function AssignmentOptionSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  allowEmpty = false,
  emptyLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || null;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-left outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 ${
          isOpen
            ? "border-[#124757] ring-2 ring-[#124757]/15 dark:border-yellow-400 dark:ring-yellow-400/20"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate text-sm font-bold ${selected ? "text-slate-800 dark:text-white" : "text-slate-400"}`}>
          {selected?.label || placeholder}
        </span>
        <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {isOpen && !disabled ? (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
        >
          {allowEmpty ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                !value
                  ? "bg-[#124757]/5 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-300"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
              role="option"
              aria-selected={!value}
            >
              {emptyLabel || placeholder}
            </button>
          ) : null}
          {options.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                  isSelected
                    ? "bg-[#124757]/5 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
                role="option"
                aria-selected={isSelected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  selectedBoats = [],
  isSubmitting = false,
  onReload,
}) {
  const [managerOptions, setManagerOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState("");
  const [managerSource, setManagerSource] = useState("station");
  const [fromStationName, setFromStationName] = useState(booking?.fromStationName || "");
  const [selectedManagerId, setSelectedManagerId] = useState(booking?.assignedManagerId || "");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [shiftCode, setShiftCode] = useState("Day");
  const [dutyRole, setDutyRole] = useState("Captain");
  const [replaceStaffByAssignment, setReplaceStaffByAssignment] = useState({});
  const [replaceReasonByAssignment, setReplaceReasonByAssignment] = useState({});

  const fromStationId = String(
    booking?.fromStationId
    || pick(booking?.raw, ["fromStationId", "fromStation.id", "fromStation.stationId"], "")
    || "",
  );

  const boatOptions = useMemo(() => selectedBoats.map((boat) => ({
    id: getBoatId(boat),
    label: `${getBoatNameOnly(boat)}${boat.code ? ` (${boat.code})` : ""}`,
  })).filter((boat) => boat.id), [selectedBoats]);
  const boatRequired = boatOptions.length > 1;

  const loadAssignments = useCallback(async () => {
    if (!booking?.id) return;
    try {
      setIsLoading(true);
      setUsersLoadError("");
      let managerUsers = [];
      let staffUsers = [];
      let assignmentData = [];
      let nextManagerSource = "station";
      let nextStationName = booking?.fromStationName || "";
      const userErrors = [];

      if (capabilities.canAssignManager) {
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
            userErrors.push(getApiErrorMessage(
              fallbackError || error,
              lang === "VN" ? "Không tải được danh sách quản lý." : "Unable to load managers.",
            ));
          }
        }
      }

      if (capabilities.canAssignStaff) {
        const [staffResult, assignmentResult] = await Promise.allSettled([
          fetchStaffUsers({ force: true }),
          fetchCharterBookingStaffAssignments(booking.id),
        ]);
        if (staffResult.status === "fulfilled") {
          staffUsers = staffResult.value;
        } else {
          userErrors.push(getApiErrorMessage(
            staffResult.reason,
            lang === "VN" ? "Không tải được danh sách nhân viên." : "Unable to load staff.",
          ));
        }
        if (assignmentResult.status === "fulfilled") {
          assignmentData = assignmentResult.value;
        }
      }

      const rows = Array.isArray(assignmentData)
        ? assignmentData
        : (Array.isArray(assignmentData?.content) ? assignmentData.content : []);
      setAssignments(rows.map(normalizeStaffAssignment));
      setManagerOptions(managerUsers);
      setStaffOptions(staffUsers);
      setManagerSource(nextManagerSource);
      setFromStationName(nextStationName);
      const preferredManagerId = booking.assignedManagerId
        || managerUsers.find((item) => item.isPrimary)?.id
        || (managerUsers.length === 1 ? managerUsers[0].id : "")
        || "";
      setSelectedManagerId(preferredManagerId);
      setUsersLoadError(userErrors[0] || "");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không tải được phân công" : "Unable to load assignments",
        text: getApiErrorMessage(error, lang === "VN" ? "Vui lòng thử lại." : "Please try again."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    booking?.assignedManagerId,
    booking?.fromStationName,
    booking?.id,
    capabilities.canAssignManager,
    capabilities.canAssignStaff,
    fromStationId,
    lang,
  ]);

  useEffect(() => {
    if (!selectedBoatId && boatOptions[0]?.id) {
      setSelectedBoatId(boatOptions[0].id);
    }
  }, [boatOptions, selectedBoatId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleAssignManager = async () => {
    if (!booking?.id || !selectedManagerId) return;
    try {
      setIsSaving(true);
      await assignAdminCharterBookingManager(booking.id, { managerUserId: selectedManagerId });
      await onReload?.();
      await loadAssignments();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã gán quản lý" : "Manager assigned",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Gán quản lý thất bại" : "Manager assignment failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!booking?.id || !selectedStaffId) return;
    if (boatRequired && !selectedBoatId) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu" : "Select boat",
        text: lang === "VN" ? "Booking nhiều tàu — bắt buộc chọn boatId." : "Multiple boats — boatId is required.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsSaving(true);
      await createCharterBookingStaffAssignment(booking.id, {
        staffUserId: selectedStaffId,
        boatId: selectedBoatId || boatOptions[0]?.id || null,
        shiftCode,
        dutyRole,
      });
      setSelectedStaffId("");
      await onReload?.();
      await loadAssignments();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã gán nhân viên" : "Staff assigned",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Gán nhân viên thất bại" : "Staff assignment failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceStaff = async (assignment) => {
    const nextStaffId = replaceStaffByAssignment[assignment.assignmentId];
    const reason = (replaceReasonByAssignment[assignment.assignmentId] || "").trim();
    if (!booking?.id || !assignment.assignmentId || !nextStaffId) return;
    if (!reason) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Nhập lý do" : "Reason required",
        text: lang === "VN" ? "Vui lòng nhập lý do thay nhân viên." : "Please enter a replacement reason.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsSaving(true);
      await replaceCharterBookingStaffAssignment(booking.id, assignment.assignmentId, {
        replacementStaffUserId: nextStaffId,
        reason,
      });
      await onReload?.();
      await loadAssignments();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã thay nhân viên" : "Staff replaced",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Thay nhân viên thất bại" : "Staff replacement failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!capabilities.canViewAssignmentTab) {
    return null;
  }

  const isManagerView = capabilities.canAssignStaff;

  return (
    <section className="rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
      <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
        <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
          {isManagerView
            ? (lang === "VN" ? "Phân công nhân viên" : "Staff assignment")
            : (lang === "VN" ? "Gán quản lý phụ trách" : "Assign manager")}
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-400">
          {isManagerView
            ? (lang === "VN"
              ? "Chọn nhân viên trực chuyến cho booking này."
              : "Assign operating staff for this booking.")
            : (lang === "VN"
              ? "Gán sau khi báo giá / xác nhận chuyến. Quản lý được chọn sẽ tự phân công nhân viên vận hành."
              : "Assign after quoting / confirming the trip. The selected manager will assign operating staff.")}
        </p>
      </div>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {!isManagerView ? (
          <>
            {capabilities.canAssignManager ? (
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
                      onClick={loadAssignments}
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
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Quản lý hiện tại" : "Current manager"}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">
                  {booking?.assignedManagerName || (lang === "VN" ? "Chưa gán" : "Not assigned")}
                </p>
              </div>
            )}

            {!capabilities.canAssignStaff && Array.isArray(booking?.staffAssignments) && booking.staffAssignments.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
                  {lang === "VN" ? "Nhân viên đã phân công" : "Assigned staff"}
                </p>
                {booking.staffAssignments.map((item, index) => {
                  const row = normalizeStaffAssignment(item);
                  return (
                    <div key={row.assignmentId || `${row.staffUserId}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{row.staffName}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {row.boatName || (lang === "VN" ? "Chưa gắn tàu" : "No boat")}
                        {" · "}
                        {row.status}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        {isManagerView ? (
          <>
          <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-[11px] font-headline font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Gán nhân viên trực chuyến" : "Assign operating staff"}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <UserPicker
                lang={lang}
                label={lang === "VN" ? "Nhân viên" : "Staff"}
                value={selectedStaffId}
                options={staffOptions}
                onChange={setSelectedStaffId}
                disabled={isSubmitting || isSaving || isLoading}
                placeholder={lang === "VN" ? "Chọn nhân viên" : "Choose staff"}
                emptyMessage={lang === "VN" ? "Không tìm thấy tài khoản STAFF." : "No STAFF accounts found."}
                icon="badge"
              />
              <div className="space-y-2">
                <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Tàu" : "Boat"}{boatRequired ? " *" : ""}
                </span>
                <AssignmentOptionSelect
                  value={selectedBoatId}
                  options={boatOptions.map((boat) => ({ value: boat.id, label: boat.label }))}
                  onChange={setSelectedBoatId}
                  disabled={isSubmitting || isSaving || isLoading || boatOptions.length === 0}
                  placeholder={boatRequired ? (lang === "VN" ? "Chọn tàu" : "Select boat") : (lang === "VN" ? "Tự động / không chọn" : "Auto / none")}
                  allowEmpty={!boatRequired}
                  emptyLabel={lang === "VN" ? "Tự động / không chọn" : "Auto / none"}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Ca trực" : "Shift"}
                </span>
                <AssignmentOptionSelect
                  value={shiftCode}
                  options={SHIFT_OPTIONS.map((option) => ({ value: option, label: option }))}
                  onChange={setShiftCode}
                  disabled={isSubmitting || isSaving || isLoading}
                  placeholder={lang === "VN" ? "Chọn ca" : "Select shift"}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Vai trò" : "Duty role"}
                </span>
                <AssignmentOptionSelect
                  value={dutyRole}
                  options={DUTY_ROLE_OPTIONS.map((option) => ({ value: option, label: option }))}
                  onChange={setDutyRole}
                  disabled={isSubmitting || isSaving || isLoading}
                  placeholder={lang === "VN" ? "Chọn vai trò" : "Select duty role"}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAssignStaff}
              disabled={
                !selectedStaffId
                || (boatRequired && !selectedBoatId)
                || isSubmitting
                || isSaving
                || isLoading
              }
              className="rounded-xl bg-[#124757] px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900"
            >
              {lang === "VN" ? "Gán nhân viên" : "Assign staff"}
            </button>
          </div>

          <div className="space-y-3">
          <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Nhân viên đã phân công" : "Assigned staff"}
          </p>
          {isLoading ? (
            <p className="text-sm font-bold text-slate-400">{lang === "VN" ? "Đang tải..." : "Loading..."}</p>
          ) : assignments.length > 0 ? assignments.map((assignment) => (
            <div key={assignment.assignmentId || `${assignment.staffUserId}-${assignment.boatId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{assignment.staffName}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {assignment.boatName || (lang === "VN" ? "Chưa gắn tàu" : "No boat")}
                    {assignment.shiftCode ? ` · ${assignment.shiftCode}` : ""}
                    {assignment.dutyRole ? ` · ${assignment.dutyRole}` : ""}
                    {" · "}
                    {assignment.status}
                  </p>
                </div>
                {capabilities.canAssignStaff ? (
                  <div className="flex flex-col gap-2 lg:min-w-[320px]">
                    <AssignmentOptionSelect
                      value={replaceStaffByAssignment[assignment.assignmentId] || ""}
                      options={staffOptions.map((option) => ({
                        value: option.id,
                        label: option.fullName,
                      }))}
                      onChange={(nextValue) => setReplaceStaffByAssignment((prev) => ({
                        ...prev,
                        [assignment.assignmentId]: nextValue,
                      }))}
                      disabled={isSaving}
                      placeholder={lang === "VN" ? "Thay bằng..." : "Replace with..."}
                      allowEmpty
                      emptyLabel={lang === "VN" ? "Thay bằng..." : "Replace with..."}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replaceReasonByAssignment[assignment.assignmentId] || ""}
                        onChange={(event) => setReplaceReasonByAssignment((prev) => ({
                          ...prev,
                          [assignment.assignmentId]: event.target.value,
                        }))}
                        placeholder={lang === "VN" ? "Lý do thay..." : "Reason..."}
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-[#124757] focus:ring-2 focus:ring-[#124757]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplaceStaff(assignment)}
                        disabled={
                          !replaceStaffByAssignment[assignment.assignmentId]
                          || !replaceReasonByAssignment[assignment.assignmentId]?.trim()
                          || isSaving
                        }
                        className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {lang === "VN" ? "Thay" : "Replace"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )) : (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
              {lang === "VN" ? "Chưa có nhân viên được gán." : "No staff assigned yet."}
            </p>
          )}
        </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
