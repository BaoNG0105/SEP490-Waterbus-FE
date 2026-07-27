import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../context/AppContext";
import { notify } from "../utils/swalToast";

/**
 * Chặn trang đặt dịch vụ (Waterbus / Sightseeing / Charter) khi chưa đăng nhập:
 * hiện modal yêu cầu đăng nhập — bấm nút thì sang /login (kèm redirect về trang
 * hiện tại), đóng modal (X, ESC, click ra ngoài) thì đá về trang chủ.
 */
export function useRequireAuthGate() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated || hasPromptedRef.current) return;
    hasPromptedRef.current = true;

    const redirectTarget = `${location.pathname}${location.search || ""}`;

    notify({
      dialog: true,
      icon: "info",
      title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
      text: lang === "VN"
        ? "Vui lòng đăng nhập để tiếp tục đặt dịch vụ này."
        : "Please sign in to continue with this booking.",
      confirmButtonText: lang === "VN" ? "Đăng nhập" : "Sign in",
      showCancelButton: false,
      showCloseButton: true,
      allowOutsideClick: true,
      allowEscapeKey: true,
    }).then((result) => {
      if (result.isConfirmed) {
        navigate(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      } else {
        navigate("/");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
}
