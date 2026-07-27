export function OperonBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.operon.network/"
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2 transition-colors hover:bg-accent " +
        className
      }
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Powered by
      </span>
      <div className="flex items-center gap-1.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="text-foreground"
        >
          <path
            d="M12 2L4 6.5V17.5L12 22L20 17.5V6.5L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="5.5" r="1.5" fill="currentColor" />
          <circle cx="17.5" cy="14.5" r="1.5" fill="currentColor" />
          <circle cx="6.5" cy="14.5" r="1.5" fill="currentColor" />
        </svg>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Operon
        </span>
      </div>
    </a>
  );
}
