// Trả về ngày hôm nay theo giờ địa phương, định dạng YYYY-MM-DD cho <input type="date">.
export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Ngày xa nhất được phép đặt, tính từ hôm nay (mặc định 7 ngày) — dùng làm `max` cho các ô
// chọn ngày đi/ngày về/ngày tham quan để khóa không cho chọn quá xa trong tương lai.
export const getMaxBookableDateString = (daysAhead = 7) => {
  const now = new Date();
  now.setDate(now.getDate() + daysAhead);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
