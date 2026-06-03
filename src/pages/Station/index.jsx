import { useParams, Navigate } from "react-router-dom";
// Import dữ liệu từ file riêng
import { stationsData } from "../../data/stations";
// Import useApp để lấy ngôn ngữ hiện tại
import { useApp } from "../../context/AppContext";

export const Station = () => {
  // Lấy ID trạm từ URL (vd: 'bach-dang')
  const { id } = useParams();
  const station = stationsData[id];

  // Gọi lang từ Context
  const { lang } = useApp();

  // Nếu người dùng nhập sai URL (trạm không tồn tại), chuyển hướng về trang chủ
  if (!station) {
    return <Navigate to="/" />;
  }

  return (
    <main className="pt-24 pb-20 bg-background dark:bg-slate-900 transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative w-full h-[716px] px-4 md:px-8 mb-20">
        <div className="relative w-full h-full rounded-[2rem] overflow-hidden">
          <img
            className="w-full h-full object-cover"
            alt={station.name}
            src={station.heroImg}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-16">
            <h1 className="font-headline text-5xl md:text-7xl text-white font-bold tracking-tight mb-4">
              {station.name}
            </h1>
            <p className="text-white/80 max-w-xl font-body text-lg md:text-xl">
              {station.slogan}
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: Location Info */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 mb-32 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="font-headline text-4xl font-bold mb-6 text-on-surface dark:text-white">
            {lang === "VN" ? "Vị trí chiến lược" : "Strategic Location"}
          </h2>
          <div className="space-y-6 text-on-surface-variant dark:text-white/80 leading-relaxed">
            <div className="bg-surface-container-low dark:bg-slate-800 p-6 rounded-2xl transition-colors">
              <p className="font-headline font-bold text-on-surface dark:text-white text-lg mb-1">
                {station.addressTitle}
              </p>
              <p className="font-body italic text-sm">{station.addressSub}</p>
            </div>
            <p className="text-lg">{station.description}</p>
          </div>
        </div>
        {/* Phần Bản Đồ (Map) */}
        <div className="relative h-[450px] rounded-3xl overflow-hidden shadow-2xl dark:shadow-none group">
          <iframe
            src={station.mapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full transition-all duration-500 dark:invert dark:grayscale-[80%] dark:hue-rotate-180"
          ></iframe>
        </div>
      </section>

      {/* Section 2: Gallery */}
      {station.gallery && station.gallery.length === 3 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 mb-32">
          <h2 className="font-headline text-4xl font-bold mb-12 text-center dark:text-white">
            {lang === "VN"
              ? `Góc nhìn ${station.name}`
              : `Views of ${station.name}`}
          </h2>
          <div className="grid grid-cols-12 grid-rows-2 gap-4 h-[600px]">
            <div className="col-span-8 row-span-2 rounded-[2rem] overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 1"
                src={station.gallery[0]}
              />
            </div>
            <div className="col-span-4 row-span-1 rounded-[2rem] overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 2"
                src={station.gallery[1]}
              />
            </div>
            <div className="col-span-4 row-span-1 rounded-[2rem] overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 3"
                src={station.gallery[2]}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
