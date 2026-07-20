import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader } from "@/components/ui-bits";
import { toast } from "sonner";
import { Sparkles, PenLine, Camera, Link as LinkIcon, ArrowLeft, Plus, X } from "lucide-react";
import { scanRecipe } from "@/lib/scan-recipe.functions";


export const Route = createFileRoute("/_authenticated/add")({
  component: AddScreen,
});

type Mode = "choose" | "manual" | "scan";

function AddScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");

  return (
    <div>
      {mode === "choose" ? (
        <ChooseView onPick={setMode} />
      ) : mode === "manual" ? (
        <ManualView userId={user.id} onBack={() => setMode("choose")} onDone={(id) => navigate({ to: "/recipe/$id", params: { id } })} />
      ) : (
        <ScanView userId={user.id} onBack={() => setMode("choose")} onDone={(id) => navigate({ to: "/recipe/$id", params: { id } })} />
      )}
    </div>
  );
}

function ChooseView({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <>
      <ScreenHeader eyebrow="Add a recipe" title="Start something new" />
      <div className="px-6 space-y-4 mt-2">
        <button
          onClick={() => onPick("manual")}
          className="w-full text-left rounded-[22px] bg-card border border-ink/5 p-6 transition-transform active:scale-[0.98] group"
        >
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-full bg-ink/5 grid place-items-center shrink-0">
              <PenLine size={20} strokeWidth={1.75} className="text-ink" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-1">Quick</p>
              <h3 className="font-serif text-2xl leading-tight mb-1">Add manually</h3>
              <p className="text-sm text-ink/60">Type in a recipe yourself, ingredient by ingredient.</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onPick("scan")}
          className="w-full text-left rounded-[22px] bg-clay text-paper p-6 transition-transform active:scale-[0.98] relative overflow-hidden"
        >
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-full bg-paper/15 grid place-items-center shrink-0">
              <Sparkles size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Magic</p>
              <h3 className="font-serif text-2xl leading-tight mb-1">Scan with AI</h3>
              <p className="text-sm opacity-80">
                Snap a photo of a recipe or paste text or a link — AI does the rest.
              </p>
            </div>
          </div>
        </button>
      </div>
    </>
  );
}

function ManualView({
  userId,
  onBack,
  onDone,
}: {
  userId: string;
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    description: "",
    prep_time: "",
    servings: "",
  });
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState<string[]>([""]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cleanIngredients = ingredients.map((s) => s.trim()).filter(Boolean).join("\n");
      const cleanInstructions = instructions
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n");
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          ...f,
          ingredients: cleanIngredients,
          instructions: cleanInstructions,
          owner_id: userId,
          source: "manual",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Recipe saved");
      onDone(data.id);
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <BackHeader onBack={onBack} title="New recipe" />
      <form onSubmit={submit} className="px-6 space-y-3 pb-8">
        <Field label="Title" required>
          <input
            required
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            className="input"
            placeholder="Grandma's focaccia"
          />
        </Field>
        <Field label="Description">
          <input
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            className="input"
            placeholder="Bubbly, golden, salt-flecked"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time">
            <input
              value={f.prep_time}
              onChange={(e) => setF({ ...f, prep_time: e.target.value })}
              className="input"
              placeholder="45 min"
            />
          </Field>
          <Field label="Servings">
            <input
              value={f.servings}
              onChange={(e) => setF({ ...f, servings: e.target.value })}
              className="input"
              placeholder="4"
            />
          </Field>
        </div>

        <LineList
          label="Ingredients"
          items={ingredients}
          onChange={setIngredients}
          placeholder="e.g. 500g flour"
          addLabel="Add ingredient"
        />

        <LineList
          label="Instructions"
          items={instructions}
          onChange={setInstructions}
          placeholder="Describe the step…"
          addLabel="Add step"
          numbered
          multiline
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-60 transition-transform active:scale-[0.98]"
        >
          {busy ? "Saving…" : "Save recipe"}
        </button>
      </form>
      <style>{`.input{width:100%;border:1px solid oklch(0.19 0.012 45/0.1);background:var(--card);border-radius:14px;padding:12px 14px;font-size:14px;color:var(--foreground);outline:none;font-family:inherit;resize:vertical}.input:focus{box-shadow:0 0 0 3px oklch(0.52 0.14 40/0.15)}`}</style>
    </div>
  );
}

