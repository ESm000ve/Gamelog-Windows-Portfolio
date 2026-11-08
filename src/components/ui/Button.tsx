import React, { forwardRef } from "react";
import { Button as FluentButton, Spinner } from "@fluentui/react-components";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant, size = "md", loading, disabled, style, className, ...props },
  ref
) {
  const actualVariant = variant ?? "secondary";

  const iconOnly =
    Boolean(props["aria-label"]) &&
    React.isValidElement(children) &&
    children.type !== React.Fragment &&
    !["span", "div"].includes(String(children.type));
  const cleanStyle = { ...style };
  for (const property of [
    "borderRadius",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "minHeight",
    "height",
    "padding",
  ] as const)
    delete cleanStyle[property];
  if (
    style?.background?.toString().includes("--app-accent") &&
    (style.color === "white" || style.color === "var(--app-white)")
  )
    cleanStyle.color = "var(--app-accent-foreground)";
  return (
    <FluentButton
      icon={iconOnly ? (children as React.ReactElement) : undefined}
      ref={ref}
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={["app-button", className].filter(Boolean).join(" ")}
      appearance={
        actualVariant === "primary" ? "primary" : actualVariant === "ghost" ? "subtle" : "secondary"
      }
      size={size === "sm" ? "small" : size === "lg" ? "large" : "medium"}
      style={{
        ...(actualVariant === "danger" ? { color: "var(--app-red)" } : {}),
        ...cleanStyle,
      }}
    >
      {iconOnly ? null : (
        <>
          {loading && <Spinner size="tiny" />}
          {children}
        </>
      )}
    </FluentButton>
  );
});
