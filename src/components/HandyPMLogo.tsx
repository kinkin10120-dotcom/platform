import { CSSProperties } from "react";

export default function HandyPMLogo({
  className,
  style,
  size = 32,
}: {
  className?: string;
  style?: CSSProperties;
  size?: number;
}) {
  const fontSize = size;
  const strokeWidth = Math.max(1.5, size * 0.055);

  return (
    <span
      className={className}
      style={{
        fontFamily: "'Nunito', 'Rounded Mplus 1c', system-ui, sans-serif",
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        display: "inline-flex",
        alignItems: "baseline",
        userSelect: "none",
        ...style,
      }}
    >
      <span style={{ color: "#F5C200" }}>handy</span>
      <span
        style={{
          color: "transparent",
          WebkitTextStroke: `${strokeWidth}px white`,
        }}
      >
        PM
      </span>
    </span>
  );
}
