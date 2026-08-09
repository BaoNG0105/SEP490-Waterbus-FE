import { useEffect, useRef, useState } from "react";

// Các ảnh tàu dùng cho hiệu ứng — chọn qua prop `variant`, khỏi phải chép URL ở từng nơi gọi.
const BOAT_IMAGES = {
  default: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat.png",
  sightseeing: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat-sightseeing.png",
  top: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat-top.png",
};

// Tốc độ chạy chậm rãi — số giây để tàu lướt hết từ mép trái sang mép phải.
const BOAT_SAIL_DURATION_S = 12;

/**
 * Ảnh con tàu tự động lướt ngang mỗi khi section chứa nó xuất hiện trong viewport
 * (không phụ thuộc tốc độ cuộn — chạy bằng CSS transition với nhịp độ cố định, chậm
 * rãi). Mặc định chạy từ trái sang phải; đặt `reverse` để chạy ngược, phải sang trái.
 * Rời khỏi viewport thì tàu lặng lẽ về lại vị trí xuất phát để lần sau cuộn tới lại
 * chạy từ đầu.
 *
 * Section cha cần có class "relative overflow-hidden" để cắt phần tàu tràn ra ngoài.
 * Đặt <ScrollBoat /> làm con trực tiếp đầu tiên của section (component tự tìm section
 * cha gần nhất qua closest("section") để theo dõi bằng IntersectionObserver).
 *
 * `variant`: chọn ảnh tàu — "default" | "sightseeing" | "top" (xem BOAT_IMAGES).
 */
export function ScrollBoat({ variant = "default", className = "w-140 sm:w-180 md:w-220 lg:w-260", reverse = false }) {
  const src = BOAT_IMAGES[variant] || BOAT_IMAGES.default;
  const wrapperRef = useRef(null);
  // Trái sang phải: -20vw (ngoài mép trái) → 120vw (ngoài mép phải). reverse thì đảo lại.
  const startX = reverse ? 120 : -20;
  const endX = reverse ? -20 : 120;
  const [x, setX] = useState(startX);
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const section = wrapperRef.current?.closest("section");
    if (!section || prefersReducedMotion) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Section vừa xuất hiện trong viewport — cho tàu chạy chậm rãi qua section.
          setTransitionEnabled(true);
          setX(endX);
        } else {
          // Rời khỏi viewport: về lại vị trí xuất phát ngay lập tức (không transition,
          // vô hình vì section đang ẩn) để lần cuộn tới lại chạy lại từ đầu.
          setTransitionEnabled(false);
          setX(startX);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [startX, endX]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-0 z-0 select-none"
      style={{
        transform: `translate(${x}vw, -50%)`,
        transition: transitionEnabled ? `transform ${BOAT_SAIL_DURATION_S}s linear` : "none",
        willChange: "transform",
      }}
    >
      <img src={src} alt="" className={`${className} h-auto drop-shadow-xl`} />
    </div>
  );
}
