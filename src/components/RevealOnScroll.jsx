import { useEffect, useRef, useState } from "react";

/**
 * Bọc nội dung để tạo hiệu ứng "hiện dần" (opacity + trượt lên nhẹ) mỗi khi phần tử
 * cuộn vào trong viewport — tự phát lại mỗi lần cuộn tới (không chỉ chạy một lần duy
 * nhất). Dùng `delayMs` để so le hiệu ứng cho nhiều thẻ cạnh nhau, ví dụ 0/150/300ms.
 */
export function RevealOnScroll({ children, className = "", delayMs = 0, threshold = 0.2 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
