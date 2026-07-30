import { useEffect, useRef, useState } from "react";

/**
 * Price cell that briefly flashes teal/amber whenever the value ticks.
 */
export function LivePrice({
  price,
  currency,
  className = "",
}: {
  price: number | null;
  currency?: string | null;
  className?: string;
}) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (price === null) return;
    if (prev.current !== null && price !== prev.current) {
      setFlash(price > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 700);
      prev.current = price;
      return () => clearTimeout(t);
    }
    prev.current = price;
  }, [price]);

  const sym = !currency || currency === "USD" ? "$" : "";
  return (
    <span
      className={
        "tabular-nums rounded px-1 transition-colors duration-500 " +
        (flash === "up"
          ? "bg-tailwind/20 text-tailwind"
          : flash === "down"
            ? "bg-headwind/20 text-headwind"
            : "") +
        " " +
        className
      }
    >
      {price === null
        ? "n/a"
        : `${sym}${price.toFixed(2)}${sym ? "" : ` ${currency}`}`}
    </span>
  );
}
