export const AdminFooter = () => {
  return (
    <footer className="w-full flex flex-col items-center gap-3 text-center bg-[#124757] dark:bg-slate-900 border-t border-white/10 dark:border-slate-800 py-6 mt-auto transition-colors duration-300 shadow-inner">
      <p className="font-label text-[10px] uppercase font-bold tracking-widest text-white/40 dark:text-slate-600">
        &copy; {new Date().getFullYear()} WaterBus Management System. All Rights Reserved.
      </p>
    </footer>
  );
};