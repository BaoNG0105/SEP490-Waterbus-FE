import { useState } from "react";
import { UserIcon } from "./UserIcon";

/**
 * Avatar container: renders the user's image when avatarUrl is set, otherwise
 * falls back to a generated UserIcon placeholder instead of a hardcoded default image.
 * `className` sizes/styles the outer box (e.g. "w-10 h-10 rounded-full overflow-hidden").
 */
export function UserAvatar({ avatarUrl, alt = "", className = "", iconClassName = "" }) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!avatarUrl && !imgError;

  return (
    <div
      className={`flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 ${className}`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <UserIcon className={iconClassName || "w-3/5 h-3/5"} />
      )}
    </div>
  );
}
