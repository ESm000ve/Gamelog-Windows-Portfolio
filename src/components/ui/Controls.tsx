import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type CSSProperties,
} from "react";
import {
  Checkbox as FluentCheckbox,
  Input,
  Select,
  Textarea,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from "@fluentui/react-components";
function controlStyle(style?: CSSProperties): CSSProperties {
  const clean = { ...style };
  for (const key of [
    "borderRadius",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "border",
    "borderColor",
    "outline",
    "boxShadow",
    "appearance",
    "backgroundImage",
    "backgroundRepeat",
    "backgroundPosition",
    "backgroundSize",
    "padding",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "height",
    "minHeight",
  ] as const)
    delete clean[key];
  return clean;
}
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ style, type = "text", size: _size, ...props }, ref) {
    if (["file", "checkbox", "radio", "range", "hidden", "color"].includes(type))
      return <input ref={ref} type={type} style={style} {...props} />;
    const padding = typeof style?.padding === "string" ? style.padding.trim().split(/\s+/) : [];
    const inputStyle: CSSProperties = {
      paddingLeft: style?.paddingLeft ?? (padding.length === 4 ? padding[3] : undefined),
      paddingRight: style?.paddingRight ?? (padding.length === 4 ? padding[1] : undefined),
    };
    return (
      <Input
        {...(props as InputProps)}
        ref={ref}
        type={type as InputProps["type"]}
        size="medium"
        style={controlStyle(style)}
        input={{ style: inputStyle }}
      />
    );
  }
);
export const SelectControl = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectControl({ style, size: _size, children, ...props }, ref) {
    return (
      <Select {...(props as SelectProps)} ref={ref} size="medium" style={controlStyle(style)}>
        {children}
      </Select>
    );
  }
);
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ style, ...props }, ref) {
  return (
    <Textarea {...(props as TextareaProps)} ref={ref} size="medium" style={controlStyle(style)} />
  );
});

export function CheckControl({
  label,
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <FluentCheckbox
      label={label}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(_event, data) => onChange(data.checked === true)}
    />
  );
}
