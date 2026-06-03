import { useState } from "react"; // Thêm useState để quản lý đóng/mở thông báo
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingActions } from "./FloatingActions";
import { NoticeBar } from "./NoticeBar"; // Import NoticeBar đứng chung thư mục layout/

export const MainLayout = ({ children }) => {
  // Quản lý trạng thái đóng/mở thanh thông báo toàn hệ thống
  const [isNoticeVisible, setIsNoticeVisible] = useState(true);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* 1. Thanh thông báo luôn nằm cố định ở vị trí cao nhất */}
      <NoticeBar isVisible={isNoticeVisible} setVisible={setIsNoticeVisible} />
      
      {/* 2. Thanh điều hướng nhận biết trạng thái thông báo để tự động lùi xuống top-10 */}
      <Header isNoticeVisible={isNoticeVisible} />
      
      {/* 3. Khối nội dung các trang tự lùi margin xuống khi thanh thông báo đang hiển thị */}
      <div className={`grow transition-all duration-300 ${isNoticeVisible ? "mt-10" : "mt-0"}`}>
        {children}
      </div>
      
      {/* 4. Thành phần chân trang và các nút tác vụ nổi */}
      <Footer />
      <FloatingActions />
    </div>
  );
};