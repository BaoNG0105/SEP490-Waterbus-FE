import { useState } from "react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { AdminFooter } from "./AdminFooter";

// Truyền prop 'title' để các trang có thể tự động thay đổi tên trên thanh Header
export const AdminLayout = ({ children, title }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Cho phép thu gọn Sidebar trên Desktop để lấy thêm không gian làm việc — mặc định luôn hiện.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebarCollapsed = () => setIsSidebarCollapsed((prev) => !prev);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body text-slate-800 dark:text-white flex flex-col transition-colors duration-300">

      {/* 1. HEADER - Cố định ở phía trên cùng trang web (Cao h-16) */}
      <AdminHeader
        onMenuClick={() => setIsDrawerOpen(true)}
        title={title}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebarCollapsed}
      />

      {/* Khối wrapper bọc toàn bộ phần thân bên dưới thanh Header */}
      <div className="flex flex-1 pt-16 relative">

        {/* 2. SIDEBAR - Nằm ở cạnh bên trái (Cố định rộng w-64 trên máy tính) */}
        <AdminSidebar
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onCollapse={() => setIsSidebarCollapsed(true)}
        />

        {/* KHỐI CHỨA NỘI DUNG CHÍNH & FOOTER PHÍA BÊN PHẢI */}
        {/* Lớp lg:pl-64 giúp đẩy toàn bộ khối này sang phải 256px để nhường chỗ cho Sidebar */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-0" : "lg:pl-64"}`}>
          
          {/* 3. MAIN BODY - Nằm ở khu vực chính giữa để hiển thị nội dung các trang quản trị */}
          {/* Lớp flex-1 giúp main tự động giãn rộng để đẩy khít Footer xuống dưới cùng nếu ít nội dung */}
          <main className="flex-1 px-4 md:px-8 lg:px-10 py-6 md:py-8 w-full">
            {children}
          </main>

          {/* 4. FOOTER - Nằm ở dưới cùng của khu vực làm việc hệ thống */}
          <AdminFooter />

        </div>
      </div>
    </div>
  );
};