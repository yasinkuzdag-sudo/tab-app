import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data?.user?.email ?? "");
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      <p>Hoş geldin {email ? <b>{email}</b> : ""}</p>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/";
        }}
      >
        Çıkış Yap
      </button>
    </div>
  );
}