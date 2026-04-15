import React, { createContext, useState, useEffect, useContext } from "react";
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // 1. Quản lý Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // 2. Quản lý Ngôn ngữ
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("lang") || "VN";
  });

  // Cập nhật class 'dark' cho thẻ html mỗi khi isDarkMode thay đổi
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Lưu ngôn ngữ vào máy để khi F5 không bị mất
  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleLang = () => setLang((prev) => (prev === "VN" ? "ENG" : "VN"));

  return (
    <AppContext.Provider
      value={{ isDarkMode, toggleDarkMode, lang, toggleLang }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Hook để các component con lấy dữ liệu dễ dàng
export const useApp = () => useContext(AppContext);
