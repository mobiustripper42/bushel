import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-solid";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "default" | "sm";
  dirty?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "default", dirty = false, className = "", type = "button", ...rest },
  ref,
) {
  const classes = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    variant === "primary" && dirty ? "is-dirty" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button ref={ref} type={type} className={classes} {...rest} />;
});
