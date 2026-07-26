export function RippleLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center gap-2">
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span className="absolute inset-0 rounded-full border border-primary/60 ripple-ring" />
        <span className="absolute inset-0 rounded-full border border-primary/40 ripple-ring ripple-ring-2" />
        <span className="absolute inset-0 rounded-full border border-primary/20 ripple-ring ripple-ring-3" />
        <span
          className="absolute rounded-full bg-primary"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      <span className="font-semibold tracking-tight text-foreground">
        The Ripple Effect
      </span>
    </div>
  );
}
