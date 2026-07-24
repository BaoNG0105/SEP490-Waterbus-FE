import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { StaffManagement } from "../StaffManagement";
import { StaffAssignmentManagement } from "../StaffAssignmentManagement";

/**
 * Một mục sidebar Nhân viên: tài khoản + phân công / lịch.
 * ?view=accounts | ?view=assignments
 */
export function StaffHub() {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const [params, setParams] = useSearchParams();

  const canAccounts = isAdminUser(user) || isManagerUser(user);
  const canAssignments = canAccounts || isStaffUser(user);

  const view = useMemo(() => {
    const raw = String(params.get("view") || "").toLowerCase();
    if (raw === "assignments" || raw === "assignment" || raw === "schedule") return "assignments";
    return "accounts";
  }, [params]);

  const effectiveView = !canAccounts && canAssignments ? "assignments" : view;

  if (!canAccounts && !canAssignments) {
    return <Navigate to="/admin" replace />;
  }

  const setView = (next) => {
    if (next === "assignments") {
      setParams({ view: "assignments" }, { replace: true });
      return;
    }
    setParams({}, { replace: true });
  };

  const tabs = canAccounts ? (
    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setView("accounts")}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition ${
          effectiveView === "accounts"
            ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <span className="material-symbols-outlined text-[15px]" aria-hidden>
          badge
        </span>
        {lang === "VN" ? "Tài khoản" : "Accounts"}
      </button>
      <button
        type="button"
        onClick={() => setView("assignments")}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider transition ${
          effectiveView === "assignments"
            ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <span className="material-symbols-outlined text-[15px]" aria-hidden>
          event_available
        </span>
        {lang === "VN" ? "Phân công" : "Schedule"}
      </button>
    </div>
  ) : null;

  if (effectiveView === "assignments") {
    return <StaffAssignmentManagement viewTabs={tabs} />;
  }

  return <StaffManagement viewTabs={tabs} />;
}
