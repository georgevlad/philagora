"use client";

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export function AdminField({
  label,
  labelClassName,
  children,
}: {
  label: ReactNode;
  labelClassName?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {cloneElement(children, { id })}
    </>
  );
}

export function AdminDialog({
  open,
  title,
  children,
  footer,
  onClose,
  busy = false,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    (
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>(
        ".admin-dialog-body :is(input:not([type=hidden]), textarea, select, button, a)",
      )
    )?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={`admin-dialog ${wide ? "admin-dialog-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="admin-button"
          aria-label={`Close ${title}`}
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="admin-dialog-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>
  );
}

type Confirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
};
const ConfirmContext = createContext<
  (options: Confirmation) => Promise<boolean>
>(async (options) => window.confirm(options.description));

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const resolve = useRef<((value: boolean) => void) | null>(null);
  const confirm = useCallback(
    (options: Confirmation) =>
      new Promise<boolean>((done) => {
        resolve.current?.(false);
        resolve.current = done;
        setConfirmation(options);
      }),
    [],
  );
  function finish(value: boolean) {
    resolve.current?.(value);
    resolve.current = null;
    setConfirmation(null);
  }
  useEffect(() => () => resolve.current?.(false), []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AdminDialog
        open={!!confirmation}
        title={confirmation?.title ?? "Confirm action"}
        onClose={() => finish(false)}
        footer={
          <>
            <button
              className="admin-button"
              onClick={() => finish(false)}
              data-autofocus
            >
              Cancel
            </button>
            <button
              className={`admin-button ${confirmation?.destructive ? "admin-button-danger" : "admin-button-primary"}`}
              onClick={() => finish(true)}
            >
              {confirmation?.confirmLabel ?? "Continue"}
            </button>
          </>
        }
      >
        <p>{confirmation?.description}</p>
      </AdminDialog>
    </ConfirmContext.Provider>
  );
}

export const useAdminConfirm = () => useContext(ConfirmContext);

/** Protect browser exits and in-app links; record switches call confirmDiscard. */
export function useUnsavedChanges(dirty: boolean) {
  const confirm = useAdminConfirm();
  const confirmDiscard = useCallback(
    async () =>
      !dirty ||
      confirm({
        title: "Discard unsaved changes?",
        description:
          "Your edits have not been saved. Stay here to save them, or discard them and continue.",
        confirmLabel: "Discard changes",
        destructive: true,
      }),
    [dirty, confirm],
  );
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.button !== 0 ||
        link.getAttribute("href")?.startsWith("#")
      )
        return;
      if (link.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      void confirmDiscard().then((discard) => {
        if (discard) {
          window.removeEventListener("beforeunload", beforeUnload);
          window.location.assign(link.href);
        }
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, confirmDiscard]);
  return confirmDiscard;
}

export function AdminNotice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`admin-notice ${error ? "admin-notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function AdminStatus({ status }: { status: string }) {
  return (
    <span className={`admin-status admin-status-${status}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
