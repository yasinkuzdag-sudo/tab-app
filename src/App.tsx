import { useEffect, useRef, useState } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import { supabase } from "./lib/supabase";
import { useLocation, useNavigate } from "react-router-dom";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ctx, setCtx] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const [fnResult, setFnResult] = useState<any>(null);
  const [fnError, setFnError] = useState<string>("");
  const [status, setStatus] = useState<string>("Başlatılıyor...");

  const [sbUserId, setSbUserId] = useState<string>("");
  const [sbSessionOk, setSbSessionOk] = useState<boolean>(false);

  // ✅ Teams login akışı gerçekten çalıştı mı? (session varken token bölümü görünmesin)
  const [usedTeamsLogin, setUsedTeamsLogin] = useState<boolean>(false);

  // 🔒 Bu komponent mount olduğunda sadece 1 kez çalıştır (StrictMode double-run + route değişimi loop engeli)
  const startedRef = useRef(false);

  // 🔒 Yönlendirmeyi de 1 kere yap
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        setErr("");
        setToken("");
        setUsedTeamsLogin(false);
        setFnError("");
        setFnResult(null);
        setSbUserId("");
        setSbSessionOk(false);
        setStatus("Supabase session kontrol ediliyor...");

        const isDashboard =
          location.pathname === "/dashboard" ||
          location.pathname.startsWith("/dashboard/");

        // 0) Session varsa → sadece dashboard’a geç (loop yok)
        const { data: existingSess } = await supabase.auth.getSession();
        if (existingSess?.session?.access_token) {
          const { data: u } = await supabase.auth.getUser();
          if (u?.user?.id) {
            setSbSessionOk(true);
            setSbUserId(u.user.id);
            setStatus("Giriş zaten var ✅");

            if (!isDashboard && !redirectedRef.current) {
              redirectedRef.current = true;
              navigate("/dashboard", { replace: true });
            }
            return;
          }
        }

        // 1) Teams context (Teams içinde değilse crash etmesin)
        setStatus("Teams context kontrol ediliyor...");
        let context: any = null;

        try {
          // main.tsx zaten initialize ediyor olabilir; burada sadece güvenli şekilde context almayı dene.
          context = await microsoftTeams.app.getContext();
          setCtx(context);
        } catch (e) {
          // Teams dışında normal: beyaz ekran yerine bilgilendir
          setStatus("Teams içinde değil (browser mod). SSO akışı çalışmaz.");
          setFnError(
            "Bu sayfa Teams içinde çalışacak şekilde tasarlandı. Normal tarayıcıda Teams SSO token alınamaz."
          );
          return;
        }

        // 2) Teams SSO token al
        setStatus("Teams SSO token alınıyor...");
        let t = "";
        try {
          t = await microsoftTeams.authentication.getAuthToken({
            resources: ["api://04bb484d-7e39-4bcc-a231-c34579fa51a1"],
          });
        } catch (e: any) {
          setStatus("Token alınamadı.");
          setFnError(String(e?.message || e));
          return;
        }

        setUsedTeamsLogin(true);
        setToken(t || "");
        if (!t) {
          setStatus("Token boş döndü.");
          return;
        }

        // 3) Edge Function çağır
        setStatus("Edge Function çağrılıyor (teams-auth)...");
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          setFnError("VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY eksik (Vercel env).");
          setStatus("Env eksik.");
          return;
        }

        const fnUrl = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/teams-auth`;

        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "x-teams-token": t,
          },
          body: JSON.stringify({}),
        });

        const raw = await res.text();
        let parsed: any = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = { raw };
        }

        setFnResult({
          httpStatus: res.status,
          ok: res.ok,
          body: parsed,
        });

        if (!res.ok) {
          setFnError(`Edge Function non-2xx döndü. HTTP ${res.status}. (Body aşağıda)`);
          setStatus("Edge Function hata verdi.");
          return;
        }

        const data = parsed;

        if (!data?.ok) {
          setFnError(data?.error || "Edge Function ok:false döndü.");
          setStatus("Yetkilendirme başarısız.");
          return;
        }

        // 4) Session set et
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
          setStatus("Giriş tamam ✅");

          if (!isDashboard && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/dashboard", { replace: true });
          }
          return;
        }

        setStatus("Token doğrulandı ama Supabase session dönmedi.");
        setFnError(
          "Edge Function ok:true döndü ama response içinde session yok. Function session üretip dönmeli."
        );
      } catch (e: any) {
        setErr(String(e?.message || e));
        setStatus("Hata oluştu.");
      }
    })();
    // ❗ dependency yok: 1 kere çalışsın (loop yok)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      {usedTeamsLogin && (
        <div style={{ marginTop: 12 }}>
          <b>Token var mı?</b> {token ? "EVET ✅" : "HAYIR ❌"} <br />
          <b>Token uzunluğu:</b> {token?.length || 0} <br />
          <b>Nokta sayısı (JWT olmalı = 2):</b> {dotCount} <br />
          <b>Preview:</b>{" "}
          <span style={{ fontFamily: "monospace" }}>{preview || "(boş)"}</span>
        </div>
      )}

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
            whiteSpace: "pre-wrap",
          }}
        >
          {fnResult ? JSON.stringify(fnResult, null, 2) : "(henüz yok)"}
        </pre>
      </div>
    </div>
  );
}