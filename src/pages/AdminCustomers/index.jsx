import { useState } from "react";
import { useApp } from "../../context/AppContext";

// MOCK DATA: Dữ liệu khách hàng ảo chờ API
const mockCustomers = [
  { id: "CU0001", name: "Nguyen Van A", phone: "0123456789" },
  { id: "CU0002", name: "Tran Thi B", phone: "0987654321" },
  { id: "CU0003", name: "Le Van C", phone: "0369852147" },
  { id: "CU0004", name: "Pham Thi D", phone: "0753159842" },
  { id: "CU0005", name: "Hoang Van E", phone: "0845123987" },
];

export const AdminCustomers = () => {
  const { lang } = useApp();

  // State quản lý việc đóng/mở Modal Tạo mới User
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8 relative min-h-[70vh]">
      {/* SECTION 1: Thanh Tìm kiếm & Lọc */}
      <section className="flex flex-col md:flex-row gap-4 items-center w-full">
        <div className="relative w-full flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400">
              search
            </span>
          </div>
          <input
            className="w-full pl-12 pr-4 py-3 bg-surface-container-high dark:bg-slate-800 text-on-surface dark:text-white border-none rounded-full focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 transition-colors placeholder:text-on-surface-variant dark:placeholder:text-slate-500 font-body outline-none"
            placeholder={
              lang === "VN" ? "Tìm kiếm khách hàng..." : "Search customers..."
            }
            type="text"
          />
        </div>
        <button className="flex items-center gap-2 bg-surface-container-highest dark:bg-slate-800 px-6 py-3 rounded-full text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-slate-700 transition-colors whitespace-nowrap shadow-sm font-label font-semibold border border-transparent dark:border-slate-700">
          <span className="material-symbols-outlined text-[20px]">
            filter_list
          </span>
          {lang === "VN" ? "Bộ lọc" : "Filter"}
        </button>
      </section>

      {/* SECTION 2: Danh sách Khách hàng (Table) */}
      <section className="bg-surface-container-low dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-transparent dark:border-slate-700 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="text-on-surface-variant dark:text-slate-400 font-label text-sm uppercase tracking-wider border-b border-outline-variant/15 dark:border-slate-700">
                <th className="pb-4 px-4 font-bold">
                  {lang === "VN" ? "ID Khách hàng" : "Customer ID"}
                </th>
                <th className="pb-4 px-4 font-bold">
                  {lang === "VN" ? "Họ và Tên" : "Full Name"}
                </th>
                <th className="pb-4 px-4 font-bold">
                  {lang === "VN" ? "Số điện thoại" : "Phone Number"}
                </th>
                <th className="pb-4 px-4 font-bold text-right">
                  {lang === "VN" ? "Thao tác" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 dark:divide-slate-700 font-body">
              {mockCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-surface-container-highest/50 dark:hover:bg-slate-700/50 transition-colors group"
                >
                  <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                    {customer.id}
                  </td>
                  <td className="py-4 px-4 text-slate-700 dark:text-slate-200">
                    {customer.name}
                  </td>
                  <td className="py-4 px-4 text-on-surface-variant dark:text-slate-400">
                    {customer.phone}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        aria-label="Edit"
                        className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          edit
                        </span>
                      </button>
                      <button
                        aria-label="Delete"
                        className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          delete
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: Phân trang (Pagination) */}
      <div className="flex justify-center items-center gap-2 mt-4 font-label">
        <button
          aria-label="Previous Page"
          className="p-2 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_left
          </span>
        </button>
        <button className="w-10 h-10 rounded-full bg-primary-container dark:bg-yellow-400 text-on-primary-container dark:text-slate-900 font-bold flex items-center justify-center shadow-md">
          1
        </button>
        <button className="w-10 h-10 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-400 flex items-center justify-center transition-colors">
          2
        </button>
        <button className="w-10 h-10 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-400 flex items-center justify-center transition-colors">
          3
        </button>
        <span className="text-on-surface-variant dark:text-slate-400 px-2">
          ...
        </span>
        <button className="w-10 h-10 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-400 flex items-center justify-center transition-colors">
          12
        </button>
        <button
          aria-label="Next Page"
          className="p-2 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_right
          </span>
        </button>
      </div>

      {/* NÚT NỔI THÊM MỚI (FAB - Floating Action Button) */}
      <button
        onClick={() => setIsModalOpen(true)}
        title={lang === "VN" ? "Thêm Khách hàng mới" : "Add New Customer"}
        className="fixed bottom-10 right-8 md:bottom-12 md:right-12 w-16 h-16 bg-primary-container dark:bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      {/* MODAL: Form Thêm Khách hàng mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out] border border-transparent dark:border-slate-700">
            {/* Header Modal */}
            <div className="p-6 border-b border-outline-variant/20 dark:border-slate-700 flex justify-between items-center bg-surface-container-lowest dark:bg-slate-800">
              <h2 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">
                {lang === "VN" ? "Thêm Khách hàng Mới" : "Add New Customer"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Nội dung Form */}
            <form
              className="p-6 space-y-5"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="space-y-2">
                <label className="text-sm font-label font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest">
                  {lang === "VN" ? "Họ và Tên" : "Full Name"}
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant/30 dark:border-slate-600 focus:border-primary dark:focus:border-yellow-400 focus:ring-0 outline-none transition-all font-body text-slate-900 dark:text-white bg-surface-container-lowest dark:bg-slate-800"
                  placeholder={
                    lang === "VN" ? "Ví dụ: Nguyen Van A" : "e.g. John Doe"
                  }
                  type="text"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-label font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest">
                  {lang === "VN" ? "Số điện thoại" : "Phone Number"}
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant/30 dark:border-slate-600 focus:border-primary dark:focus:border-yellow-400 focus:ring-0 outline-none transition-all font-body text-slate-900 dark:text-white bg-surface-container-lowest dark:bg-slate-800"
                  placeholder="0123 456 789"
                  type="tel"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-label font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest">
                  Email
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant/30 dark:border-slate-600 focus:border-primary dark:focus:border-yellow-400 focus:ring-0 outline-none transition-all font-body text-slate-900 dark:text-white bg-surface-container-lowest dark:bg-slate-800"
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-label font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest">
                  {lang === "VN" ? "Phân loại" : "Role/Category"}
                </label>
                <select className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant/30 dark:border-slate-600 focus:border-primary dark:focus:border-yellow-400 focus:ring-0 outline-none transition-all font-body text-slate-900 dark:text-white bg-surface-container-lowest dark:bg-slate-800 cursor-pointer">
                  <option>
                    {lang === "VN" ? "Khách hàng mới" : "New Customer"}
                  </option>
                  <option>
                    {lang === "VN" ? "Khách hàng thân thiết" : "Loyal Customer"}
                  </option>
                  <option>
                    {lang === "VN" ? "Khách hàng VIP" : "VIP Customer"}
                  </option>
                </select>
              </div>

              {/* Nhóm Nút Lưu / Huỷ */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                  className="flex-1 px-6 py-4 rounded-xl border-2 border-outline-variant dark:border-slate-600 text-slate-700 dark:text-white font-label font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors uppercase tracking-widest text-xs"
                >
                  {lang === "VN" ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 rounded-xl bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 font-label font-bold hover:brightness-110 transition-all shadow-md uppercase tracking-widest text-xs"
                >
                  {lang === "VN" ? "Lưu thông tin" : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
