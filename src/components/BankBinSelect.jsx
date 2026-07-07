import { useEffect, useMemo, useState } from "react";
import { fetchVietQrBanks, filterBanks, findBankByBin, formatBankLabel } from "../utils/vietQrBanks";

const BankLogo = ({ bank, className = "h-8 w-8" }) =>
  bank?.logo ? (
    <img src={bank.logo} alt="" className={`${className} rounded-lg bg-white object-contain`} />
  ) : (
    <span className={`${className} rounded-lg bg-slate-100 dark:bg-slate-800`} />
  );

const isBinQuery = (query) => /^\d{1,6}$/.test(String(query || "").trim());

export function BankBinSelect({
  value = "",
  onChange,
  lang = "VN",
  disabled = false,
  label,
  searchInputClassName = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  fallbackInputClassName = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white",
}) {
  const [banks, setBanks] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBanks = async () => {
      try {
        setIsLoading(true);
        setLoadFailed(false);
        const bankList = await fetchVietQrBanks();
        if (!isMounted) return;
        setBanks(bankList);
      } catch {
        if (!isMounted) return;
        setBanks([]);
        setLoadFailed(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadBanks();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedBank = useMemo(() => findBankByBin(banks, value), [banks, value]);
  const displayBanks = useMemo(() => {
    const trimmed = query.trim();
    return filterBanks(banks, query, trimmed ? 12 : 80);
  }, [banks, query]);
  const exactBinMatch = useMemo(() => {
    if (!/^\d{6}$/.test(value)) return null;
    return findBankByBin(banks, value);
  }, [banks, value]);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    const matched = findBankByBin(banks, value);
    if (matched) {
      setQuery(formatBankLabel(matched));
    } else if (/^\d{6}$/.test(value)) {
      setQuery(value);
    }
  }, [banks, value]);

  const applyBankBin = (bankBin, bank = null) => {
    const normalizedBin = String(bankBin || "").replace(/\D/g, "").slice(0, 6);
    const matchedBank = bank || findBankByBin(banks, normalizedBin);
    onChange?.(normalizedBin, matchedBank || null);
    if (matchedBank) {
      setQuery(formatBankLabel(matchedBank));
    } else {
      setQuery(normalizedBin);
    }
    setIsDropdownOpen(false);
  };

  const handleSelectBank = (bank) => {
    applyBankBin(bank.bin, bank);
  };

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsDropdownOpen(true);

    if (isBinQuery(nextQuery)) {
      const normalizedBin = nextQuery.replace(/\D/g, "").slice(0, 6);
      if (normalizedBin.length === 6) {
        const matchedBank = findBankByBin(banks, normalizedBin);
        applyBankBin(normalizedBin, matchedBank);
        return;
      }
      onChange?.("", null);
      return;
    }

    if (!nextQuery.trim()) {
      onChange?.("", null);
      return;
    }

    onChange?.("", null);
  };

  const handleToggleDropdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || isLoading) return;
    setIsDropdownOpen((open) => !open);
  };

  const handleFallbackBinChange = (event) => {
    const normalizedBin = event.target.value.replace(/\D/g, "").slice(0, 6);
    setQuery(normalizedBin);
    onChange?.(normalizedBin, null);
  };

  const showDropdown = isDropdownOpen && banks.length > 0 && !/^\d{6}$/.test(query.trim());

  const inputPlaceholder = isLoading
    ? (lang === "VN" ? "Đang tải ngân hàng..." : "Loading banks...")
    : (lang === "VN" ? "Tìm ngân hàng hoặc nhập BIN 6 số, ví dụ ACB / 970422" : "Search bank or enter 6-digit BIN, e.g. ACB / 970422");

  return (
    <div className="block w-full">
      {label ? (
        <label className="block">
          <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
            {label}
          </span>

          {!loadFailed ? (
            <div className="relative mt-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-lg text-slate-400">search</span>
              <input
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsDropdownOpen(false), 150);
                }}
                disabled={disabled || isLoading}
                placeholder={inputPlaceholder}
                className={searchInputClassName}
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleToggleDropdown}
                disabled={disabled || isLoading}
                aria-label={lang === "VN" ? "Mở danh sách ngân hàng" : "Open bank list"}
                aria-expanded={isDropdownOpen}
                className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-[#124757] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-yellow-400"
              >
                <span className={`material-symbols-outlined text-xl transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
            </div>
          ) : (
            <input
              value={query}
              onChange={handleFallbackBinChange}
              disabled={disabled}
              inputMode="numeric"
              maxLength={6}
              placeholder="970422"
              className={`mt-1 ${fallbackInputClassName}`}
            />
          )}
        </label>
      ) : (
        !loadFailed ? (
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-lg text-slate-400">search</span>
            <input
              value={query}
              onChange={handleQueryChange}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsDropdownOpen(false), 150);
              }}
              disabled={disabled || isLoading}
              placeholder={inputPlaceholder}
              className={searchInputClassName}
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleToggleDropdown}
              disabled={disabled || isLoading}
              aria-label={lang === "VN" ? "Mở danh sách ngân hàng" : "Open bank list"}
              aria-expanded={isDropdownOpen}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-[#124757] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-yellow-400"
            >
              <span className={`material-symbols-outlined text-xl transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}>
                expand_more
              </span>
            </button>
          </div>
        ) : (
          <input
            value={query}
            onChange={handleFallbackBinChange}
            disabled={disabled}
            inputMode="numeric"
            maxLength={6}
            placeholder="970422"
            className={fallbackInputClassName}
          />
        )
      )}

      {(selectedBank || exactBinMatch) && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <BankLogo bank={selectedBank || exactBinMatch} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[#124757] dark:text-yellow-400">
              {(selectedBank || exactBinMatch).shortName || (selectedBank || exactBinMatch).code || (selectedBank || exactBinMatch).bin}
            </p>
            <p className="truncate text-xs font-bold text-slate-400">
              {(selectedBank || exactBinMatch).name} / {(selectedBank || exactBinMatch).bin}
            </p>
          </div>
        </div>
      )}

      {value && /^\d{6}$/.test(value) && !selectedBank && !exactBinMatch && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === "VN"
            ? `Đã nhập BIN ${value}. Hệ thống chưa nhận diện được logo ngân hàng, nhưng vẫn có thể gửi hoàn nếu mã hợp lệ.`
            : `BIN ${value} entered. Bank logo not recognized, but refund can still be submitted if the code is valid.`}
        </div>
      )}

      {showDropdown && (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {!query.trim() && (
            <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400 dark:border-slate-700">
              {lang === "VN" ? "Chọn ngân hàng từ danh sách" : "Select a bank from the list"}
            </div>
          )}
          {displayBanks.length > 0 ? displayBanks.map((bank) => (
            <button
              key={bank.bin}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelectBank(bank)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <BankLogo bank={bank} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[#124757] dark:text-yellow-400">
                  {bank.shortName || bank.code || bank.bin}
                </span>
                <span className="block truncate text-xs font-bold text-slate-400">
                  {bank.name} / {bank.bin}
                </span>
              </span>
            </button>
          )) : (
            <div className="p-4 text-sm font-bold text-slate-400">
              {lang === "VN" ? "Không tìm thấy ngân hàng — thử nhập đủ 6 số BIN" : "No banks found — try entering the full 6-digit BIN"}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