function LineList({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  numbered,
  multiline,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  numbered?: boolean;
  multiline?: boolean;
}) {
  function update(i: number, v: string) {
    const next = items.slice();
    next[i] = v;
    onChange(next);
  }
  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [""]);
  }
  function add() {
    onChange([...items, ""]);
  }
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-widest text-ink/55 mb-1.5 inline-block">
        {label}
      </span>
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex items-start gap-2">
            {numbered && (
              <div className="mt-3 size-6 rounded-full bg-creme text-ink/60 text-xs grid place-items-center ring-1 ring-black/5 shrink-0">
                {i + 1}
              </div>
            )}
            {multiline ? (
              <textarea
                rows={2}
                value={val}
                onChange={(e) => update(i, e.target.value)}
                className="input flex-1"
                placeholder={placeholder}
              />
            ) : (
              <input
                value={val}
                onChange={(e) => update(i, e.target.value)}
                className="input flex-1"
                placeholder={placeholder}
              />
            )}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="mt-2 size-8 rounded-full bg-creme grid place-items-center ring-1 ring-black/5 text-ink/60 shrink-0"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-clay px-3 py-1.5 rounded-full ring-1 ring-clay/30 hover:bg-clay/5"
      >
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}


function ScanView({
  userId,
  onBack,
  onDone,
}: {
  userId: string;
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit() {
    setBusy(true);
    try {
      const parsed = await scanRecipe({
        data: mode === "photo" ? { imageData: imageData! } : { text },
      });
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          owner_id: userId,
          source: "ai_scan",
          title: parsed.title,
          description: parsed.description,
          ingredients: parsed.ingredients,
          instructions: parsed.instructions,
          prep_time: parsed.prep_time,
          servings: parsed.servings,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Recipe scanned & saved");
      onDone(data.id);
    } catch (err: any) {
      toast.error(err.message ?? "Scan failed");
      setBusy(false);
    }
  }

  const canSubmit =
    !busy && ((mode === "photo" && imageData) || (mode === "text" && text.trim().length > 20));

  return (
    <div>
      <BackHeader onBack={onBack} title="Scan with AI" />
      <div className="px-6">
        <div className="inline-flex bg-creme rounded-full p-1 ring-1 ring-black/5 mb-5">
          <button
            onClick={() => setMode("photo")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${mode === "photo" ? "bg-ink text-paper" : "text-ink/60"}`}
          >
            <Camera size={14} /> Photo
          </button>
          <button
            onClick={() => setMode("text")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${mode === "text" ? "bg-ink text-paper" : "text-ink/60"}`}
          >
            <LinkIcon size={14} /> Text or link
          </button>
        </div>

        {mode === "photo" ? (
          <div className="space-y-3">
            <div className="aspect-[4/5] rounded-[22px] border-2 border-dashed border-ink/15 bg-creme/40 overflow-hidden relative">
              {imageData ? (
                <img src={imageData} alt="Recipe" className="w-full h-full object-cover" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <Camera size={28} className="text-ink/40 mb-3" strokeWidth={1.5} />
                  <p className="font-serif text-xl mb-1">Add a recipe photo</p>
                  <p className="text-xs text-ink/50">AI will read the ingredients & steps.</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-full bg-ink text-paper py-3 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform">
                <Camera size={14} /> Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </label>
              <label className="rounded-full bg-creme text-ink py-3 text-xs font-medium flex items-center justify-center gap-1.5 ring-1 ring-black/5 cursor-pointer active:scale-[0.98] transition-transform">
                <LinkIcon size={14} /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        ) : (
          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a recipe, a link, or a rough set of notes..."
            className="w-full rounded-[18px] border border-ink/10 bg-card p-4 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20 font-mono leading-relaxed"
          />
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-5 w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-50 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Sparkles size={16} /> {busy ? "Reading recipe…" : "Extract with AI"}
        </button>
        <p className="mt-3 text-center text-[11px] text-ink/45">
          You can edit anything after AI drafts it.
        </p>
      </div>
    </div>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="pt-10 px-6 pb-6 flex items-center gap-3">
      <button
        onClick={onBack}
        className="size-9 rounded-full bg-creme grid place-items-center ring-1 ring-black/5"
        aria-label="Back"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
      </button>
      <h1 className="font-serif text-2xl">{title}</h1>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-widest text-ink/55 mb-1.5 inline-block">
        {label} {required && <span className="text-clay">*</span>}
      </span>
      {children}
    </label>
  );
}
