export function Skeleton({
  width,
  height,
  borderRadius = "var(--radius-md)",
  style,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "var(--app-fill)",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ...style,
      }}
    />
  );
}
