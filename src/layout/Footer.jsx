import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { logoUrl as logo } from "../data/homeData";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M14 9h3V6h-3c-1.9 0-3.5 1.6-3.5 3.5V12H8v3h2.5v7h3v-7H16l.5-3h-3V9.5c0-.3.2-.5.5-.5z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2zm6.1-.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1zM12 9.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z" />
  </svg>
);

const ContactIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.2-8 5.1L4 8.2V6.5l8 5.1 8-5.1z" />
  </svg>
);

export const Footer = () => {
  const { lang } = useApp();

  return (
    <footer className="w-full select-none border-t border-white/10 bg-[#0b2f39] px-6 py-5 font-body text-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 md:px-10 md:py-6">
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-5 md:grid-cols-3">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 md:text-left">
            © 2026 Waterbus
          </p>
          <Link
            to="/terms-and-policy"
            className="text-[11px] font-medium text-white/60 underline-offset-2 transition-colors hover:text-yellow-400 hover:underline"
          >
            {lang === "VN" ? "Điều khoản & Chính sách" : "Terms & Policy"}
          </Link>
        </div>

        <div className="flex justify-center">
          <Link to="/" className="inline-flex">
            <img
              src={logo}
              alt="WaterBus"
              className="h-14 w-auto brightness-100 transition-transform hover:scale-[1.02] md:h-16"
            />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-4 md:justify-end">
          <a
            href="https://www.facebook.com/SaigonWaterbus.Official"
            target="_blank"
            rel="noreferrer"
            title="Facebook"
            className="text-white/75 transition-colors hover:text-yellow-400"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com/saigonwaterbus/"
            target="_blank"
            rel="noreferrer"
            title="Instagram"
            className="text-white/75 transition-colors hover:text-yellow-400"
          >
            <InstagramIcon />
          </a>
          <Link
            to="/contact"
            title={lang === "VN" ? "Liên hệ" : "Contact"}
            className="text-white/75 transition-colors hover:text-yellow-400"
          >
            <ContactIcon />
          </Link>
        </div>
      </div>
    </footer>
  );
};
