import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import * as microsoftTeams from "@microsoft/teams-js";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("#root bulunamadı (index.html kontrol et).");
}

const render = () => {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
};

(async () => {
  try {
    // Teams içinde çalışıyorsa initialize başarılı olur
    await microsoftTeams.app.initialize();
    console.log("✅ Teams initialized");
  } catch (e) {
    // Browser / Vercel ortamı → normal
    console.warn("⚠️ Teams initialize failed (browser mode). Render devam.", e);
  } finally {
    // 🔥 Router + App HER ZAMAN render edilir
    render();
  }
})();