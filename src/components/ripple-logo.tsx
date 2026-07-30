import logoAsset from "@/assets/market-ripple-logo.jpg.asset.json";

export function RippleLogo({ size = 34 }: { size?: number }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="Market Ripple Effect logo"
        width={size}
        height={size}
        className="rounded-md object-cover shrink-0"
        style={{ width: size, height: size }}
      />
      <span className="flex flex-col leading-none">
        <span className="font-semibold tracking-tight text-foreground text-sm">
          MARKET
        </span>
        <span className="text-[11px] tracking-[0.18em] text-primary">
          RIPPLE EFFECT
        </span>
      </span>
    </div>
  );
}
