import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import * as microsoftTeams from "@microsoft/teams-js";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("#root bulunamadı (index.html kontrol et).");
}

const render = () => {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

(async () => {
  try {
    // Teams içinde çalışıyorsa initialize başarılı olur
    await microsoftTeams.app.initialize();
    console.log("✅ Teams initialized");
  } catch (e) {
    // Tarayıcıda/Teams dışında normal: initialize başarısız olabilir
    console.warn("⚠️ Teams initialize olmadı (browser mod). Render devam.", e);
  } finally {
    // HER koşulda render et
    render();
  }
})();