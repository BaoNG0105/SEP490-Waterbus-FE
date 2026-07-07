import * as LottieReact from "lottie-react";

const Lottie = LottieReact.default?.default || LottieReact.default || LottieReact;

const paymentPulseAnimation = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 120,
  w: 160,
  h: 160,
  nm: "Payment pulse",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Pulse ring",
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 18, s: [36] }, { t: 78, s: [0] }, { t: 120, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [80, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [70, 70, 100] }, { t: 78, s: [132, 132, 100] }, { t: 120, s: [70, 70, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [118, 118] }, nm: "Ellipse Path" },
            { ty: "st", c: { a: 0, k: [0.129, 0.73, 0.83, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 5 }, lc: 2, lj: 2 },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "Pulse ring group",
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Payment card",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [{ t: 0, s: [-2] }, { t: 34, s: [2] }, { t: 70, s: [-2] }, { t: 120, s: [-2] }] },
        p: { a: 0, k: [80, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [96, 96, 100] }, { t: 34, s: [104, 104, 100] }, { t: 70, s: [96, 96, 100] }, { t: 120, s: [96, 96, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "rc", d: 1, s: { a: 0, k: [92, 58] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 11 }, nm: "Card body" },
            { ty: "fl", c: { a: 0, k: [0.071, 0.278, 0.341, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "Card body group",
        },
        {
          ty: "gr",
          it: [
            { ty: "rc", d: 1, s: { a: 0, k: [68, 8] }, p: { a: 0, k: [0, -12] }, r: { a: 0, k: 2 }, nm: "Card line" },
            { ty: "fl", c: { a: 0, k: [1, 0.82, 0, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "Card line group",
        },
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [20, 14] }, s: { a: 0, k: [13, 13] }, nm: "Coin" },
            { ty: "fl", c: { a: 0, k: [0.129, 0.73, 0.83, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "Coin group",
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
  ],
};

export function PaymentLottieIcon({ className = "h-10 w-10", loop = true }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <Lottie animationData={paymentPulseAnimation} loop={loop} autoplay className="h-full w-full" />
    </span>
  );
}
