"use client";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
};

export function Switch({ checked, onChange, ariaLabel, disabled = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={"switch" + (checked ? " is-on" : "") + (disabled ? " is-disabled" : "")}
    >
      <span className="switch-thumb" />
    </button>
  );
}
