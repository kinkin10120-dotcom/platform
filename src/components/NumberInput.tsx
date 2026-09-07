"use client";

import { useEffect, useState } from "react";

// 숫자를 입력받는 칸. 겉보기엔 평범한 input이지만, 화면에 보여줄 문자열을 따로 들고 있는 게
// 핵심이다.
//
// 값을 숫자(state)로만 들고 매 타이핑마다 Number()로 바꿔서 되돌려 그리면, "2."을 치는 순간
// Number("2.")가 2가 되어 점이 지워진다 — 소수점을 아예 입력할 수 없다("12.5"를 치려면
// 반드시 "12."라는 중간 상태를 지나가야 하기 때문). 그래서 타이핑 중인 문자열은 그대로 두고,
// 바깥에는 해석된 숫자만 올려보낸다.
export default function NumberInput({
  value,
  onChange,
  decimal = true,
  placeholder,
  className,
  title,
}: {
  value: number;
  onChange: (n: number) => void;
  // false면 정수만 (수량 등)
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");

  // 바깥 값이 "내가 보여주는 문자열이 뜻하는 수"와 달라졌을 때만 다시 맞춘다. 같은 수면
  // 건드리지 않아야 "2." 같은 입력 중간 상태가 살아남는다.
  useEffect(() => {
    if ((Number(text) || 0) !== (value || 0)) setText(value ? String(value) : "");
    // text는 일부러 의존성에서 뺀다 — 타이핑할 때마다 이 효과가 돌면 위 비교가 무의미해진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
        setText(cleaned);
        onChange(Number(cleaned) || 0);
      }}
      inputMode={decimal ? "decimal" : "numeric"}
      placeholder={placeholder}
      title={title}
      className={className}
    />
  );
}
