import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

/**
 * Quét QR bằng camera (ưu tiên camera sau).
 * Gọi onScan một lần / mỗi mã, rồi dừng camera nếu pauseOnScan.
 */
export function TicketQrCameraScanner({
  lang = "VN",
  active = false,
  pauseOnScan = true,
  onScan,
  onClose,
  className = "",
}) {
  if (!active) return null;

  return (
    <ActiveTicketQrCameraScanner
      key={`${lang}-${pauseOnScan}`}
      lang={lang}
      pauseOnScan={pauseOnScan}
      onScan={onScan}
      onClose={onClose}
      className={className}
    />
  );
}

function ActiveTicketQrCameraScanner({
  lang,
  pauseOnScan,
  onScan,
  onClose,
  className,
}) {
  const reactId = useId().replace(/:/g, "");
  const regionId = `ticket-qr-cam-${reactId}`;
  const scannerRef = useRef(null);
  const handledRef = useRef("");
  const onScanRef = useRef(onScan);
  const [camError, setCamError] = useState("");
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(regionId, { verbose: false });
    scannerRef.current = scanner;
    handledRef.current = "";

    const stopSafely = async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        /* ignore */
      }
      try {
        await scanner.clear();
      } catch {
        /* ignore */
      }
    };

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return { width: edge, height: edge };
            },
            aspectRatio: 1,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          },
          (decodedText) => {
            const text = String(decodedText || "").trim();
            if (!text || handledRef.current === text) return;
            handledRef.current = text;
            // Tra cứu ngay — không chờ stop camera (stop hay chậm vài giây).
            onScanRef.current?.(text);
            if (pauseOnScan) {
              stopSafely().catch(() => {});
            }
          },
          () => {},
        );
        if (cancelled) {
          await stopSafely();
          return;
        }
        setIsStarting(false);
      } catch (error) {
        console.error("TicketQrCameraScanner start failed", error);
        if (cancelled) return;
        setIsStarting(false);
        const name = String(error?.name || "");
        const msg = String(error?.message || error || "");
        if (name === "NotAllowedError" || /permission|denied/i.test(msg)) {
          setCamError(lang === "VN"
            ? "Chưa được cấp quyền camera. Hãy cho phép camera trong trình duyệt."
            : "Camera permission denied. Allow camera access in the browser.");
        } else if (name === "NotFoundError" || /not found|no camera/i.test(msg)) {
          setCamError(lang === "VN"
            ? "Không tìm thấy camera trên thiết bị này."
            : "No camera found on this device.");
        } else if (/secure|https|insecure/i.test(msg)) {
          setCamError(lang === "VN"
            ? "Camera cần HTTPS (hoặc localhost)."
            : "Camera requires HTTPS (or localhost).");
        } else {
          setCamError(lang === "VN"
            ? "Không mở được camera. Thử lại hoặc nhập mã thủ công."
            : "Unable to open camera. Retry or enter the code manually.");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stopSafely().finally(() => {
        if (scannerRef.current === scanner) scannerRef.current = null;
      });
    };
  }, [regionId, lang, pauseOnScan]);

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 dark:border-slate-600 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/70">
          {lang === "VN" ? "Camera quét QR" : "QR camera"}
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-white hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden>close</span>
            {lang === "VN" ? "Đóng" : "Close"}
          </button>
        ) : null}
      </div>

      <div className="relative min-h-[240px] bg-black">
        <div id={regionId} className="ticket-qr-cam-region w-full overflow-hidden [&_video]:h-auto [&_video]:w-full [&_img]:max-w-full" />
        {isStarting && !camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-yellow-400" />
            <p className="text-xs font-bold text-white/80">
              {lang === "VN" ? "Đang mở camera…" : "Opening camera…"}
            </p>
          </div>
        ) : null}
        {camError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center">
            <p className="text-xs font-bold text-amber-200">{camError}</p>
          </div>
        ) : null}
      </div>

      {!camError ? (
        <p className="px-4 py-2.5 text-[11px] font-medium text-white/55">
          {lang === "VN"
            ? "Đưa mã QR vào khung — máy sẽ tra cứu tự động."
            : "Align the QR in the frame — lookup runs automatically."}
        </p>
      ) : null}
    </div>
  );
}
