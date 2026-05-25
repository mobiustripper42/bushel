"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { saveIntroNote } from "@/actions/save-intro-note";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";

type IntroNoteCardProps = {
  initialValue: string;
};

export function IntroNoteCard({ initialValue }: IntroNoteCardProps) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== saved;
  // #129 — guard unsaved typing. Save handler updates `saved`, so dirty
  // flips back to false on success and the guard disarms.
  useUnsavedChangesGuard(dirty && !pending);

  // Sync if a server-side change updates initialValue (e.g. another tab
  // saves, or revalidatePath after our own save). We only overwrite local
  // edits when the user hasn't typed anything new — `saved` is captured in
  // a ref so the effect can be tied to `initialValue` alone.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    setSaved(initialValue);
    setValue((v) => (v === savedRef.current ? initialValue : v));
  }, [initialValue]);

  function handleSave() {
    setError(null);
    const next = value;
    startTransition(async () => {
      const result = await saveIntroNote(next);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(next);
      }
    });
  }

  return (
    <div className="send-card" aria-label="Intro note for weekly update">
      <div className="send-field">
        <label className="send-label" htmlFor="intro-note">
          This week&rsquo;s intro note
          <span className="send-label-hint">
            optional · injected between the greeting and the order link
          </span>
        </label>
        <textarea
          id="intro-note"
          className="send-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="A line or two from you. What's good this week, what to ask about."
        />
        <div className="send-charcount">
          <span>{value.length} characters</span>
          <span>{dirty ? "Unsaved changes" : "Saved"}</span>
        </div>
      </div>
      <div className="send-card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save intro"}
        </button>
        {error && (
          <span role="alert" className="send-row-error">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
