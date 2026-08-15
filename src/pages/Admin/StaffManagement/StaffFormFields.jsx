import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { NationalitySelect } from "../../../components/NationalitySelect";

const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
const selectStyle = `${inputStyle} cursor-pointer`;
const readOnlyStyle = "w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 shadow-inner opacity-70 cursor-not-allowed";

/**
 * Khối field dùng chung cho CreateStaff / EditStaff.
 * Bố cục: "Thông tin cá nhân" cạnh "Thông tin liên hệ & Vai trò" trên cùng 1 hàng.
 * Phần gắn bến làm việc khác nhau khá nhiều giữa 2 trang (admin picker / manager radio /
 * read-only) nên truyền vào qua `stationAssignSlot` thay vì cố dùng chung.
 */
export function StaffFormFields({
  lang,
  formData,
  onChange,
  roleLabel,
  staffTypeLabel,
  showStationAssign = false,
  stationAssignLabel,
  stationAssignSlot,
  namePlaceholder = "",
  phonePlaceholder = "",
  emailPlaceholder = "",
}) {
  const setField = (field, value) => onChange(field, value);

  const genderOptions = [
    { value: "Male", label: lang === "VN" ? "Nam" : "Male" },
    { value: "Female", label: lang === "VN" ? "Nữ" : "Female" },
    { value: "Other", label: lang === "VN" ? "Khác" : "Other" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Thông tin cá nhân" : "Personal Information"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Họ và Tên (*)" : "Full Name (*)"}</label>
            <input
              type="text"
              required
              placeholder={namePlaceholder}
              value={formData.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
            <AppDateInput value={formData.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} className={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
            <FormSelect
              value={formData.gender}
              onChange={(v) => setField("gender", v)}
              options={genderOptions}
              className={selectStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
            <NationalitySelect
              value={formData.nationality}
              onChange={(v) => setField("nationality", v)}
              className={selectStyle}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Thông tin liên hệ & Vai trò" : "Contact & Role"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Số điện thoại (*)" : "Phone Number (*)"}</label>
            <input
              type="tel"
              required
              placeholder={phonePlaceholder}
              value={formData.phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>Email (*)</label>
            <input
              type="email"
              required
              placeholder={emailPlaceholder}
              value={formData.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Vai trò được gán" : "Assigned Role"}</label>
          <div className={`${readOnlyStyle} flex items-center`}>
            {roleLabel}
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Loại nhân viên" : "Staff type"}</label>
          <div className={`${readOnlyStyle} flex items-center`}>
            {staffTypeLabel}
          </div>
        </div>

        {showStationAssign && (
          <div>
            <label className={labelStyle}>{stationAssignLabel}</label>
            {stationAssignSlot}
          </div>
        )}
      </div>
    </div>
  );
}