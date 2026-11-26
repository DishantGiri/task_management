"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Lock, Pin, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createStickyNoteAction,
  deleteStickyNoteAction,
  updateStickyNoteAction,
} from "@/actions/sticky-notes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type StickyColor = "amber" | "lavender" | "mint" | "sky" | "rose";

export interface StickyNoteItem {
  id: string;
  title: string;
  content: string;
  color: StickyColor;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const COLOR_STYLES: Record<
  StickyColor,
  {
    label: string;
    swatch: string;
    card: string;
    border: string;
    darkStyle: string;
  }
> = {
  amber: {
    label: "Yellow",
    swatch: "bg-[#FBBF24]",
    card: "bg-[#FEF9C3]/85 border-[#FDE047] dark:bg-[#3A331C] dark:border-[#6B5B24]",
    border: "border-[#FDE047]/70 dark:border-[#5C4E22]",
    darkStyle: "",
  },
  lavender: {
    label: "Lavender",
    swatch: "bg-[#818CF8]",
    card: "bg-[#EDE9FE]/85 border-[#C4B5FD] dark:bg-[#2B2644] dark:border-[#4C437A]",
    border: "border-[#C4B5FD]/70 dark:border-[#433B6D]",
    darkStyle: "",
  },
  mint: {
    label: "Mint",
    swatch: "bg-[#34D399]",
    card: "bg-[#DCFCE7]/85 border-[#86EFAC] dark:bg-[#1D352B] dark:border-[#2F5B48]",
    border: "border-[#86EFAC]/70 dark:border-[#2B5241]",
    darkStyle: "",
  },
  sky: {
    label: "Sky",
    swatch: "bg-[#38BDF8]",
    card: "bg-[#E0F2FE]/85 border-[#7DD3FC] dark:bg-[#1D3042] dark:border-[#2E506E]",
    border: "border-[#7DD3FC]/70 dark:border-[#2A4965]",
    darkStyle: "",
  },
  rose: {
    label: "Peach",
    swatch: "bg-[#FB7185]",
    card: "bg-[#FFE4E6]/85 border-[#FDA4AF] dark:bg-[#3D232A] dark:border-[#6E3B48]",
    border: "border-[#FDA4AF]/70 dark:border-[#62333F]",
    darkStyle: "",
  },
};

const COLOR_KEYS: StickyColor[] = ["amber", "lavender", "mint", "sky", "rose"];

function StickyCard({
  note,
  onChangeLocal,
  onTogglePin,
  onChangeColor,
  onDelete,
}: {
  note: StickyNoteItem;
  onChangeLocal: (id: string, patch: Partial<StickyNoteItem>) => void;
  onTogglePin: (note: StickyNoteItem) => void;
  onChangeColor: (note: StickyNoteItem, color: StickyColor) => void;
  onDelete: (note: StickyNoteItem) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const lastSavedRef = useRef({ title: note.title, content: note.content });
  const style = COLOR_STYLES[note.color] || COLOR_STYLES.amber;

  // Sync external updates (e.g. initial mount)
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    lastSavedRef.current = { title: note.title, content: note.content };
  }, [note.id]);

  // Silent 800ms auto-save when title or content actually changed
  useEffect(() => {
    if (
      title === lastSavedRef.current.title &&
      content === lastSavedRef.current.content
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      const nextTitle = title;
      const nextContent = content;
      const res = await updateStickyNoteAction({
        id: note.id,
        title: nextTitle,
        content: nextContent,
      });
      if (!res.error) {
        lastSavedRef.current = { title: nextTitle, content: nextContent };
        onChangeLocal(note.id, {
          title: nextTitle,
          content: nextContent,
          updatedAt: res.updatedAt || new Date().toISOString(),
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [title, content, note.id, onChangeLocal]);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 shadow-subtle transition-all hover:shadow-card min-h-[220px]",
        style.card
      )}
    >
      {/* Top Row: Title + Quick Actions */}
      <div className="space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title..."
            className="w-full bg-transparent text-[14.5px] font-semibold text-[#20232B] dark:text-[#F1F4F9] placeholder:text-[#737987]/70 focus:outline-none"
          />
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onTogglePin(note)}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10",
                note.isPinned
                  ? "text-[#635BDB] dark:text-[#B4AFFF]"
                  : "text-[#737987] opacity-60 group-hover:opacity-100"
              )}
              title={note.isPinned ? "Unpin sticky" : "Pin sticky"}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(note)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#737987] opacity-60 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 transition-colors"
              title="Delete sticky"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Jot down a quick thought, reminder, or snippet..."
          className="flex-1 w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#374151] dark:text-[#D5DBE6] placeholder:text-[#737987]/70 focus:outline-none min-h-[120px]"
        />
      </div>

