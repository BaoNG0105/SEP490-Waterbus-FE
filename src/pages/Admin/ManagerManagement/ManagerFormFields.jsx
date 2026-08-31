import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { NationalitySelect } from "../../../components/NationalitySelect";
import { StationAssignField } from "../../../components/StationAssignField";
import { getTodayDateString } from "../../../utils/dateOnly";
import { sanitizeFullName } from "../../../utils/formValidation";
import { required } from "../../../utils/requiredStar";

const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
const errorInputStyle = "w-full !bg-rose-50/50 dark:!bg-rose-500/10 !border !border-rose-500 dark:!border-rose-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:!ring-rose-500 shadow-inner transition-all";
const selectStyle = `${inputStyle} cursor-pointer`;
const errorTextStyle = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

/**
 * Khối field dùng chung cho CreateManager / EditManager.
 * Bố cục: "Thông tin cá nhân" (gồm cả SĐT/Email) cạnh "Khu vực phụ trách" trên cùng 1 hàng.
 * Vai trò được gán không hiện trên UI (đã cố định là Manager, không cần chọn/hiển thị).
 *
 * `errors`: { [field]: message } — chỉ hiện khi field tương ứng đã "touched" (do trang cha
 * quyết định khi nào đưa message vào, thường là sau onBlur hoặc sau lần submit đầu tiên).
 * `onFieldBlur`: (field) => void — báo trang cha field vừa rời khỏi để trang cha tự quyết định
 * có bắt đầu hiện lỗi cho field đó hay không.
 */
export function ManagerFormFields({
  lang,
  formData,
  onChange,
  errors = {},
  onFieldBlur,
  namePlaceholder = "",
  phonePlaceholder = "",
  emailPlaceholder = "",
}) {
  const setField = (field, value) => onChange(field, value);
  const handleBlur = (field) => onFieldBlur?.(field);

  const genderOptions = [
    { value: "Male", label: lang === "VN" ? "Nam" : "Male" },
    { value: "Female", label: lang === "VN" ? "Nữ" : "Female" },
    { value: "Other", label: lang === "VN" ? "Khác" : "Other" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      <div className="h-full bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Thông tin cá nhân" : "Personal Information"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{<>{lang === "VN" ? "Họ và Tên" : "Full Name"}{required()}</>}</label>
            <input
              type="text"
              required
              placeholder={namePlaceholder}
              value={formData.fullName}
              onChange={(e) => setField("fullName", sanitizeFullName(e.target.value))}
              onBlur={() => handleBlur("fullName")}
              className={errors.fullName ? errorInputStyle : inputStyle}
            />
            {errors.fullName && <p className={errorTextStyle}>{errors.fullName}</p>}
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
            <AppDateInput value={formData.dateOfBirth} max={getTodayDateString()} onChange={(e) => setField("dateOfBirth", e.target.value)} className={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{<>{lang === "VN" ? "Số điện thoại" : "Phone Number"}{required()}</>}</label>
            <input
              type="tel"
              required
              placeholder={phonePlaceholder}
              value={formData.phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              onBlur={() => handleBlur("phoneNumber")}
              className={errors.phoneNumber ? errorInputStyle : inputStyle}
            />
            {errors.phoneNumber && <p className={errorTextStyle}>{errors.phoneNumber}</p>}
          </div>
          <div>
            <label className={labelStyle}>Email{required()}</label>
            <input
              type="email"
              required
              placeholder={emailPlaceholder}
              value={formData.email}
              onChange={(e) => setField("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              className={errors.email ? errorInputStyle : inputStyle}
            />
            {errors.email && <p className={errorTextStyle}>{errors.email}</p>}
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

      <div className="h-full bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {<>{lang === "VN" ? "Khu vực phụ trách" : "Assigned Stations"}{required()}</>}
        </h3>

        <StationAssignField
          value={formData.stationIds}
          onChange={(ids) => {
            setField("stationIds", ids);
            handleBlur("stationIds");
          }}
          hasError={Boolean(errors.stationIds)}
        />
        {errors.stationIds && <p className={errorTextStyle}>{errors.stationIds}</p>}
      </div>
    </div>
  );
}
