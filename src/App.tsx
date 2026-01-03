import { useEffect, useState } from "react";
import * as microsoftTeams from "@microsoft/teams-js";

function App() {
  const [ctx, setCtx] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    microsoftTeams.app
      .initialize()
      .then(() => microsoftTeams.app.getContext())
      .then((context) => setCtx(context))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Workbot – İyi Oluş Paneli</h1>

      {err && <div style={{ color: "crimson" }}><b>Hata:</b> {err}</div>}

      <div style={{ marginTop: 12 }}>
        <b>User Object ID:</b> {ctx?.user?.id || "-"}<br/>
        <b>UPN:</b> {ctx?.user?.userPrincipalName || "-"}<br/>
        <b>Tenant ID:</b> {ctx?.app?.tenant?.id || "-"}
      </div>
    </div>
  );
}

export default App;