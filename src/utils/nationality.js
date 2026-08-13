import countries from "i18n-iso-countries";
import viLocale from "i18n-iso-countries/langs/vi.json";
import enLocale from "i18n-iso-countries/langs/en.json";

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

export { countries };