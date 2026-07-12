import { useMemo } from "react";
import countries from "i18n-iso-countries";
import viLocale from "i18n-iso-countries/langs/vi.json";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useApp } from "../context/AppContext";
import { FormSelect } from "./FormSelect";

countries.registerLocale(viLocale);
countries.registerLocale(enLocale);

/** Chuẩn hóa về tên tiếng Anh (gửi BE), khớp cả tên VI/EN đã lưu. */
export function toEnglishNationality(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const enCode = countries.getAlpha2Code(value, "en");
  if (enCode) return countries.getName(enCode, "en") || value;
  const viCode = countries.getAlpha2Code(value, "vi");
  if (viCode) return countries.getName(viCode, "en") || value;
  return value;
}

export function NationalitySelect({
  value,
  onChange,
  className = "",
  placeholder,
  required = false,
  disabled = false,
}) {
  const { lang } = useApp();

  const options = useMemo(() => {
    const locale = lang === "VN" ? "vi" : "en";
    const names = countries.getNames(locale, { select: "official" });
    return Object.keys(names)
      .map((code) => ({
        value: countries.getName(code, "en"),
        label: names[code],
      }))
      .filter((o) => o.value && o.label)
      .sort((a, b) => a.label.localeCompare(b.label, locale === "vi" ? "vi" : "en"));
  }, [lang]);

  const resolvedValue = useMemo(() => toEnglishNationality(value), [value]);

  return (
    <FormSelect
      value={resolvedValue}
      onChange={onChange}
      options={options}
      className={className}
      placeholder={placeholder || (lang === "VN" ? "Chọn quốc tịch" : "Select nationality")}
      searchPlaceholder={lang === "VN" ? "Gõ để tìm quốc gia..." : "Type to search country..."}
      searchable
      emptyLabel={lang === "VN" ? "Không tìm thấy" : "No results"}
      required={required}
      disabled={disabled}
    />
  );
}
