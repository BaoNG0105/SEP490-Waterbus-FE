import { useMemo } from "react";
import "flag-icons/css/flag-icons.min.css";
import { useApp } from "../context/AppContext";
import { FormSelect } from "./FormSelect";
import { countries, toEnglishNationality } from "../utils/nationality";

const FlagIcon = ({ code }) => (
  <span
    className={`fi fi-${String(code || "").toLowerCase()} block! h-3.5 w-5 shrink-0 rounded-xs shadow-sm`}
    aria-hidden="true"
  />
);

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
      .map((code) => {
        const enName = countries.getName(code, "en");
        return {
          value: enName,
          label: names[code],
          searchText: `${names[code]} ${enName || ""} ${code}`,
          icon: <FlagIcon code={code} />,
        };
      })
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
