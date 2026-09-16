"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type ToastState = {
  id: number;
  message: string;
};

let globalShow: ((message: string) => void) | null = null;
let toastId = 0;

export function showToast(message: string) {
  globalShow?.(message);
}

export function showComingSoon(feature: string) {
  const verb = /s$/i.test(feature) ? "are" : "is";
  showToast(`${feature} ${verb} coming soon`);
}

export function ComingSoonToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const publicRoute = !pathname.startsWith("/admin");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((message: string) => {
    toastId += 1;
    setToast({
      id: toastId,
      message,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    globalShow = show;
    return () => {
      globalShow = null;
    };
  }, [show]);

  useEffect(() => {
    if (!toast) return;

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, publicRoute ? 6000 : 2000);

    const cleanupTimer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, publicRoute ? 6300 : 2300);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [toast, publicRoute]);

  const portal =
    toast && typeof document !== "undefined"
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
            <div
              className={`${pathname.startsWith("/admin") ? "" : "public-toast"} rounded-full bg-ink px-5 py-2.5 text-parchment shadow-lg transition-all duration-300 font-mono text-xs tracking-wide ${
                visible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`}
            >
              {toast.message}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {children}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast?.message ?? ""}
      </div>
      {portal}
    </>
  );
}
