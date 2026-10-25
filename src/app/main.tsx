import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import App from "./App";
import { RoleProvider } from "@/demo/roles";
import { ensureSeeded } from "@/mocks/db/seed";
import { Loading } from "@/ui/Loading";
import { ErrorBoundary } from "@/ui/ErrorBoundary";

function Root() {
  const [ready, setReady] = useState(false);
  useEffect(() => { ensureSeeded().catch(() => undefined).finally(() => setReady(true)); }, []);
  return ready ? <RoleProvider><App /></RoleProvider> : <Loading />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><ErrorBoundary><Root /></ErrorBoundary></React.StrictMode>);
