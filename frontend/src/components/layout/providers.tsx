"use client";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConnectionStatus />
      {children}
    </QueryClientProvider>
  );
}
function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="offline" role="status">
      Internet aloqasi yo‘q. To‘lov va davomat saqlanmaydi. Aloqa tiklangach
      qayta urinib ko‘ring.
    </div>
  ) : null;
}
export function PwaRegistration() {
  const [ready, setReady] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.waiting) setReady(reg);
          reg.addEventListener("updatefound", () => {
            reg.installing?.addEventListener("statechange", () => {
              if (reg.waiting && navigator.serviceWorker.controller)
                setReady(reg);
            });
          });
        })
        .catch(() => {});
    }
  }, []);
  return ready ? (
    <div className="update-banner" role="status">
      Yangi versiya tayyor. Avval ochiq formalarni saqlang.
      <button
        className="btn secondary"
        onClick={() => {
          ready.waiting?.postMessage("SKIP_WAITING");
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => window.location.reload(),
            { once: true },
          );
        }}
      >
        Yangilash
      </button>
    </div>
  ) : null;
}
