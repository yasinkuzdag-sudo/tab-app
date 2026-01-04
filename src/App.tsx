import { useEffect, useState } from "react";
import * as microsoftTeams from "@microsoft/teams-js";

export default function App() {
  const [ctx, setCtx] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setToken("");

        await microsoftTeams.app.initialize();
        const context = await microsoftTeams.app.getContext();
        setCtx(context);

        // ✅ SSO token test (resource = manifest'teki webApplicationInfo.resource)
        const t = await microsoftTeams.authentication.getAuthToken({
          resources: ["api://04bb484d-7e39-4bcc-a231-c34579fa51a1"],
        });

        setToken(t || "");
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  const dotCount = (token.match(/\./g) || []).length;
  const preview =
    token && token.length > 40 ? `${token.slice(0, 16)}...${token.slice(-16)}` : token;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Workbot – SSO Test</h1>

      {err && (
        <div style={{ color: "crimson", marginTop: 12 }}>
          <b>Hata:</b> {err}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <b>User Object ID:</b> {ctx?.user?.id || "-"} <br />
        <b>UPN:</b> {ctx?.user?.userPrincipalName || "-"} <br />
        <b>Tenant ID:</b> {ctx?.app?.tenant?.id || "-"}
      </div>

      <div style={{ marginTop: 12 }}>
        <b>Token var mı?</b> {token ? "EVET ✅" : "HAYIR ❌"} <br />
        <b>Token uzunluğu:</b> {token?.length || 0} <br />
        <b>Nokta sayısı (JWT olmalı = 2):</b> {dotCount} <br />
        <b>Preview:</b> <span style={{ fontFamily: "monospace" }}>{preview || "(boş)"}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => {
            if (!token) return;
            navigator.clipboard.writeText(token);
            alert("Token kopyalandı");
          }}
          disabled={!token}
        >
          Token'ı kopyala
        </button>
      </div>
    </div>
  );
}