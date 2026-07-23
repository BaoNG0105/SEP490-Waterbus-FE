import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const clampStep = (value, maxStep = 3) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(maxStep, Math.max(1, Math.floor(n)));
};

/**
 * Đồng bộ bước wizard với URL (?step=2) để nút Back trình duyệt
 * lùi Step 2→1 trong cùng trang đặt vé, không nhảy sang route khác trong history.
 *
 * @param {(fromStep: number, toStep: number) => boolean | Promise<boolean>} [confirmLeaveStep]
 *        Gọi khi Back/Forward trình duyệt làm giảm bước. return true = cho phép, false = giữ nguyên.
 */
export function useBookingWizardStep({
  maxStep = 3,
  initialStep = 1,
  confirmLeaveStep,
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stepFromUrl = clampStep(searchParams.get("step") || initialStep, maxStep);
  const [currentStep, setCurrentStep] = useState(stepFromUrl);

  const intentionalNavRef = useRef(false);
  const currentStepRef = useRef(currentStep);
  const confirmLeaveStepRef = useRef(confirmLeaveStep);
  const handlingExternalRef = useRef(false);

  currentStepRef.current = currentStep;
  confirmLeaveStepRef.current = confirmLeaveStep;

  const buildStepSearch = useCallback((step) => {
    const params = new URLSearchParams(location.search);
    if (step <= 1) params.delete("step");
    else params.set("step", String(step));
    const search = params.toString();
    return search ? `?${search}` : "";
  }, [location.search]);

  const goToStep = useCallback((nextStep, { replace = false } = {}) => {
    const step = clampStep(nextStep, maxStep);
    intentionalNavRef.current = true;
    setCurrentStep(step);
    navigate(
      { pathname: location.pathname, search: buildStepSearch(step) },
      { replace, state: location.state },
    );
  }, [buildStepSearch, location.pathname, location.state, maxStep, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  useEffect(() => {
    const from = currentStepRef.current;
    const to = stepFromUrl;
    if (from === to) {
      intentionalNavRef.current = false;
      return undefined;
    }

    if (intentionalNavRef.current) {
      intentionalNavRef.current = false;
      setCurrentStep(to);
      return undefined;
    }

    // Back/Forward trình duyệt (đổi URL mà không qua goToStep)
    if (handlingExternalRef.current) return undefined;
    handlingExternalRef.current = true;

    let cancelled = false;

    const run = async () => {
      const leavingForward = to > from;
      const guard = confirmLeaveStepRef.current;

      if (!leavingForward && typeof guard === "function") {
        // Giữ URL/step hiện tại trong lúc hỏi — tránh flash về bước trước
        intentionalNavRef.current = true;
        navigate(
          { pathname: location.pathname, search: buildStepSearch(from) },
          { replace: true, state: location.state },
        );
        setCurrentStep(from);

        let allowed = false;
        try {
          allowed = Boolean(await guard(from, to));
        } catch {
          allowed = false;
        }
        if (cancelled) return;

        if (allowed) {
          goToStep(to);
        }
        handlingExternalRef.current = false;
        return;
      }

      setCurrentStep(to);
      handlingExternalRef.current = false;
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [buildStepSearch, goToStep, location.pathname, location.state, navigate, stepFromUrl]);

  return { currentStep, goToStep, setCurrentStep: goToStep };
}
