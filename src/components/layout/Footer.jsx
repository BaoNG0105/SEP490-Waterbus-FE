export const Footer = () => {
  return (
    <footer className="w-full py-16 px-8 text-white border-t border-white/10 bg-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-3 items-center justify-between gap-12 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4">
          <div className="text-lg font-black text-white uppercase tracking-widest font-body flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-xl">
              waves
            </span>
            waterbus
          </div>
          <p className="text-white/60 font-body text-sm normal-case">
            Redefining city mobility through the water.
          </p>
        </div>
        <div className="flex justify-center gap-8 font-body text-xs uppercase tracking-widest font-bold">
          <a
            className="text-white/70 hover:text-white transition-colors"
            href="https://www.facebook.com/SaigonWaterbus.Official"
          >
            Facebook
          </a>
          <a
            className="text-white/70 hover:text-white transition-colors"
            href="#"
          >
            Instagram
          </a>
          <a
            className="text-white/70 hover:text-white transition-colors"
            href="#"
          >
            Contact Us
          </a>
        </div>
        <div className="text-center md:text-right text-[10px] font-body uppercase tracking-widest">
          © 2024 Future-Classic River Transit. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
