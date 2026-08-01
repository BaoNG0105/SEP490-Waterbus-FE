import { useState } from "react";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { POSTopBar } from "./components/POSTopBar";
import { WaterbusPOSFlow } from "./components/WaterbusPOSFlow";
import { SightseeingPOSFlow } from "./components/SightseeingPOSFlow";

/**
 * Quầy bán vé kiểu POS cho nhân viên: gộp Waterbus + Watersightseeing trong 1 màn hình,
 * chuyển dịch vụ bằng tab. Logic/API tìm chuyến – giữ ghế – thanh toán tái sử dụng y hệt
 * Step1/Step2/Step3 của trang đặt vé khách hàng; chỉ đổi khung hiển thị (top bar dịch vụ,
 * thanh bước gọn, panel "đơn hàng hiện tại") cho phù hợp thao tác nhanh tại quầy.
 * Cả 2 flow luôn được mount song song (ẩn/hiện bằng CSS) để giữ nguyên tiến trình đang dở
 * khi nhân viên chuyển qua lại giữa 2 dịch vụ.
 */
export function BookingPOS() {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const [service, setService] = useState("waterbus");

  return (
    <div className="space-y-5 pb-10 font-body">
      <POSTopBar lang={lang} service={service} onSwitchService={setService} user={user} />
      <WaterbusPOSFlow active={service === "waterbus"} />
      <SightseeingPOSFlow active={service === "sightseeing"} />
    </div>
  );
}
