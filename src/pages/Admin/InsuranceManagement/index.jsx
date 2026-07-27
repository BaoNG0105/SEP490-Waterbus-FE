import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  fetchInsurancePackages,
  addInsurancePackage,
  modifyInsurancePackage,
  changeInsurancePackageStatus,
  INSURANCE_BOOKING_TYPES,
} from "../../../services/insuranceService";
import { notify } from "../../../utils/swalToast";

const emptyForm = () => ({
  code: "",
  name: "",
  bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
  unitPremiumAmount: 0,
  coverageAmount: 0,
  isRequired: false,
  providerName: "",
  providerLogoUrl: "",
  conditions: [""],
  termsUrl: "",
  status: "Active",
  displayOrder: 1,
});

const formatVnd = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString("vi-VN") + "đ";
};

const isPackageActive = (pkg) => {
  if (typeof pkg?.status === "string") return pkg.status === "Active";
  return pkg?.isActive !== false;
};

export function InsuranceManagement() {
  const { lang } = useApp();
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";

  const loadPackages = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const params = {};
      if (statusFilter === "Active") params.activeOnly = true;
      const data = await fetchInsurancePackages(params);
      setPackages(data || []);
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Không tải được danh sách gói bảo hiểm." : "Failed to load insurance packages.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [statusFilter]);

  const filteredPackages = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return packages
      .filter((pkg) => {
        if (statusFilter === "Active" && !isPackageActive(pkg)) return false;
        if (statusFilter === "Inactive" && isPackageActive(pkg)) return false;
        if (!keyword) return true;
        return (
          pkg.name?.toLowerCase().includes(keyword) ||
          pkg.code?.toLowerCase().includes(keyword) ||
          pkg.providerName?.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
  }, [packages, search, statusFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (pkg) => {
    setEditingId(pkg.id);
    setForm({
      code: pkg.code || "",
      name: pkg.name || "",
      bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
      unitPremiumAmount: Number(pkg.unitPremiumAmount) || 0,
      coverageAmount: Number(pkg.coverageAmount) || 0,
      isRequired: Boolean(pkg.isRequired),
      providerName: pkg.providerName || "",
      providerLogoUrl: pkg.providerLogoUrl || "",
      conditions: Array.isArray(pkg.conditions) && pkg.conditions.length > 0 ? pkg.conditions : [""],
      termsUrl: pkg.termsUrl || "",
      status: isPackageActive(pkg) ? "Active" : "Inactive",
      displayOrder: Number(pkg.displayOrder) || 1,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingId(null);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCondition = (index, value) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? value : c)),
    }));
  };

  const addCondition = () => {
    setForm((prev) => ({ ...prev, conditions: [...prev.conditions, ""] }));
  };

  const removeCondition = (index) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.length <= 1
        ? [""]
        : prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!form.code.trim()) return lang === "VN" ? "Vui lòng nhập mã gói." : "Package code is required.";
    if (!form.name.trim()) return lang === "VN" ? "Vui lòng nhập tên gói." : "Package name is required.";
    if (Number(form.unitPremiumAmount) < 0) return lang === "VN" ? "Phí mỗi khách không hợp lệ." : "Invalid per-passenger premium.";
    if (Number(form.coverageAmount) < 0) return lang === "VN" ? "Mức bồi thường không hợp lệ." : "Invalid coverage.";
    return "";
  };

  const buildPayload = () => ({
    code: form.code.trim(),
    name: form.name.trim(),
    bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
    unitPremiumAmount: Number(form.unitPremiumAmount) || 0,
    coverageAmount: Number(form.coverageAmount) || 0,
    isRequired: false,
    providerName: form.providerName.trim() || null,
    providerLogoUrl: form.providerLogoUrl.trim() || null,
    conditions: form.conditions.map((c) => c.trim()).filter(Boolean),
    termsUrl: form.termsUrl.trim() || null,
    status: form.status,
    isActive: form.status === "Active",
    displayOrder: Number(form.displayOrder) || 1,
  });

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
        text: validationError,
        confirmButtonColor: "#124757",
      });
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildPayload();
      if (editingId) {
        await modifyInsurancePackage(editingId, payload);
      } else {
        await addInsurancePackage(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      await loadPackages();

      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: editingId
          ? (lang === "VN" ? "Đã cập nhật gói" : "Package updated")
          : (lang === "VN" ? "Đã tạo gói" : "Package created"),
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể lưu gói bảo hiểm." : "Could not save the package."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pkg) => {
    const currentlyActive = isPackageActive(pkg);
    const nextStatus = currentlyActive ? "Inactive" : "Active";
    const nextActive = nextStatus === "Active";
    setTogglingId(pkg.id);
    setPackages((prev) => prev.map((p) => (
      p.id === pkg.id ? { ...p, status: nextStatus, isActive: nextActive } : p
    )));

    try {
      await changeInsurancePackageStatus(pkg.id, nextStatus);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: nextActive
          ? (lang === "VN" ? "Đã bật gói" : "Package activated")
          : (lang === "VN" ? "Đã tắt gói" : "Package deactivated"),
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      setPackages((prev) => prev.map((p) => (
        p.id === pkg.id
          ? { ...p, status: currentlyActive ? "Active" : "Inactive", isActive: currentlyActive }
          : p
      )));
      notify({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái gói." : "Could not update package status."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const getBookingTypeLabel = (value) => {
    const type = String(value || "");
    if (type === INSURANCE_BOOKING_TYPES.PASSENGER || !type) {
      return lang === "VN" ? "Hành khách (chung)" : "Passenger (shared)";
    }
    if (type === INSURANCE_BOOKING_TYPES.SEAT) {
      return lang === "VN" ? "Vé lẻ (legacy)" : "Seat (legacy)";
    }
    if (type === INSURANCE_BOOKING_TYPES.CHARTER) {
      return lang === "VN" ? "Thuê tàu (legacy)" : "Charter (legacy)";
    }
    return type;
  };

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Quản lý gói bảo hiểm" : "Insurance Packages"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Gói PassengerInsurance dùng chung đặt vé / thuê tàu. Phí = đơn giá × số hành khách."
              : "Shared PassengerInsurance package for seat & charter. Fee = unit × passenger count."}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 px-5 py-3 text-[11px] font-headline font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-md shrink-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {lang === "VN" ? "Thêm gói" : "Add package"}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "VN" ? "Tìm theo tên, mã, nhà cung cấp..." : "Search by name, code, provider..."}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400"
          >
            <option value="all">{lang === "VN" ? "Trạng thái: Tất cả" : "Status: All"}</option>
            <option value="Active">{lang === "VN" ? "Đang bật" : "Active"}</option>
            <option value="Inactive">{lang === "VN" ? "Đang tắt" : "Inactive"}</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50">
          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">shield</span>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {lang === "VN" ? "Chưa có gói bảo hiểm nào." : "No insurance packages yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPackages.map((pkg) => {
            const active = isPackageActive(pkg);
            return (
              <div
                key={pkg.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                      pkg.providerLogoUrl
                        ? "bg-white dark:bg-white border border-slate-200 dark:border-slate-600 p-1.5"
                        : "bg-[#124757]/10 dark:bg-yellow-400/10"
                    }`}>
                      {pkg.providerLogoUrl ? (
                        <img src={pkg.providerLogoUrl} alt={pkg.providerName || pkg.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-xl text-[#124757] dark:text-yellow-400">shield</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline font-black text-sm text-slate-800 dark:text-white truncate">{pkg.name}</h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">{pkg.code}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                    active
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                      : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {active ? (lang === "VN" ? "Active" : "Active") : (lang === "VN" ? "Inactive" : "Inactive")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Phí / khách" : "Fee / passenger"}
                    </p>
                    <p className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400 mt-1">
                      {formatVnd(pkg.unitPremiumAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Mức bồi thường" : "Coverage"}
                    </p>
                    <p className="text-sm font-headline font-black text-slate-700 dark:text-slate-200 mt-1">
                      {formatVnd(pkg.coverageAmount)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 font-bold">
                    <span className="material-symbols-outlined text-[13px]">category</span>
                    {getBookingTypeLabel(pkg.bookingType)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 font-bold">
                    <span className="material-symbols-outlined text-[13px]">sort</span>
                    {lang === "VN" ? "Thứ tự" : "Order"}: {Number(pkg.displayOrder) || 0}
                  </span>
                  {pkg.providerName && (
                    <span className="inline-flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-[13px]">business</span>
                      {pkg.providerName}
                    </span>
                  )}
                </div>

                {Array.isArray(pkg.conditions) && pkg.conditions.length > 0 && (
                  <ul className="space-y-1 border-t border-slate-100 dark:border-slate-700 pt-3">
                    {pkg.conditions.slice(0, 2).map((condition) => (
                      <li key={condition} className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[13px] text-emerald-500 mt-0.5">check</span>
                        <span>{condition}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(pkg)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    {lang === "VN" ? "Sửa" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(pkg)}
                    disabled={togglingId === pkg.id}
                    className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                      active
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}
                  >
                    {togglingId === pkg.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-sm">{active ? "toggle_off" : "toggle_on"}</span>
                    )}
                    {active
                      ? (lang === "VN" ? "Tắt gói" : "Turn off")
                      : (lang === "VN" ? "Bật gói" : "Turn on")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={closeModal}
            disabled={isSaving}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 bg-white dark:bg-slate-800 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Gói bảo hiểm" : "Insurance package"}
                </p>
                <h3 className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                  {editingId ? (lang === "VN" ? "Sửa gói bảo hiểm" : "Edit package") : (lang === "VN" ? "Thêm gói bảo hiểm" : "Add package")}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Mã gói (*)" : "Code (*)"}</label>
                  <input value={form.code} onChange={(e) => updateField("code", e.target.value)} className={inputStyle} placeholder="PASSENGER_BASIC" />
                </div>
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Thứ tự hiển thị" : "Display order"}</label>
                  <input type="number" min={0} value={form.displayOrder} onChange={(e) => updateField("displayOrder", e.target.value)} className={inputStyle} />
                </div>
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Tên gói (*)" : "Name (*)"}</label>
                <input value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputStyle} placeholder={lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Phí mỗi khách (VND)" : "Fee per passenger (VND)"}</label>
                  <input type="number" min={0} value={form.unitPremiumAmount} onChange={(e) => updateField("unitPremiumAmount", e.target.value)} className={inputStyle} />
                </div>
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Mức bồi thường (VND)" : "Coverage amount (VND)"}</label>
                  <input type="number" min={0} value={form.coverageAmount} onChange={(e) => updateField("coverageAmount", e.target.value)} className={inputStyle} />
                </div>
              </div>

              <div>
                  <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                    {[
                      { value: "Active", labelVn: "Bật", labelEn: "Active" },
                      { value: "Inactive", labelVn: "Tắt", labelEn: "Inactive" },
                    ].map((option) => {
                      const selected = form.status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateField("status", option.value)}
                          className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${
                            selected
                              ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                              : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {lang === "VN" ? option.labelVn : option.labelEn}
                        </button>
                      );
                    })}
                  </div>
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Nhà cung cấp" : "Provider"}</label>
                <input value={form.providerName} onChange={(e) => updateField("providerName", e.target.value)} className={inputStyle} />
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Logo nhà cung cấp (URL)" : "Provider logo (URL)"}</label>
                <input value={form.providerLogoUrl} onChange={(e) => updateField("providerLogoUrl", e.target.value)} className={inputStyle} placeholder="https://..." />
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Điều khoản (URL)" : "Terms (URL)"}</label>
                <input value={form.termsUrl} onChange={(e) => updateField("termsUrl", e.target.value)} className={inputStyle} placeholder="https://...terms.pdf" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {lang === "VN" ? "Điều kiện áp dụng" : "Conditions"}
                  </label>
                  <button type="button" onClick={addCondition} className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">add</span>
                    {lang === "VN" ? "Thêm" : "Add"}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.conditions.map((condition, index) => (
                    <div key={`condition-${index}`} className="flex gap-2">
                      <input
                        value={condition}
                        onChange={(e) => updateCondition(index, e.target.value)}
                        className={inputStyle}
                        placeholder={lang === "VN" ? "VD: Chỉ áp dụng trong thời gian chuyến đi." : "e.g. Valid only during the trip."}
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="px-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 bg-white sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-2xl bg-[#124757] px-6 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300 inline-flex items-center justify-center gap-2"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {editingId ? (lang === "VN" ? "Lưu thay đổi" : "Save changes") : (lang === "VN" ? "Tạo gói" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
