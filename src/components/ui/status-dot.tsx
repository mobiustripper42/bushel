export function StatusDot({ open }: { open: boolean }) {
  return <span className={"status-dot" + (open ? " is-open" : "")} />;
}
