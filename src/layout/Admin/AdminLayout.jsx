import { useState } from "react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { AdminFooter } from "./AdminFooter";

// Truyền prop 'title' để các trang có thể đổi tên Header
export const AdminLayout = ({ children, title }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    // Bổ sung: dark:bg-slate-900 dark:text-white
    <div className="bg-surface dark:bg-slate-900 font-body text-on-surface dark:text-white min-h-screen flex flex-col transition-colors duration-300">
      {/* Header và Sidebar */}
      <AdminHeader onMenuClick={() => setIsDrawerOpen(true)} title={title} />
      <AdminSidebar
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-grow pt-24 px-6 max-w-7xl mx-auto pb-12 w-full">
        {children}
      </main>

      {/* Footer */}
      <AdminFooter />
    </div>
  );
};
