"use client";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
};

export function Switch({ checked, onChange, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={"switch" + (checked ? " is-on" : "")}
    >
      <span className="switch-thumb" />
    </button>
  );
}
