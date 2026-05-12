"use client";

import { Button } from "./button";

type Props = {
  count: number;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
};

export function SaveBar({ count, onDiscard, onSave, saving = false }: Props) {
  if (count === 0) return null;
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-msg">
        <span className="save-bar-dot" />
        <span>
          <strong>{count}</strong> unsaved {count === 1 ? "change" : "changes"}
        </span>
      </div>
      <div className="save-bar-actions">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
