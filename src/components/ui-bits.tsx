export function ScreenHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="pt-10 px-6 pb-4 flex justify-between items-start gap-3">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-ink/50 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-3xl leading-tight text-balance">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Avatar({ name, className = "" }: { name?: string | null; className?: string }) {
  const initials =
    (name ?? "?")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <div
      className={`rounded-full bg-clay/10 ring-1 ring-black/5 grid place-items-center text-clay font-medium text-[11px] ${className}`}
    >
      {initials}
    </div>
  );
}

export function RecipeThumb({ title }: { title: string }) {
  const seed = title.charCodeAt(0) + title.length;
  const hues = ["from-clay/25 to-clay/5", "from-moss/25 to-moss/5", "from-ink/15 to-ink/5"];
  const cls = hues[seed % hues.length];
  return (
    <div
      className={`w-full h-full rounded-[12px] bg-gradient-to-br ${cls} outline-1 -outline-offset-1 outline-black/5 grid place-items-center`}
    >
      <span className="font-serif text-3xl text-ink/40">{title.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
