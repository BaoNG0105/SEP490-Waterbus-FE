import { useEffect, useRef, useState } from "react";

// Các ảnh tàu dùng cho hiệu ứng — chọn qua prop `variant`, khỏi phải chép URL ở từng nơi gọi.
const BOAT_IMAGES = {
  default: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat.png",
  sightseeing: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat-sightseeing.png",
  top: "https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/boat-top.png",
};

// Tốc độ chạy chậm rãi — số giây để tàu lướt hết từ mép trái sang mép phải, mỗi vòng lặp.
const BOAT_SAIL_DURATION_S = 12;

// Vị trí "ẩn hẳn" ngoài mép trái/phải, dùng calc() trộn % (theo chính bề rộng ảnh tàu) với vw
// (theo bề rộng viewport) — nhờ vậy luôn ẩn trọn vẹn dù ảnh rộng bao nhiêu ở mọi breakpoint.
// Trước đây dùng số vw cố định (-20vw/120vw) nên với ảnh tàu rộng (lg:w-260 ≈ 65rem), ở vị trí
// -20vw ảnh vẫn còn thừa ra một đoạn trong viewport — tàu trông như "dừng" giữa chừng thay vì
// lướt khuất hẳn.
const HIDDEN_LEFT = "calc(-100% - 5vw)"; // mép phải ảnh nằm ngoài mép trái viewport
const HIDDEN_RIGHT = "calc(100vw + 5vw)"; // mép trái ảnh nằm ngoài mép phải viewport

/**
 * Ảnh con tàu tự động lướt ngang lặp vô hạn hễ section chứa nó còn hiển thị trong viewport
 * (không phụ thuộc tốc độ cuộn — chạy bằng CSS animation `wb-boat-sail` với nhịp độ cố định,
 * chậm rãi, lặp lại liên tục). Mặc định chạy từ trái sang phải; đặt `reverse` để chạy ngược,
 * phải sang trái. Rời khỏi viewport thì tàu lặng lẽ về lại vị trí xuất phát và dừng animation,
 * để lần sau cuộn tới lại chạy lại từ đầu.
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
  // Trái sang phải: ẩn mép trái → ẩn mép phải. reverse thì đảo lại.
  const startX = reverse ? HIDDEN_RIGHT : HIDDEN_LEFT;
  const endX = reverse ? HIDDEN_LEFT : HIDDEN_RIGHT;
  const [isSailing, setIsSailing] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const section = wrapperRef.current?.closest("section");
    if (!section || prefersReducedMotion) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.15) {
          // Section vừa xuất hiện trong viewport (>=15%) — cho tàu chạy lặp vô hạn qua section.
          setIsSailing(true);
        } else if (entry.intersectionRatio === 0) {
          // Đã ra khỏi viewport hoàn toàn: dừng animation và về lại vị trí xuất phát ngay lập
          // tức (vô hình vì section đã ẩn hết) để lần cuộn tới lại chạy lại từ đầu.
          // Chỉ reset khi ratio = 0 (không phải hễ tụt dưới 0.15 là reset) để không cắt
          // ngang hiệu ứng đang chạy dở khi section mới rời viewport một phần.
          setIsSailing(false);
        }
        // else: ratio nằm giữa 0 và 0.15 (section đang rời viewport dần) — bỏ qua, để
        // animation đang chạy dở (nếu có) tự tiếp tục thay vì bị cắt ngang giữa chừng.
      },
      { threshold: [0, 0.15] }
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
        "--boat-start": startX,
        "--boat-end": endX,
        transform: isSailing ? undefined : `translate(${startX}, -50%)`,
        animation: isSailing ? `wb-boat-sail ${BOAT_SAIL_DURATION_S}s linear infinite` : "none",
        willChange: "transform",
      }}
    >
      <img src={src} alt="" className={`${className} h-auto drop-shadow-xl`} />
    </div>
  );
}