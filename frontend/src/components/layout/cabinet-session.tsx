"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, ApiError, errorText } from "@/lib/api/client";
import { sessionEvent, sessionStorageKey } from "@/lib/auth/session-events";
import { Loading, ErrorBox } from "@/components/ui";
import type { User } from "@/types";

const CabinetUser = createContext<User | null>(null);
export function identityKey(user: User) {
  return JSON.stringify([
    user.id,
    user.full_name,
    user.phone,
    [...user.roles].sort(),
    [...user.extra_permissions].sort(),
    user.is_active,
  ]);
}
export function useCabinetUser() {
  const user = useContext(CabinetUser);
  if (!user) throw new Error("Kabinet sessiyasi tasdiqlanmagan.");
  return user;
}
export function CabinetSession({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const signature = identityKey(user);
  const verifyRef = useRef<(hide?: boolean) => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let redirecting = false;
    let sequence = 0;
    let controller: AbortController | undefined;
    const closeSession = async (path?: string) => {
      if (redirecting || disposed) return;
      redirecting = true;
      ++sequence;
      controller?.abort();
      setChecking(true);
      await client.cancelQueries();
      client.clear();
      if (!disposed && path) window.location.replace(path);
    };
    const verify = async (hide = true) => {
      if (redirecting || disposed) return;
      const current = ++sequence;
      controller?.abort();
      controller = new AbortController();
      if (hide) setChecking(true);
      try {
        const actual = await api<User>("me/", { signal: controller.signal });
        if (disposed || current !== sequence) return;
        if (!actual.is_active || identityKey(actual) !== signature) {
          await closeSession("/kabinet");
          return;
        }
        setError("");
        setVerified(true);
        setChecking(false);
      } catch (failure) {
        if (disposed || current !== sequence || controller.signal.aborted)
          return;
        setChecking(true);
        if (
          failure instanceof ApiError &&
          [401, 403].includes(failure.status)
        ) {
          await closeSession("/kirish");
        } else setError(errorText(failure));
      }
    };
    verifyRef.current = (hide = true) => {
      void verify(hide);
    };
    const foreground = () => {
      if (document.visibilityState !== "hidden") void verify();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === sessionStorageKey) void verify();
    };
    const changed = (event: Event) => {
      // The login/logout caller performs this tab's navigation once.
      // Other tabs receive storage events and verify their server session.
      if (event instanceof CustomEvent && event.detail === "redirecting")
        void closeSession();
      else void verify();
    };
    window.addEventListener("focus", foreground);
    window.addEventListener("pageshow", foreground);
    window.addEventListener("storage", storage);
    window.addEventListener(sessionEvent, changed);
    document.addEventListener("visibilitychange", foreground);
    const interval = setInterval(() => {
      void verify(false);
    }, 15000);
    void verify();
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      window.removeEventListener("storage", storage);
      window.removeEventListener(sessionEvent, changed);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [client, signature]);
  useLayoutEffect(() => {
    verifyRef.current();
  }, [pathname]);
  return (
    <>
      {checking && (
        <div className="container section" role="status" aria-live="polite">
          {error ? (
            <ErrorBox message={error} retry={() => verifyRef.current()} />
          ) : (
            <Loading />
          )}
        </div>
      )}
      {verified && (
        <div hidden={checking} inert={checking} data-cabinet-user={user.id}>
          <CabinetUser.Provider value={user}>
            <QueryClientProvider client={client}>
              {children}
            </QueryClientProvider>
          </CabinetUser.Provider>
        </div>
      )}
    </>
  );
}
