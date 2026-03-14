"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastState = {
  id: number;
  message: string;
};

let globalShow: ((feature: string) => void) | null = null;
let toastId = 0;

export function showComingSoon(feature: string) {
  globalShow?.(feature);
}

export function ComingSoonToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((feature: string) => {
    toastId += 1;
    setToast({
      id: toastId,
      message: `${feature} are coming soon`,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    globalShow = show;
    return () => {
      globalShow = null;
    };
  }, [show]);

  useEffect(() => {
    if (!toast) return;

    setVisible(true);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 2000);

    const cleanupTimer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 2300);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [toast]);

  const portal = mounted && toast
    ? createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            className={`rounded-full bg-ink px-5 py-2.5 text-parchment shadow-lg transition-all duration-300 font-mono text-xs tracking-wide ${
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            {toast.message}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {children}
      {portal}
    </>
  );
}
