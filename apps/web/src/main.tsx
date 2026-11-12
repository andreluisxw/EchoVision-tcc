import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() => import("./App"));
const AdminApp = lazy(() => import("./admin/AdminApp"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p>Carregando EchoVision…</p>}>
      {location.pathname.startsWith("/admin") ? <AdminApp /> : <App />}
    </Suspense>
  </StrictMode>,
);
