import { useState } from "react";
import { getApiErrorMessage } from "../utils/apiError";

// Chỉ để lại các export component ở file này — react-refresh/only-export-components (Fast
// Refresh chỉ hoạt động khi 1 file chỉ export component). Hằng số/hàm dùng chung nằm ở
// services/reviewService.js (normalizeReviewableTrip) — import từ đó, không phải từ đây.
const REVIEW_COMMENT_MAX_LENGTH = 1000;

/** Sao hiển thị (đọc) — dùng cho đánh giá đã gửi. */
export const StarRatingDisplay = ({ rating, size = "text-lg" }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating}/5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        className={`material-symbols-outlined ${size} ${star <= rating ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
        style={star <= rating ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        star
      </span>
    ))}
  </div>
);

/** Sao chọn (ghi) — dùng trong modal gửi đánh giá. */
export const StarRatingInput = ({ value, onChange, lang }) => {
  const [hoverValue, setHoverValue] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={lang === "VN" ? "Chọn số sao" : "Select rating"}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hoverValue || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            className="p-0.5"
            aria-label={`${star} ${lang === "VN" ? "sao" : "star(s)"}`}
          >
            <span
              className={`material-symbols-outlined text-3xl ${filled ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
              style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** Modal gửi đánh giá 1 booking đã hoàn thành dịch vụ (POST /reviews/bookings/{bookingId}). */
export function TripReviewModal({ lang, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async () => {
    if (rating < 1) {
      setFormError(lang === "VN" ? "Vui lòng chọn số sao đánh giá." : "Please select a star rating.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      await onSubmitted(rating, comment.trim());
    } catch (error) {
      setFormError(getApiErrorMessage(error, lang === "VN" ? "Không thể gửi đánh giá." : "Unable to submit review."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
      onKeyDown={(e) => { if (e.key === "Escape" && !submitting) onClose(); }}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={lang === "VN" ? "Đánh giá chuyến" : "Review trip"}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-base font-black text-[#124757] dark:text-white">
            {lang === "VN" ? "Đánh giá chuyến" : "Review trip"}
          </h3>
          <button type="button" onClick={() => !submitting && onClose()} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              {lang === "VN" ? "Chất lượng chuyến đi" : "Trip quality"}
            </p>
            <StarRatingInput value={rating} onChange={setRating} lang={lang} />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              {lang === "VN" ? "Nhận xét (không bắt buộc)" : "Comment (optional)"}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, REVIEW_COMMENT_MAX_LENGTH))}
              rows={4}
              maxLength={REVIEW_COMMENT_MAX_LENGTH}
              placeholder={lang === "VN" ? "Chuyến đi rất tuyệt, tàu sạch và đúng giờ." : "The trip was great, the boat was clean and on time."}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#124757]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <p className="mt-1 text-right text-[10px] font-bold text-slate-400">
              {comment.length}/{REVIEW_COMMENT_MAX_LENGTH}
            </p>
          </div>

          {formError ? (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{formError}</p>
          ) : null}

          <button
            type="button"
            disabled={submitting || rating < 1}
            onClick={handleSubmit}
            className="w-full rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? (lang === "VN" ? "Đang gửi..." : "Submitting...")
              : (lang === "VN" ? "Gửi đánh giá" : "Submit review")}
          </button>
        </div>
      </div>
    </div>
  );
}
