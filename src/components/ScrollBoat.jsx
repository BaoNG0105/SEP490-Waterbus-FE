import { useEffect, useRef, useState } from "react";

const BOAT_IMG_URL = "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat.png";

// Tốc độ chạy chậm rãi — số giây để tàu lướt hết từ mép trái sang mép phải.
const BOAT_SAIL_DURATION_S = 12;

/**
 * Ảnh con tàu tự động lướt từ trái sang phải mỗi khi section chứa nó xuất hiện trong
 * viewport (không phụ thuộc tốc độ cuộn — chạy bằng CSS transition với nhịp độ cố định,
 * chậm rãi). Rời khỏi viewport thì tàu lặng lẽ về lại vị trí xuất phát để lần sau cuộn
 * tới lại chạy từ đầu.
 *
 * Section cha cần có class "relative overflow-hidden" để cắt phần tàu tràn ra ngoài.
 * Đặt <ScrollBoat /> làm con trực tiếp đầu tiên của section (component tự tìm section
 * cha gần nhất qua closest("section") để theo dõi bằng IntersectionObserver).
 */
export function ScrollBoat({ className = "w-140 sm:w-180 md:w-220 lg:w-260" }) {
  const wrapperRef = useRef(null);
  const [x, setX] = useState(-20);
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const section = wrapperRef.current?.closest("section");
    if (!section || prefersReducedMotion) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Section vừa xuất hiện trong viewport — cho tàu chạy chậm rãi từ trái sang phải.
          setTransitionEnabled(true);
          setX(120);
        } else {
          // Rời khỏi viewport: về lại vị trí xuất phát ngay lập tức (không transition,
          // vô hình vì section đang ẩn) để lần cuộn tới chạy lại từ đầu.
          setTransitionEnabled(false);
          setX(-20);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

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
      <img src={BOAT_IMG_URL} alt="" className={`${className} h-auto drop-shadow-xl`} />
    </div>
  );
}
