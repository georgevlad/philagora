/**
 * Login page gets a bare layout — no admin sidebar.
 * Next.js nests layouts, but since the parent admin layout will
 * conditionally skip the sidebar for unauthenticated users,
 * this just passes children through.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
