const VIETQR_BANKS_URL = "https://api.vietqr.io/v2/banks";

let banksCache = null;
let banksPromise = null;

const normalizeBank = (bank) => ({
  id: bank?.id ?? null,
  bin: String(bank?.bin || ""),
  code: bank?.code || "",
  name: bank?.name || "",
  shortName: bank?.shortName || "",
  logo: bank?.logo || "",
  transferSupported: Boolean(bank?.transferSupported),
  lookupSupported: Boolean(bank?.lookupSupported),
});

export const fetchVietQrBanks = async () => {
  if (banksCache) return banksCache;

  if (!banksPromise) {
    banksPromise = fetch(VIETQR_BANKS_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load VietQR banks.");
        const result = await response.json();
        const bankList = Array.isArray(result?.data) ? result.data : [];
        banksCache = bankList
          .map(normalizeBank)
          .filter((bank) => bank.bin)
          .sort((first, second) =>
            String(first.shortName || first.name).localeCompare(String(second.shortName || second.name))
          );
        return banksCache;
      })
      .catch((error) => {
        banksPromise = null;
        throw error;
      });
  }

  return banksPromise;
};

export const findBankByBin = (banks, bankBin) =>
  banks.find((bank) => String(bank.bin) === String(bankBin || ""));

export const formatBankLabel = (bank) => {
  if (!bank) return "";
  return `${bank.shortName || bank.code || bank.bin} - ${bank.name || bank.bin}`;
};

export const filterBanks = (banks, query, limit = 12) => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  return banks
    .filter((bank) => {
      const haystack = `${bank.bin} ${bank.code} ${bank.shortName} ${bank.name}`.toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
};
