import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext"; // Đi lên 1 cấp ra src/ rồi vào context

// DỮ LIỆU THÔNG BÁO CHẠY CHỮ (MOCK DATA)
const announcements = [
  {
    vn: "[THÔNG BÁO] Từ ngày 15/04/2026, hành khách tại Sân bay/Bến tàu cần thực hiện khai báo thông tin trước khi lên tàu.",
    en: "[NOTICE] From April 15, 2026, passengers must declare information before boarding.",
  },
  {
    vn: "[KHUYẾN MÃI] Nhập mã SUMMER26 giảm ngay 20% cho các chuyến đi trong tuần. Số lượng có hạn!",
    en: "[PROMOTION] Enter code SUMMER26 for 20% off weekday trips. Limited quantity!",
  },
  {
    vn: "[TIN TỨC] WaterBus chính thức mở thêm tuyến mới nối liền Quận 1 và Quận 7 vào tháng 6 này.",
    en: "[NEWS] WaterBus officially opens a new route connecting District 1 and District 7 this June.",
  },
];

export const NoticeBar = ({ isVisible, setVisible }) => {
  const { lang } = useApp();
  const [noticeIndex, setNoticeIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % announcements.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [isVisible]);

  const nextNotice = () => setNoticeIndex((prev) => (prev + 1) % announcements.length);
  const prevNotice = () => setNoticeIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 z-120 flex items-center justify-between px-4 md:px-8 shadow-sm transition-colors duration-300 select-none">
      
      {/* Icon trạng thái nhấp nháy */}
      <div className="flex items-center shrink-0 z-10 bg-white dark:bg-slate-900 py-2 pr-3">
        <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-[18px] animate-pulse">
          notifications_active
        </span>
      </div>

      {/* Hiệu ứng chữ chạy Marquee */}
      <div className="flex-1 relative h-full flex items-center overflow-hidden group">
        <style>{`
          @keyframes text-ticker {
            0% { left: 100%; transform: translateX(0); }
            100% { left: 0; transform: translateX(-100%); }
          }
          .animate-ticker {
            position: absolute;
            white-space: nowrap;
            animation: text-ticker 15s linear infinite;
          }
        `}</style>

        <p
          key={noticeIndex}
          className="text-xs md:text-sm font-body font-medium text-slate-700 dark:text-slate-300 animate-ticker group-hover:[animation-play-state:paused] cursor-default"
        >
          {lang === "VN" ? announcements[noticeIndex].vn : announcements[noticeIndex].en}
        </p>
      </div>

      {/* Các nút bấm điều khiển */}
      <div className="flex items-center gap-1 shrink-0 ml-4 z-10 bg-white dark:bg-slate-900 pl-2">
        <button onClick={prevNotice} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
        <button onClick={nextNotice} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>

        <div className="w-1px h-4 bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2"></div>

        <button
          onClick={() => setVisible(false)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};