/** Official PayOS brand green — from payos.vn/docs/img/logo.svg */
export const PAYOS_BRAND = {
  green: "#00a85e",
  greenHover: "#008f4f",
  greenLight: "#e8f8f0",
};

/* Nút thanh toán dùng màu vàng brand (#FFD100) + chữ tối cho dễ đọc. */
export const payosButtonClassName =
  "inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#FFD100] px-5 py-3.5 text-xs font-headline font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-[#FFD100]/30 transition hover:bg-[#f5c400] hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100";

export const payosButtonLgClassName =
  "inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FFD100] px-6 py-4 text-sm font-headline font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-[#FFD100]/30 transition hover:bg-[#f5c400] hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100";

export function PayOSLogo({ variant = "brand", className = "h-6 w-auto" }) {
  // "white" trước đây dùng cho nền xanh; nền vàng cần logo tối để tương phản.
  const isOnButton = variant === "white";

  return (
    <img
      src="/payos-logo.svg"
      alt="PayOS"
      className={`shrink-0 object-contain ${className} ${isOnButton ? "brightness-0" : ""}`}
    />
  );
}
