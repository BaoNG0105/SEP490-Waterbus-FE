/**
 * Top-down seat icon — solid filled armchair, brand-aligned colors.
 */
const TONE = {
  standard: {
    body: "#E8F4F7",
    stroke: "#124757",
    accent: "#124757",
    text: "#124757",
  },
  cabin: {
    body: "#F3E8FF",
    stroke: "#7C3AED",
    accent: "#7C3AED",
    text: "#6D28D9",
  },
  river: {
    body: "#FFF7ED",
    stroke: "#EA580C",
    accent: "#EA580C",
    text: "#C2410C",
  },
  sky: {
    body: "#E0F2FE",
    stroke: "#0369A1",
    accent: "#0369A1",
    text: "#0369A1",
  },
  selected: {
    body: "#FFD100",
    stroke: "#124757",
    accent: "#124757",
    text: "#124757",
  },
  /** Ops: khách xuống bến */
  alighting: {
    body: "#FEF3C7",
    stroke: "#D97706",
    accent: "#D97706",
    text: "#92400E",
  },
  /** Ops: khách mới lên */
  boarding: {
    body: "#D1FAE5",
    stroke: "#059669",
    accent: "#059669",
    text: "#065F46",
  },
  /** Ops: đi tiếp (không xuống nhầm) */
  through: {
    body: "#E0F2FE",
    stroke: "#0284C7",
    accent: "#0284C7",
    text: "#075985",
  },
  /** Ops: đang có khách / đã đặt */
  occupied: {
    body: "#E2E8F0",
    stroke: "#334155",
    accent: "#334155",
    text: "#0F172A",
  },
  disabled: {
    body: "#F1F5F9",
    stroke: "#CBD5E1",
    accent: "#94A3B8",
    text: "#94A3B8",
  },
};

export function resolveSeatTypeCode(source) {
  if (!source) return "";
  if (typeof source === "string") return source;
  return (
    source.seatTypeCode
    || source.seatType?.seatTypeCode
    || source.seatType?.code
    || source.seat?.seatType?.seatTypeCode
    || source.seat?.seatType?.code
    || source.code
    || ""
  );
}

export function seatToneFromCode(seatTypeCode) {
  const code = String(resolveSeatTypeCode(seatTypeCode) || seatTypeCode || "").toUpperCase();
  if (code === "CABIN" || code.includes("CABIN")) return "cabin";
  if (code === "RIVER" || code.includes("RIVER")) return "river";
  if (code === "SKY" || code.includes("SKY") || code.includes("VIP")) return "sky";
  if (code === "STANDARD" || code.includes("STANDARD") || code.includes("STD")) return "standard";
  return "standard";
}

/** Tone cho sơ đồ vận hành theo bến (lên / xuống / đi tiếp). */
export function seatToneFromOccupancyRole(role) {
  const key = String(role || "").toLowerCase();
  if (key === "alighting") return "alighting";
  if (key === "boarding") return "boarding";
  if (key === "through") return "through";
  if (key === "occupied") return "occupied";
  if (key === "blocked") return "disabled";
  return "standard";
}

function labelFontSize(text) {
  const len = String(text || "").length;
  if (len <= 2) return 11;
  if (len <= 4) return 9;
  if (len <= 5) return 8;
  return 6.5;
}

export function SeatMapIcon({
  label = "",
  tone = "standard",
  disabled = false,
  selected = false,
  className = "",
  showLabel = true,
}) {
  const palette = disabled
    ? TONE.disabled
    : selected
      ? TONE.selected
      : TONE[tone] || TONE.standard;

  const display = disabled ? "✕" : showLabel ? label : "";
  const fontSize = disabled ? 13 : labelFontSize(display);

  return (
    <svg
      viewBox="0 0 56 64"
      className={`block w-full h-full drop-shadow-sm ${className}`}
      aria-hidden={display ? undefined : true}
      role={display ? "img" : "presentation"}
    >
      {display ? <title>{String(display)}</title> : null}

      {/* Soft seat cushion shadow */}
      <ellipse cx="28" cy="58" rx="16" ry="2.5" fill="rgba(15, 23, 42, 0.08)" />

      {/* Left armrest */}
      <rect x="4" y="22" width="10" height="28" rx="5" fill={palette.body} stroke={palette.stroke} strokeWidth="2" />
      {/* Right armrest */}
      <rect x="42" y="22" width="10" height="28" rx="5" fill={palette.body} stroke={palette.stroke} strokeWidth="2" />

      {/* Main back + cushion (drawn after arms so it sits cleanly on top) */}
      <rect x="12" y="6" width="32" height="36" rx="8" fill={palette.body} stroke={palette.stroke} strokeWidth="2" />

      {/* Inner cushion inset */}
      <rect x="16" y="12" width="24" height="24" rx="6" fill="rgba(255,255,255,0.45)" stroke={palette.accent} strokeWidth="1.25" strokeOpacity="0.35" />

      {/* Front seat base bar */}
      <rect x="14" y="46" width="28" height="8" rx="4" fill={palette.body} stroke={palette.stroke} strokeWidth="2" />

      {/* Small headrest tip */}
      <rect x="20" y="3" width="16" height="6" rx="3" fill={palette.accent} opacity="0.85" />

      {display ? (
        <text
          x="28"
          y="25"
          textAnchor="middle"
          dominantBaseline="central"
          fill={palette.text}
          fontSize={fontSize}
          fontWeight="800"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="-0.02em"
        >
          {display}
        </text>
      ) : null}
    </svg>
  );
}
