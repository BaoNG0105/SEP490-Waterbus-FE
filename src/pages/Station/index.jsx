import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
// Import dữ liệu từ file riêng
import { stationsData } from "../../data/stations";

export const Station = () => {
  // Lấy ID trạm từ URL (vd: 'bach-dang')
  const { id } = useParams();
  const station = stationsData[id];

  // Quản lý trạng thái mở/đóng Modal cho các địa điểm lân cận
  const [selectedAttraction, setSelectedAttraction] = useState(null);

  // Nếu người dùng nhập sai URL (trạm không tồn tại), chuyển hướng về trang chủ
  if (!station) {
    return <Navigate to="/" />;
  }

  return (
    <main className="pt-24 pb-20 bg-background dark:bg-slate-900 transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative w-full h-[716px] px-4 md:px-8 mb-20">
        <div className="relative w-full h-full rounded-2rem overflow-hidden">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container/20 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary dark:text-yellow-400">
              location_on
            </span>
            <span className="text-primary dark:text-yellow-400 font-label font-bold text-sm">
              TRẠM TRUNG TÂM
            </span>
          </div>
          <h2 className="font-headline text-4xl font-bold mb-6 text-on-surface dark:text-white">
            Vị trí chiến lược
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
          {/* Thay thẻ img bằng thẻ iframe */}
          <iframe
            src={station.mapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            // Hiệu ứng tự động chuyển Google Map sang Dark Mode khi giao diện đổi màu
            className="w-full h-full transition-all duration-500 dark:invert dark:grayscale-80% dark:hue-rotate-180"
          ></iframe>

          {/* Lớp Overlay thông tin (Sẽ mờ đi khi người dùng trỏ chuột vào để tương tác với bản đồ) */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-xl flex justify-between items-center transition-all duration-300 group-hover:opacity-0 pointer-events-none">
            <div>
              <p className="font-bold text-on-surface dark:text-white">
                Xem bản đồ tương tác
              </p>
              <p className="text-xs text-on-surface-variant dark:text-white/60">
                Hướng dẫn đường đi đến bến
              </p>
            </div>
            <button className="bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 p-2 rounded-full transition-colors pointer-events-auto hover:scale-110">
              <span className="material-symbols-outlined">directions</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Nearby Attractions */}
      {station.attractions && station.attractions.length > 0 && (
        <section className="bg-surface-container-low dark:bg-slate-800 py-24 mb-32 transition-colors">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="font-headline text-4xl font-bold mb-4 dark:text-white">
                  Điểm đến lân cận
                </h2>
                <p className="text-on-surface-variant dark:text-white/70">
                  Khám phá các biểu tượng của Sài Gòn chỉ trong vài bước chân từ
                  bến.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="p-3 rounded-full bg-white dark:bg-slate-700 border border-outline-variant/20 dark:border-slate-600 shadow-sm hover:bg-primary-container dark:hover:bg-slate-600 dark:text-white transition-colors">
                  <span className="material-symbols-outlined">
                    chevron_left
                  </span>
                </button>
                <button className="p-3 rounded-full bg-white dark:bg-slate-700 border border-outline-variant/20 dark:border-slate-600 shadow-sm hover:bg-primary-container dark:hover:bg-slate-600 dark:text-white transition-colors">
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {/* Scrollable Cards */}
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
              {station.attractions.map((item) => (
                <div
                  key={item.id}
                  className="min-w-[300px] md:min-w-[380px] group cursor-pointer"
                  onClick={() => setSelectedAttraction(item)} // Mở modal khi click
                >
                  <div className="h-64 rounded-3xl overflow-hidden mb-4 relative">
                    <img
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      alt={item.title}
                      src={item.img}
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                  </div>
                  <h3 className="font-headline text-xl font-bold dark:text-white group-hover:text-primary dark:group-hover:text-yellow-400 transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-on-surface-variant dark:text-white/60 text-sm">
                    <span className="material-symbols-outlined text-base">
                      directions_walk
                    </span>
                    <span>{item.distance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 3: Gallery */}
      {station.gallery && station.gallery.length === 3 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 mb-32">
          <h2 className="font-headline text-4xl font-bold mb-12 text-center dark:text-white">
            Góc nhìn {station.name}
          </h2>
          <div className="grid grid-cols-12 grid-rows-2 gap-4 h-[600px]">
            <div className="col-span-8 row-span-2 rounded-2rem overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 1"
                src={station.gallery[0]}
              />
            </div>
            <div className="col-span-4 row-span-1 rounded-2rem overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 2"
                src={station.gallery[1]}
              />
            </div>
            <div className="col-span-4 row-span-1 rounded-2rem overflow-hidden">
              <img
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                alt="Gallery 3"
                src={station.gallery[2]}
              />
            </div>
          </div>
        </section>
      )}

      {/* Section 4: Route Map */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 mb-12">
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white flex flex-col items-center">
          <h2 className="font-headline text-4xl font-bold mb-4">
            Mạng lưới kết nối
          </h2>
          <p className="text-slate-400 mb-12 text-center max-w-2xl">
            {station.name} là nút thắt trung tâm kết nối tất cả các tuyến chính
            của RiverNav đến mọi khu vực trong thành phố.
          </p>
          <div className="w-full max-w-4xl bg-white/5 rounded-3xl p-8 backdrop-blur-sm border border-white/10">
            <img
              className="w-full h-auto rounded-xl opacity-80"
              alt="Map"
              src="https://res.cloudinary.com/dygipvoal/image/upload/v1776139243/uyviiv5fozuo569lvd4i.jpg"
            />
          </div>
        </div>
      </section>

      {/* React Modal cho Địa điểm lân cận */}
      {selectedAttraction && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative animate-[fadeIn_0.3s_ease-out]">
            <button
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
              onClick={() => setSelectedAttraction(null)}
            >
              <span className="material-symbols-outlined dark:text-white">
                close
              </span>
            </button>
            <div className="grid md:grid-cols-2">
              <div className="h-64 md:h-full overflow-hidden">
                <img
                  alt={selectedAttraction.title}
                  className="w-full h-full object-cover"
                  src={selectedAttraction.img}
                />
              </div>
              <div className="p-8 flex flex-col h-full">
                <h3 className="font-headline text-3xl font-bold mb-4 text-on-surface dark:text-white">
                  {selectedAttraction.title}
                </h3>
                <p className="font-body text-on-surface-variant dark:text-white/70 mb-6 flex-grow">
                  {selectedAttraction.desc}
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-label dark:text-white">
                    <span className="material-symbols-outlined text-primary dark:text-yellow-400">
                      schedule
                    </span>
                    <span>{selectedAttraction.hours}</span>
                  </div>
                  <a
                    href={selectedAttraction.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-primary dark:bg-yellow-400 text-white dark:text-slate-900 py-4 rounded-xl font-headline font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">map</span>
                    Xem trên bản đồ
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
