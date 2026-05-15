"use client";

import { useEffect, useState, useTransition } from "react";

import { saveIntroNote } from "@/actions/save-intro-note";

type IntroNoteCardProps = {
  initialValue: string;
};

export function IntroNoteCard({ initialValue }: IntroNoteCardProps) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== saved;

  // Sync if a server-side change updates initialValue (eg. another tab saves)
  useEffect(() => {
    setSaved(initialValue);
    setValue((v) => (v === saved ? initialValue : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
