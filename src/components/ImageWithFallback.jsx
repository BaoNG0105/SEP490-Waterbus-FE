import { useState } from "react";
import { NullImageIcon } from "./NullImageIcon";

/**
 * Image container: renders `src` when it's set and loads successfully,
 * otherwise falls back to a NullImageIcon placeholder instead of a hardcoded default image.
 * `className` sizes/styles the outer box (e.g. "w-full h-full aspect-3/4 overflow-hidden").
 */
export function ImageWithFallback({
  src,
  alt = "",
  className = "",
  imgClassName = "w-full h-full object-cover",
  iconClassName = "",
}) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!src && !imgError;

  return (
    <div
      className={`flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600 ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={imgClassName}
          onError={() => setImgError(true)}
        />
      ) : (
        <NullImageIcon className={iconClassName || "w-1/3 h-1/3"} />
      )}
    </div>
  );
}
