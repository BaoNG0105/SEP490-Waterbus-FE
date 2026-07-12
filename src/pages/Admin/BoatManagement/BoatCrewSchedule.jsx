import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchBoatDetail } from "../../../services/boatService";
import { BoatStaffAssignmentPanel } from "../../../components/BoatStaffAssignmentPanel";

export function BoatCrewSchedule() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  const [boat, setBoat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchBoatDetail(id)
      .then((data) => {
        if (active) setBoat(data);
      })
      .catch((error) => {
        console.error("Lỗi tải thông tin tàu:", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const boatCode = boat?.code || boat?.boatCode || "";
  const boatName = boat?.name || boat?.boatName || "";

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/boats-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {lang === "VN" ? "Phân công nhân viên trên tàu" : "Onboard staff assignment"}
            {boatCode ? `: ${boatCode}` : ""}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {isLoading
              ? (lang === "VN" ? "Đang tải thông tin tàu..." : "Loading boat...")
              : boatName || (lang === "VN" ? "Gán nhân viên làm việc trên tàu theo khoảng ngày" : "Assign staff who work on this boat")}
          </p>
        </div>
      </div>

      <BoatStaffAssignmentPanel boatId={id} boatCode={boatCode} />
    </div>
  );
}
