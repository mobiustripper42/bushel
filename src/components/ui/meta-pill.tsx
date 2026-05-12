import * as React from "react";

export function MetaPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="meta-pill">
      <span className="meta-key">{label}</span>
      <span className="meta-val">{children}</span>
    </div>
  );
}

export function MetaRow({ children }: { children: React.ReactNode }) {
  return <div className="meta-row">{children}</div>;
}
