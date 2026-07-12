/** Ship's wheel mark for the bow ("Mũi tàu") of seat maps. */
export function ShipWheelIcon({ className = "h-7 w-7" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="7.5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.4" />
      {/* Spokes */}
      <path d="M24 6v10M24 32v10M6 24h10M32 24h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.3 11.3l7.1 7.1M29.6 29.6l7.1 7.1M36.7 11.3l-7.1 7.1M18.4 29.6l-7.1 7.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* Rim handles */}
      <circle cx="24" cy="6" r="2.2" fill="currentColor" />
      <circle cx="24" cy="42" r="2.2" fill="currentColor" />
      <circle cx="6" cy="24" r="2.2" fill="currentColor" />
      <circle cx="42" cy="24" r="2.2" fill="currentColor" />
      <circle cx="11.3" cy="11.3" r="2.2" fill="currentColor" />
      <circle cx="36.7" cy="11.3" r="2.2" fill="currentColor" />
      <circle cx="11.3" cy="36.7" r="2.2" fill="currentColor" />
      <circle cx="36.7" cy="36.7" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function BoatBowLabel({ lang = "VN", className = "" }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 opacity-80 ${className}`}>
      <ShipWheelIcon className="h-6 w-6 text-[#124757] dark:text-yellow-400" />
      <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#124757] dark:text-yellow-400">
        {lang === "VN" ? "Mũi tàu" : "Bow"}
      </span>
    </div>
  );
}
