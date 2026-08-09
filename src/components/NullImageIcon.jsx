/** Generic "no image" placeholder glyph used when image data has no URL. */
export function NullImageIcon({ className = "h-8 w-8" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.75" fill="currentColor" />
      <path
        d="M4 17.5l5.5-5.5a1.6 1.6 0 0 1 2.26 0L15 15.25M13.5 13.75l1.75-1.75a1.6 1.6 0 0 1 2.26 0L20.5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