      {/* Bottom Row: Color Swatches + Timestamp */}
      <div
        className={cn(
          "mt-3 pt-2.5 border-t flex items-center justify-between gap-2",
          style.border
        )}
      >
        <div className="flex items-center gap-1.5">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeColor(note, c)}
              aria-label={`Change color to ${COLOR_STYLES[c].label}`}
              title={COLOR_STYLES[c].label}
              className={cn(
                "h-3.5 w-3.5 rounded-full transition-transform hover:scale-110",
                COLOR_STYLES[c].swatch,
                note.color === c &&
                  "ring-2 ring-offset-1 ring-[#20232B]/50 dark:ring-white/70 dark:ring-offset-transparent"
              )}
            />
          ))}
        </div>
        <span className="text-[10.5px] text-[#737987] dark:text-[#9CA3AF]">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>
    </div>
  );
}

export function StickyNotesBoard({
  initialNotes,
}: {
  initialNotes: StickyNoteItem[];
}) {
  const [notes, setNotes] = useState<StickyNoteItem[]>(initialNotes);
  const [selectedColor, setSelectedColor] = useState<StickyColor>("amber");
  const [colorFilter, setColorFilter] = useState<"ALL" | StickyColor>("ALL");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (colorOverride?: StickyColor) => {
    setCreating(true);
    const color = colorOverride || selectedColor;
    const res = await createStickyNoteAction({
      title: "",
      content: "",
      color,
    });
    setCreating(false);
    if (res.error || !res.note) {
      toast.error(res.error || "Could not create sticky note");
      return;
    }
    setNotes((prev) => [res.note!, ...prev]);
  };

  const handleChangeLocal = (id: string, patch: Partial<StickyNoteItem>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n))
    );
  };

  const handleTogglePin = async (note: StickyNoteItem) => {
    const nextPinned = !note.isPinned;
    handleChangeLocal(note.id, { isPinned: nextPinned });
    const res = await updateStickyNoteAction({
      id: note.id,
      isPinned: nextPinned,
    });
    if (res.error) {
      handleChangeLocal(note.id, { isPinned: note.isPinned });
      toast.error(res.error);
    }
  };

  const handleChangeColor = async (
    note: StickyNoteItem,
    color: StickyColor
  ) => {
    if (note.color === color) return;
    const prevColor = note.color;
    handleChangeLocal(note.id, { color });
    const res = await updateStickyNoteAction({ id: note.id, color });
    if (res.error) {
      handleChangeLocal(note.id, { color: prevColor });
      toast.error(res.error);
    }
  };

  const handleDelete = async (note: StickyNoteItem) => {
    const prev = notes;
    setNotes((curr) => curr.filter((n) => n.id !== note.id));
    const res = await deleteStickyNoteAction(note.id);
    if (res.error) {
      setNotes(prev);
      toast.error(res.error);
      return;
    }
    toast.success("Sticky note deleted");
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (colorFilter !== "ALL" && n.color !== colorFilter) return false;
        if (q) {
          return (
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [notes, colorFilter, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
              Sticky Notes
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#EAECF0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#737987] shadow-subtle">
              <Lock className="h-3 w-3 text-[#635BDB]" />
              Private to you
            </span>
          </div>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Quick color-coded personal sticky notes with instant auto-save.
          </p>
        </div>

        {/* Quick Color Picker + New Sticky Button */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#EAECF0] bg-white px-2.5 h-8 shadow-subtle">
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                title={`New sticky color: ${COLOR_STYLES[c].label}`}
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-transform hover:scale-110",
                  COLOR_STYLES[c].swatch,
                  selectedColor === c &&
                    "ring-2 ring-offset-1 ring-[#635BDB] dark:ring-offset-[#22262E]"
                )}
              />
            ))}
          </div>
          <Button
            size="sm"
            disabled={creating}
            onClick={() => handleCreate()}
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New Sticky
          </Button>
        </div>
      </div>

      {/* Search & Color Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[200px] sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sticky notes..."
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-md border border-[#EAECF0] bg-white p-0.5 shadow-subtle">
          <button
            type="button"
            onClick={() => setColorFilter("ALL")}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
              colorFilter === "ALL"
                ? "bg-[#F0EFFF] text-[#5148C9]"
                : "text-[#737987] hover:text-[#20232B]"
            )}
          >
            All ({notes.length})
          </button>
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColorFilter(c)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs font-medium transition-colors",
                colorFilter === c
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
              title={COLOR_STYLES[c].label}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", COLOR_STYLES[c].swatch)} />
              <span className="hidden sm:inline">{COLOR_STYLES[c].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Notes Wall */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D9DEE7] bg-white py-16 text-center">
          <StickyNote className="mx-auto h-7 w-7 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">
            {notes.length === 0
              ? "No sticky notes yet"
              : "No sticky notes match your filter"}
          </p>
          <p className="mt-1 text-xs text-[#737987] max-w-sm mx-auto">
            Create colorful quick-capture sticky notes for reminders, snippets,
            and daily thoughts — completely private to you.
          </p>
          {notes.length === 0 && (
            <Button
              size="sm"
              className="mt-4"
              disabled={creating}
              onClick={() => handleCreate("amber")}
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Sticky Note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredNotes.map((note) => (
            <StickyCard
              key={note.id}
              note={note}
              onChangeLocal={handleChangeLocal}
              onTogglePin={handleTogglePin}
              onChangeColor={handleChangeColor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
