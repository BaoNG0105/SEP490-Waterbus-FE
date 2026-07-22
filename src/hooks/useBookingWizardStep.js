import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const clampStep = (value, maxStep = 3) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(maxStep, Math.max(1, Math.floor(n)));
};

/**
 * Đồng bộ bước wizard với URL (?step=2) để nút Back trình duyệt
 * lùi Step 2→1 trong cùng trang đặt vé, không nhảy sang route khác trong history.
 */
export function useBookingWizardStep({ maxStep = 3, initialStep = 1 } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stepFromUrl = clampStep(searchParams.get("step") || initialStep, maxStep);
  const [currentStep, setCurrentStep] = useState(stepFromUrl);

  useEffect(() => {
    setCurrentStep(stepFromUrl);
  }, [stepFromUrl]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const goToStep = useCallback((nextStep, { replace = false } = {}) => {
    const step = clampStep(nextStep, maxStep);
    setCurrentStep(step);
    const params = new URLSearchParams(location.search);
    if (step <= 1) params.delete("step");
    else params.set("step", String(step));
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace, state: location.state },
    );
  }, [location.pathname, location.search, location.state, maxStep, navigate]);

  return { currentStep, goToStep, setCurrentStep: goToStep };
}
