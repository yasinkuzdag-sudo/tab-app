import { useEffect, useState } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import { supabase } from "./lib/supabase";

export default function App() {
  const [ctx, setCtx] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  const [token, setToken] = useState<string>("");

  // ✅ Edge Function sonucu
  const [fnResult, setFnResult] = useState<any>(null);
  const [fnError, setFnError] = useState<string>("");
  const [status, setStatus] = useState<string>("Başlatılıyor...");

  // ✅ Debug: Supabase session/user
  const [sbUserId, setSbUserId] = useState<string>("");
  const [sbSessionOk, setSbSessionOk] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setToken("");
        setFnError("");
        setFnResult(null);
        setSbUserId("");
        setSbSessionOk(false);
        setStatus("Supabase session kontrol ediliyor...");

        // 0) Zaten session varsa direkt devam et (Teams tab tekrar açıldığında hızlandırır)
        const { data: existingSess } = await supabase.auth.getSession();
        if (existingSess?.session?.access_token) {
          setStatus("Mevcut Supabase session bulundu. User doğrulanıyor...");
          const { data: u } = await supabase.auth.getUser();
          if (u?.user?.id) {
            setSbSessionOk(true);
            setSbUserId(u.user.id);
            setStatus("Giriş zaten var ✅ Dashboard'a yönlendiriliyor...");
            window.location.href = "/dashboard";
            return;
          }
        }

        // 1) Teams initialize
        setStatus("Teams initialize...");
        await microsoftTeams.app.initialize();
        const context = await microsoftTeams.app.getContext();
        setCtx(context);

        // 2) Teams SSO token al
        setStatus("Teams SSO token alınıyor...");
        const t = await microsoftTeams.authentication.getAuthToken({
          resources: ["api://04bb484d-7e39-4bcc-a231-c34579fa51a1"],
        });

        setToken(t || "");

        if (!t) {
          setStatus("Token alınamadı.");
          return;
        }

        // 3) Teams token -> Edge Function (teams-auth)
        //    Beklenti: { ok:true, session:{access_token, refresh_token}, profile:{...} }
        setStatus("Edge Function çağrılıyor (teams-auth)...");
        const { data, error } = await supabase.functions.invoke("teams-auth", {
          headers: {
            "x-teams-token": t,
            "Content-Type": "application/json",
          },
          body: {},
        });

        if (error) {
          setFnError(error.message || String(error));
          setStatus("Edge Function hata verdi.");
          return;
        }

        setFnResult(data);

        if (!data?.ok) {
          setFnError(data?.error || "Edge Function ok:false döndü.");
          setStatus("Yetkilendirme başarısız.");
          return;
        }

        // 4) Function session döndürüyorsa Supabase session set et
        if (data?.session?.access_token && data?.session?.refresh_token) {
          setStatus("Supabase session set ediliyor...");
          const { error: setSessErr } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (setSessErr) {
            setFnError(setSessErr.message);
            setStatus("Session set edilemedi.");
            return;
          }

          // 5) supabase.auth.getUser() kontrol
          setStatus("Session doğrulanıyor (supabase.auth.getUser)...");
          const { data: userData, error: userErr } = await supabase.auth.getUser();

          if (userErr) {
            setFnError(userErr.message);
            setStatus("Session doğrulama hatası.");
            return;
          }

          if (!userData?.user) {
            setFnError("Session set edildi ama supabase.auth.getUser() user döndürmedi.");
            setStatus("Session doğrulama başarısız.");
            return;
          }

          setSbSessionOk(true);
          setSbUserId(userData.user.id);

          setStatus("Giriş tamam ✅ Dashboard'a yönlendiriliyor...");
          window.location.href = "/dashboard";
          return;
        } else {
          // Session yoksa: Edge Function henüz A+C’nin “Auth session üret” kısmını yapmıyor demektir.
          setStatus("Token doğrulandı ama Supabase session dönmedi (A+C'nin session kısmı eksik).");
          setFnError(
            "Edge Function ok:true döndü ama response içinde session yok. A+C için function'ın Supabase Auth session üretip (access_token+refresh_token) döndürmesi gerekiyor."
          );
          return;
        }
      } catch (e: any) {
        setErr(String(e?.message || e));
        setStatus("Hata oluştu.");
      }
    })();
  }, []);

  const dotCount = (token.match(/\./g) || []).length;
  const preview =
    token && token.length > 40 ? `${token.slice(0, 16)}...${token.slice(-16)}` : token;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Workbot – SSO Test</h1>

      <div style={{ marginTop: 12 }}>
        <b>Durum:</b> {status}
      </div>

      {err && (
        <div style={{ color: "crimson", marginTop: 12 }}>
          <b>Hata:</b> {err}
        </div>
      )}

      {fnError && (
        <div style={{ color: "crimson", marginTop: 12 }}>
          <b>Edge Function:</b> {fnError}
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
        <b>Preview:</b>{" "}
        <span style={{ fontFamily: "monospace" }}>{preview || "(boş)"}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <b>Supabase session OK?</b> {sbSessionOk ? "EVET ✅" : "HAYIR ❌"} <br />
        <b>Supabase user id:</b>{" "}
        <span style={{ fontFamily: "monospace" }}>{sbUserId || "-"}</span>
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

      <div style={{ marginTop: 16 }}>
        <b>Edge Function cevabı:</b>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: "#111",
            color: "#0f0",
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 320,
          }}
        >
          {fnResult ? JSON.stringify(fnResult, null, 2) : "(henüz yok)"}
        </pre>
      </div>
    </div>
  );
}