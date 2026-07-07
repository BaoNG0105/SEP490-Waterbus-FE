/** Official PayOS brand green — from payos.vn/docs/img/logo.svg */
export const PAYOS_BRAND = {
  green: "#00a85e",
  greenHover: "#008f4f",
  greenLight: "#e8f8f0",
};

export const payosButtonClassName =
  "inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#00a85e] px-5 py-3.5 text-xs font-headline font-black uppercase tracking-wider text-white shadow-lg shadow-[#00a85e]/25 transition hover:bg-[#008f4f] hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100";

export const payosButtonLgClassName =
  "inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#00a85e] px-6 py-4 text-sm font-headline font-black uppercase tracking-wider text-white shadow-lg shadow-[#00a85e]/25 transition hover:bg-[#008f4f] hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100";

export function PayOSLogo({ variant = "brand", className = "h-6 w-auto" }) {
  const isWhite = variant === "white";

  return (
    <img
      src="/payos-logo.svg"
      alt="PayOS"
      className={`shrink-0 object-contain ${className} ${isWhite ? "brightness-0 invert" : ""}`}
    />
  );
}
