// Trả về ngày hôm nay theo giờ địa phương, định dạng YYYY-MM-DD cho <input type="date">.
export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
