import { useEffect, useMemo, useState } from "react";
import { fetchVietQrBanks, filterBanks, findBankByBin, formatBankLabel } from "../utils/vietQrBanks";

const BankLogo = ({ bank, className = "h-8 w-8" }) =>
  bank?.logo ? (
    <img src={bank.logo} alt="" className={`${className} rounded-lg bg-white object-contain`} />
  ) : (
    <span className={`${className} rounded-lg bg-slate-100 dark:bg-slate-800`} />
  );

export function BankBinSelect({
  value = "",
  onChange,
  lang = "VN",
  disabled = false,
  label,
  searchInputClassName = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  fallbackInputClassName = "mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white",
}) {
  const [banks, setBanks] = useState([]);
  const [bankQuery, setBankQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

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
  const filteredBanks = useMemo(() => filterBanks(banks, bankQuery), [bankQuery, banks]);

  useEffect(() => {
    if (!value || !selectedBank) return;
    setBankQuery(formatBankLabel(selectedBank));
  }, [selectedBank, value]);

  const handleSelectBank = (bank) => {
    onChange?.(String(bank.bin || ""), bank);
    setBankQuery(formatBankLabel(bank));
  };

  const handleSearchChange = (event) => {
    const nextQuery = event.target.value;
    setBankQuery(nextQuery);
    if (value) onChange?.("", null);
  };

  const handleFallbackBinChange = (event) => {
    onChange?.(event.target.value.replace(/\D/g, "").slice(0, 6), null);
  };

  return (
    <div>
      {label ? (
        <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {label}
        </label>
      ) : null}

      {!loadFailed && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">account_balance</span>
          <input
            value={bankQuery}
            onChange={handleSearchChange}
            disabled={disabled || isLoading}
            placeholder={
              isLoading
                ? (lang === "VN" ? "Đang tải ngân hàng..." : "Loading banks...")
                : (lang === "VN" ? "Tìm ngân hàng, ví dụ ACB / 970416" : "Search bank, e.g. ACB / 970416")
            }
            className={searchInputClassName}
          />
        </div>
      )}

      {selectedBank && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <BankLogo bank={selectedBank} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#124757] dark:text-yellow-400">
              {selectedBank.shortName || selectedBank.code || selectedBank.bin}
            </p>
            <p className="truncate text-xs font-bold text-slate-400">
              {selectedBank.name} / {selectedBank.bin}
            </p>
          </div>
        </div>
      )}

      {bankQuery && !value && banks.length > 0 && (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {filteredBanks.length > 0 ? filteredBanks.map((bank) => (
            <button
              key={bank.bin}
              type="button"
              disabled={disabled}
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
              {lang === "VN" ? "Không tìm thấy ngân hàng" : "No banks found"}
            </div>
          )}
        </div>
      )}

      {(loadFailed || banks.length === 0) && !isLoading && (
        <input
          value={value}
          onChange={handleFallbackBinChange}
          disabled={disabled}
          inputMode="numeric"
          maxLength={6}
          placeholder="970422"
          className={fallbackInputClassName}
        />
      )}
    </div>
  );
}
