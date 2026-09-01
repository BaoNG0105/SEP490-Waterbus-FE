import {
  MAX_CODE,
  MAX_NAME,
  MAX_PROVIDER_NAME,
  MAX_URL,
  MAX_CONDITIONS,
  MAX_CONDITION_TEXT,
  MIN_PREMIUM,
  MAX_LOGO_SIZE,
  labelStyle,
  inputStyle,
  formatVndInput,
  sanitizeInsuranceName,
} from "../../../utils/insurancePackageForm";
import { required } from "../../../utils/requiredStar";

/**
 * Wrapper dùng chung cho các field trong form tạo/sửa gói bảo hiểm:
 * label + input (children) + hint (lỗi/cảnh báo, thường lấy từ renderHint(field)).
 */
function InsuranceFormField({ label, hint, className = "", children }) {
  return (
    <div className={className}>
      <label className={labelStyle}>{label}</label>
      {children}
      {hint}
    </div>
  );
}

/**
 * Modal tạo/sửa gói bảo hiểm — dùng chung 1 form cho cả 2 thao tác (editingId
 * quyết định title/nút submit và field "code" có readOnly hay không).
 */
export function InsuranceFormModal({
  lang,
  form,
  editingId,
  isSaving,
  hasBlockingError,
  waterbusDefaultConflict,
  renderHint,
  inputClass,
  updateField,
  handleBlur,
  handleLogoChange,
  removeLogo,
  updateCondition,
  addCondition,
  removeCondition,
  closeModal,
  handleSave,
  openEditModal,
}) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
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

        <div className="p-6 space-y-5">
          {/* Row 1: Mã gói + Tên gói */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InsuranceFormField label={<>{lang === "VN" ? "Mã gói" : "Code"}{required()}</>} hint={renderHint("code")}>
              <input
                value={form.code}
                onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("code")}
                readOnly={!!editingId}
                className={inputClass("code") + " uppercase tracking-wider" + (editingId ? " bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed text-slate-500" : "")}
                placeholder="CODE"
                maxLength={MAX_CODE}
                spellCheck={false}
                autoCapitalize="characters"
                title={editingId ? (lang === "VN" ? "Mã gói không thể thay đổi sau khi tạo." : "Code is read-only after creation.") : undefined}
              />
            </InsuranceFormField>
            <InsuranceFormField label={<>{lang === "VN" ? "Tên gói" : "Name"}{required()}</>} hint={renderHint("name")} className="sm:col-span-2">
              <input
                value={form.name}
                onChange={(e) => updateField("name", sanitizeInsuranceName(e.target.value))}
                onBlur={() => handleBlur("name")}
                className={inputClass("name")}
                placeholder={lang === "VN" ? "Tên bảo hiểm" : "Insurance name"}
                maxLength={MAX_NAME}
              />
            </InsuranceFormField>
          </div>

          {/* Row 2: Phí + Mức bồi thường */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InsuranceFormField label={<>{lang === "VN" ? "Phí mỗi khách (VND)" : "Fee per passenger (VND)"}{required()}</>} hint={renderHint("unitPremiumAmount")}>
              <input
                inputMode="numeric"
                value={form.unitPremiumAmount}
                onChange={(e) => updateField("unitPremiumAmount", formatVndInput(e.target.value))}
                onBlur={() => handleBlur("unitPremiumAmount")}
                className={inputClass("unitPremiumAmount")}
                placeholder={lang === "VN" ? `Tối thiểu ${MIN_PREMIUM.toLocaleString("vi-VN")}` : `Min ${MIN_PREMIUM.toLocaleString("vi-VN")}`}
              />
            </InsuranceFormField>
            <InsuranceFormField label={<>{lang === "VN" ? "Mức bồi thường (VND)" : "Coverage amount (VND)"}{required()}</>} hint={renderHint("coverageAmount")}>
              <input
                inputMode="numeric"
                value={form.coverageAmount}
                onChange={(e) => updateField("coverageAmount", formatVndInput(e.target.value))}
                onBlur={() => handleBlur("coverageAmount")}
                className={inputClass("coverageAmount")}
                placeholder={lang === "VN" ? `Tối thiểu ${MIN_PREMIUM.toLocaleString("vi-VN")}` : `Min ${MIN_PREMIUM.toLocaleString("vi-VN")}`}
              />
            </InsuranceFormField>
          </div>

          {/* Row 3: Trạng thái */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {lang === "VN" ? "Trạng thái" : "Status"}
            </label>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-headline font-black uppercase tracking-wider ${form.status === "Active" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {form.status === "Active" ? (lang === "VN" ? "Bật" : "Active") : (lang === "VN" ? "Tắt" : "Inactive")}
              </span>
              <button
                type="button"
                onClick={() => updateField("status", form.status === "Active" ? "Inactive" : "Active")}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${form.status === "Active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${form.status === "Active" ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Section: Nhà cung cấp + Logo */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-700/70 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === "VN" ? "Nhà cung cấp bảo hiểm" : "Insurance provider"}
              </span>
            </div>

            {/* Nguồn nhà cung cấp */}
            <InsuranceFormField
              label={lang === "VN" ? "Nguồn cung cấp" : "Provider source"}
              hint={waterbusDefaultConflict?.hasActiveWaterbusDefault && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-base shrink-0">warning</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-snug">
                        {lang === "VN"
                          ? `Trùng ${waterbusDefaultConflict.duplicates?.length || 1} gói mặc định đang bật. Vui lòng tắt gói bên dưới trước khi lưu.`
                          : `${waterbusDefaultConflict.duplicates?.length || 1} active default package(s) conflict. Disable the package below before saving.`}
                      </p>
                      {waterbusDefaultConflict.duplicates && waterbusDefaultConflict.duplicates.length > 0 && (
                        <ul className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          {waterbusDefaultConflict.duplicates.map((pkg) => (
                            <li key={pkg.id ?? pkg.insurancePackageId} className="truncate">
                              <span className="font-mono">{pkg.code}</span>{pkg.name ? ` - ${pkg.name}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          closeModal();
                          if (waterbusDefaultConflict.existingPackage?.id) {
                            setTimeout(() => openEditModal(waterbusDefaultConflict.existingPackage), 100);
                          }
                        }}
                        className="mt-1 text-[10px] font-black text-[#124757] uppercase tracking-wide hover:underline dark:text-yellow-400"
                      >
                        {lang === "VN" ? "Mở gói cần tắt" : "Open package"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            >
              <div className="flex gap-2 mt-1">
                {[
                  { value: "waterbus", labelVn: "Hệ thống", labelEn: "System" },
                  { value: "third_party", labelVn: "Bảo hiểm ngoài", labelEn: "Third party" },
                ].map((opt) => {
                  const isActive = form.providerSource === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateField("providerSource", opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border-2 font-headline font-black text-[10px] uppercase tracking-wide transition-all ${isActive
                        ? "bg-[#124757] border-[#124757] text-white dark:bg-yellow-400 dark:border-yellow-400 dark:text-slate-900"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                      {lang === "VN" ? opt.labelVn : opt.labelEn}
                    </button>
                  );
                })}
              </div>
            </InsuranceFormField>

            <InsuranceFormField label={<>{lang === "VN" ? "Tên nhà cung cấp" : "Provider name"}{required()}</>} hint={renderHint("providerName")}>
              <input
                value={form.providerName}
                onChange={(e) => updateField("providerName", sanitizeInsuranceName(e.target.value))}
                onBlur={() => handleBlur("providerName")}
                className={inputClass("providerName")}
                maxLength={MAX_PROVIDER_NAME}
                placeholder={lang === "VN" ? "Tên nhà cung cấp" : "Provider name"}
              />
            </InsuranceFormField>

            <InsuranceFormField label={lang === "VN" ? "Logo nhà cung cấp" : "Provider logo"} hint={renderHint("providerLogoFile")}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="h-28 w-28 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden flex items-center justify-center transition-all hover:border-slate-300 dark:hover:border-slate-600">
                  {form.providerLogoPreview ? (
                    <img
                      src={form.providerLogoPreview}
                      alt="logo"
                      className="h-full w-full object-contain p-2"
                      onError={() => updateField("providerLogoPreview", "")}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                      <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider mt-1">No logo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600">
                      <span className="material-symbols-outlined text-base">upload</span>
                      {(() => {
                        if (!form.providerLogoPreview) return lang === "VN" ? "Tải ảnh lên" : "Upload";
                        return lang === "VN" ? "Đổi ảnh" : "Change";
                      })()}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>
                    {form.providerLogoPreview && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        {lang === "VN" ? "Xóa" : "Remove"}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    {lang === "VN"
                      ? `Định dạng JPG, PNG, WEBP hoặc SVG. Dung lượng tối đa ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB`
                      : `JPG, PNG, WEBP or SVG. Max ${Math.round(MAX_LOGO_SIZE / (1024 * 1024))}MB. Square image with transparent background recommended.`}
                  </span>
                </div>
              </div>
            </InsuranceFormField>
          </div>

          <InsuranceFormField label={lang === "VN" ? "Điều khoản (URL)" : "Terms (URL)"} hint={renderHint("termsUrl")}>
            <input
              value={form.termsUrl}
              onChange={(e) => updateField("termsUrl", e.target.value)}
              onBlur={() => handleBlur("termsUrl")}
              className={inputClass("termsUrl")}
              placeholder=" "
              maxLength={MAX_URL}
            />
          </InsuranceFormField>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                {lang === "VN" ? `Điều kiện áp dụng (${form.conditions.length}/${MAX_CONDITIONS})` : `Conditions (${form.conditions.length}/${MAX_CONDITIONS})`}
              </label>
              <button
                type="button"
                onClick={addCondition}
                disabled={form.conditions.length >= MAX_CONDITIONS}
                className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
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
                    onBlur={() => handleBlur("conditions")}
                    className={inputStyle}
                    placeholder={lang === "VN" ? "Nhập điều kiện áp dụng" : "Enter condition"}
                    maxLength={MAX_CONDITION_TEXT}
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
            {renderHint("conditions")}
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
            disabled={isSaving || hasBlockingError || !!waterbusDefaultConflict?.hasActiveWaterbusDefault}
            className="rounded-2xl bg-[#124757] px-6 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300 inline-flex items-center justify-center gap-2"
          >
            {isSaving && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {editingId ? (lang === "VN" ? "Lưu thay đổi" : "Save changes") : (lang === "VN" ? "Tạo gói" : "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
