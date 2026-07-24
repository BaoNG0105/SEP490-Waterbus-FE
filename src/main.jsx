import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext";
import { Provider } from "react-redux";
import { store } from "./redux/store.js";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Hiện icon Material Symbols sau khi font sẵn sàng — tránh lộ chữ arrow_back/home. */
const markMaterialIconsReady = () => {
  document.documentElement.classList.add("material-icons-ready");
};
const ICON_FONT = '24px "Material Symbols Outlined"';
if (typeof document !== "undefined" && document.fonts) {
  if (document.fonts.check(ICON_FONT)) {
    markMaterialIconsReady();
  } else {
    document.fonts.load(ICON_FONT).then(markMaterialIconsReady).catch(markMaterialIconsReady);
    document.fonts.ready.then(markMaterialIconsReady).catch(() => {});
    window.setTimeout(markMaterialIconsReady, 2500);
  }
} else {
  markMaterialIconsReady();
}

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    {/* Provider ngoài StrictMode để tránh GSI initialize() bị gọi 2 lần ở React 18. */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ""}>
      <StrictMode>
        <AppProvider>
          <App />
        </AppProvider>
      </StrictMode>
    </GoogleOAuthProvider>
  </Provider>,
);
