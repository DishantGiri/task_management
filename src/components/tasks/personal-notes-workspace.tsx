"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useEditor,
  EditorContent,
  Node,
  mergeAttributes,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import {
  ArrowLeft,
  Bold,
  Check,
  CheckSquare,
  Code,
  Code2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Minus,
  Pin,
  Plus,
  Quote,
  Redo,
  Search,
  Share2,
  StickyNote,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { PersonalNoteItem } from "@/types";
import {
  createPersonalNoteAction,
  deletePersonalNoteAction,
  updateNoteSharesAction,
  updatePersonalNoteAction,
} from "@/actions/personal-notes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/shared/pagination-bar";

interface ShareableUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
}

const NoteImage = Node.create({
  name: "image",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes({ loading: "lazy" }, HTMLAttributes),
    ];
  },
});

const LinkPreviewCard = Node.create({
  name: "linkPreview",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      favicon: { default: "" },
      siteName: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[data-link-preview]",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return {
            url: el.getAttribute("href") || el.getAttribute("data-url") || "",
            title: el.getAttribute("data-title") || "",
            description: el.getAttribute("data-description") || "",
            image: el.getAttribute("data-image") || "",
            favicon: el.getAttribute("data-favicon") || "",
            siteName: el.getAttribute("data-site") || "",
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const url = String(HTMLAttributes.url || "");
    const title = String(HTMLAttributes.title || url);
    const description = String(HTMLAttributes.description || "");
    const image = String(HTMLAttributes.image || "");
    const favicon = String(HTMLAttributes.favicon || "");
    const siteName = String(HTMLAttributes.siteName || "");

    const textChildren: unknown[] = [
      ["div", { class: "meridian-lp-title" }, title],
    ];
    if (description) {
      textChildren.push(["div", { class: "meridian-lp-desc" }, description]);
    }
    const metaChildren: unknown[] = [];
    if (favicon) {
      metaChildren.push([
        "img",
        { src: favicon, alt: "", class: "meridian-lp-favicon" },
      ]);
    }
    metaChildren.push([
      "span",
      { class: "meridian-lp-url" },
      siteName ? `${siteName} · ${url}` : url,
    ]);
    textChildren.push(["div", { class: "meridian-lp-meta" }, ...metaChildren]);

    const cardChildren: unknown[] = [
      ["div", { class: "meridian-lp-body" }, ...textChildren],
    ];
    if (image) {
      cardChildren.push([
        "div",
        { class: "meridian-lp-thumb" },
        ["img", { src: image, alt: title, loading: "lazy" }],
      ]);
    }

    return [
      "a",
      mergeAttributes({
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        contenteditable: "false",
        "data-link-preview": "true",
        "data-url": url,
        "data-title": title,
        "data-description": description,
        "data-image": image,
        "data-favicon": favicon,
        "data-site": siteName,
        class: "meridian-link-preview",
      }),
      ...cardChildren,
    ] as unknown as readonly [string, ...unknown[]];
  },
});

function isImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    if (
      /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(url.pathname)
    ) {
      return true;
    }
    if (
      /(images\.unsplash\.com|i\.imgur\.com|pbs\.twimg\.com|i\.redd\.it|lh3\.googleusercontent\.com|images\.pexels\.com)/i.test(
        url.hostname
      )
    ) {
      return true;
    }
    if (url.searchParams.has("format") && /png|jpg|jpeg|webp|gif/i.test(url.searchParams.get("format") || "")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isSingleHttpUrl(raw: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(raw.trim());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(text: string): string {
  const codeTokens: string[] = [];
  let out = escapeHtml(text);

  // Protect inline code spans first
  out = out.replace(/`([^`]+)`/g, (_m, code) => {
    const idx = codeTokens.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${idx}\u0000`;
  });

  // Images ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" />'
  );
  // Links [label](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Bold **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Strikethrough ~~text~~
  out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  // Italic *text*
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Restore inline code tokens
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx) => codeTokens[Number(idx)] ?? "");
  return out;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-") || !trimmed.includes("|")) return false;
  return /^\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)+\|?$/.test(trimmed);
}

function splitPipeRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function parseMarkdownOrTableToHtml(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const rawLines = raw.replace(/\r\n/g, "\n").split("\n");
  const nonEmptyLines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (nonEmptyLines.length === 0) return null;

  // 1. Pure tab-separated table (TSV from spreadsheets / plain text)
  if (
    nonEmptyLines.length >= 2 &&
    nonEmptyLines.every((l) => l.includes("\t"))
  ) {
    const rows = nonEmptyLines.map((l) => l.split("\t").map((c) => c.trim()));
    const colCount = Math.max(...rows.map((r) => r.length));
    if (colCount >= 2) {
      const ths = Array.from({ length: colCount })
        .map((_, i) => `<th><p>${renderInlineMarkdown(rows[0][i] ?? "")}</p></th>`)
        .join("");
      const trs = rows
        .slice(1)
        .map(
          (row) =>
            `<tr>${Array.from({ length: colCount })
              .map((_, i) => `<td><p>${renderInlineMarkdown(row[i] ?? "")}</p></td>`)
              .join("")}</tr>`
        )
        .join("");
      return `<table><tbody><tr>${ths}</tr>${trs}</tbody></table>`;
    }
  }

  // 2. Detect if text contains Markdown structures (headings, pipe tables, lists, code fences, quotes)
  let hasMarkdownStructure =
    /^#{1,3}\s+\S/m.test(trimmed) ||
    /^```/m.test(trimmed) ||
    /^[-*+]\s+\[[ xX]\]\s+/m.test(trimmed) ||
    /^[-*+]\s+\S/m.test(trimmed) ||
    /^\d+\.\s+\S/m.test(trimmed) ||
    /^>\s+\S/m.test(trimmed);

  if (!hasMarkdownStructure) {
    for (let i = 0; i < rawLines.length - 1; i++) {
      if (rawLines[i].includes("|") && isTableSeparatorLine(rawLines[i + 1])) {
        hasMarkdownStructure = true;
        break;
      }
    }
  }

  if (!hasMarkdownStructure) return null;

  // 3. Full block-by-block Markdown -> Tiptap HTML conversion
  const blocks: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const t = line.trim();

    if (!t) {
      i++;
      continue;
    }

    // Fenced code block
    if (t.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // skip closing ```
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // Markdown pipe table (header row + separator row + 0..N body rows)
    if (
      t.includes("|") &&
      i + 1 < rawLines.length &&
      isTableSeparatorLine(rawLines[i + 1])
    ) {
      const headers = splitPipeRow(t);
      const colCount = headers.length;
      i += 2;
      const bodyRows: string[][] = [];
      while (
        i < rawLines.length &&
        rawLines[i].trim().includes("|") &&
        !isTableSeparatorLine(rawLines[i])
      ) {
        bodyRows.push(splitPipeRow(rawLines[i]));
        i++;
      }
      const ths = headers
        .map((h) => `<th><p>${renderInlineMarkdown(h)}</p></th>`)
        .join("");
      const trs = bodyRows
        .map(
          (row) =>
            `<tr>${Array.from({ length: colCount })
              .map((_, idx) => `<td><p>${renderInlineMarkdown(row[idx] ?? "")}</p></td>`)
              .join("")}</tr>`
        )
        .join("");
      blocks.push(`<table><tbody><tr>${ths}</tr>${trs}</tbody></table>`);
      continue;
    }

    // Headings H1 - H3
    const headingMatch = t.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push("<hr>");
      i++;
      continue;
    }

    // Blockquote
    if (t.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith(">")) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        `<blockquote>${quoteLines
          .map((ql) => `<p>${renderInlineMarkdown(ql)}</p>`)
          .join("")}</blockquote>`
      );
      continue;
    }

    // Task checklist (- [ ] / - [x])
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(t)) {
      const items: string[] = [];
      while (i < rawLines.length && /^[-*+]\s+\[[ xX]\]\s+/.test(rawLines[i].trim())) {
        const m = rawLines[i].trim().match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
        if (m) {
          const checked = m[1].toLowerCase() === "x" ? "true" : "false";
          items.push(
            `<li data-type="taskItem" data-checked="${checked}"><p>${renderInlineMarkdown(
              m[2]
            )}</p></li>`
          );
        }
        i++;
      }
      blocks.push(`<ul data-type="taskList">${items.join("")}</ul>`);
      continue;
    }

    // Bullet list
    if (/^[-*+]\s+/.test(t)) {
      const items: string[] = [];
      while (
        i < rawLines.length &&
        /^[-*+]\s+/.test(rawLines[i].trim()) &&
        !/^[-*+]\s+\[[ xX]\]\s+/.test(rawLines[i].trim())
      ) {
        const content = rawLines[i].trim().replace(/^[-*+]\s+/, "");
        items.push(`<li><p>${renderInlineMarkdown(content)}</p></li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        const content = rawLines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(`<li><p>${renderInlineMarkdown(content)}</p></li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Standard paragraph
    blocks.push(`<p>${renderInlineMarkdown(t)}</p>`);
    i++;
  }

  return blocks.length > 0 ? blocks.join("") : null;
}

function stripHtmlPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoteHtml(html: string): string {
  const trimmed = (html || "").trim();
  return trimmed === "<p></p>" ? "" : trimmed;
}

function getDraftStorageKey(noteId: string) {
  return `meridian-note-draft:${noteId}`;
}

function readLocalDraft(
  noteId: string
): { title: string; content: string; savedAt: string } | null {
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.title === "string" &&
      typeof parsed?.content === "string" &&
      typeof parsed?.savedAt === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLocalDraft(noteId: string, title: string, content: string) {
  try {
    window.localStorage.setItem(
      getDraftStorageKey(noteId),
      JSON.stringify({ title, content, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore quota / storage errors
  }
}

function clearLocalDraft(noteId: string) {
  try {
    window.localStorage.removeItem(getDraftStorageKey(noteId));
  } catch {
    // ignore
  }
}

export function PersonalNotesWorkspace({
  initialNotes,
  shareableUsers = [],
  initialOpenNoteId = null,
}: {
  initialNotes: PersonalNoteItem[];
  shareableUsers?: ShareableUser[];
  initialOpenNoteId?: string | null;
}) {
  const [notes, setNotes] = useState<PersonalNoteItem[]>(initialNotes);
  const [openNoteId, setOpenNoteId] = useState<string | null>(() => {
    if (
      initialOpenNoteId &&
      initialNotes.some((n) => n.id === initialOpenNoteId)
    ) {
      return initialOpenNoteId;
    }
    return null;
  });

  // Listing state
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [scope, setScope] = useState<"ALL" | "MINE" | "SHARED">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const backgroundSavingRef = useRef<boolean>(false);
  const latestDraftRef = useRef<{ title: string; content: string }>({
    title: "",
    content: "",
  });
  const serverSnapshotRef = useRef<{
    id: string;
    title: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    setPortalMounted(true);
    try {
      const savedPref = window.localStorage.getItem("meridian-notes-autosave");
      if (savedPref === "false") {
        setAutoSave(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleToggleAutoSave = (checked: boolean) => {
    setAutoSave(checked);
    try {
      window.localStorage.setItem("meridian-notes-autosave", String(checked));
    } catch {
      // ignore
    }
  };

  // Share dialog state
  const [shareModalNote, setShareModalNote] =
    useState<PersonalNoteItem | null>(null);
  const [shareDraft, setShareDraft] = useState<
    Record<string, { selected: boolean; canEdit: boolean }>
  >({});
  const [shareSearch, setShareSearch] = useState("");
  const [savingShares, setSavingShares] = useState(false);

  const openNote = useMemo(
    () => notes.find((n) => n.id === openNoteId) ?? null,
    [notes, openNoteId]
  );

  const [draftTitle, setDraftTitle] = useState(openNote?.title ?? "");
  const [draftContent, setDraftContent] = useState(openNote?.content ?? "");
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const editorRef = useRef<Editor | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: openNote ? openNote.canEdit : true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Start writing your note... Use headings, tables, checklists, code blocks, quotes, or paste Markdown directly.",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Highlight,
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      NoteImage,
      LinkPreviewCard,
    ],
    editorProps: {
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;

        // 1. Pasted image file / screenshot from clipboard
        const files = Array.from(event.clipboardData?.files ?? []);
        const imageFile = files.find((f) => f.type.startsWith("image/"));
        if (imageFile) {
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const src = typeof reader.result === "string" ? reader.result : "";
            if (src && editorRef.current) {
              editorRef.current
                .chain()
                .focus()
                .insertContent({ type: "image", attrs: { src, alt: imageFile.name } })
                .run();
            }
          };
          reader.readAsDataURL(imageFile);
          return true;
        }

        const html = event.clipboardData?.getData("text/html") || "";
        // If clipboard already contains an HTML <table> or <img> (Excel, Google Sheets, Notion, web),
        // let Tiptap's native extensions parse it directly.
        if (/<table[\s>]/i.test(html) || /<img[\s>]/i.test(html)) {
          return false;
        }

        const text = (event.clipboardData?.getData("text/plain") || "").trim();

        // 2. Pasted direct image URL -> show clickable link + inline image preview below
        if (isImageUrl(text)) {
          event.preventDefault();
          ed.chain()
            .focus()
            .insertContent([
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text,
                    marks: [
                      {
                        type: "link",
                        attrs: {
                          href: text,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                      },
                    ],
                  },
                ],
              },
              { type: "image", attrs: { src: text, alt: "Image" } },
              { type: "paragraph" },
            ])
            .run();
          return true;
        }

        // 3. Pasted standard URL -> insert BOTH the clickable link AND the rich preview card below it
        if (isSingleHttpUrl(text)) {
          event.preventDefault();
          let hostname = text;
          try {
            hostname = new URL(text).hostname.replace(/^www\./i, "");
          } catch {
            // fallback
          }
          const initialFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
            hostname
          )}&sz=64`;

          ed.chain()
            .focus()
            .insertContent([
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text,
                    marks: [
                      {
                        type: "link",
                        attrs: {
                          href: text,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                      },
                    ],
                  },
                ],
              },
              {
                type: "linkPreview",
                attrs: {
                  url: text,
                  title: hostname,
                  description: "Loading link preview...",
                  image: "",
                  favicon: initialFavicon,
                  siteName: hostname,
                },
              },
              { type: "paragraph" },
            ])
            .run();

          // Fetch OpenGraph preview metadata asynchronously and hydrate the bookmark card
          fetch(`/api/link-preview?url=${encodeURIComponent(text)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((meta) => {
              const liveEditor = editorRef.current;
              if (!liveEditor || !meta) return;

              // If the URL turned out to be an image response, replace with inline image
              if (meta.isImage && meta.image) {
                liveEditor.state.doc.descendants((node, pos) => {
                  if (
                    node.type.name === "linkPreview" &&
                    node.attrs.url === text
                  ) {
                    const tr = liveEditor.state.tr.replaceWith(
                      pos,
                      pos + node.nodeSize,
                      liveEditor.schema.nodes.image.create({
                        src: meta.image,
                        alt: meta.title || "Image",
                      })
                    );
                    liveEditor.view.dispatch(tr);
                    return false;
                  }
                  return true;
                });
                return;
              }

              liveEditor.state.doc.descendants((node, pos) => {
                if (
                  node.type.name === "linkPreview" &&
                  node.attrs.url === text
                ) {
                  const tr = liveEditor.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    title: meta.title || hostname,
                    description: meta.description || "",
                    image: meta.image || "",
                    favicon: meta.favicon || initialFavicon,
                    siteName: meta.siteName || hostname,
                  });
                  liveEditor.view.dispatch(tr);
                  return false;
                }
                return true;
              });
            })
            .catch(() => {
              const liveEditor = editorRef.current;
              if (!liveEditor) return;
              liveEditor.state.doc.descendants((node, pos) => {
                if (
                  node.type.name === "linkPreview" &&
                  node.attrs.url === text &&
                  node.attrs.description === "Loading link preview..."
                ) {
                  const tr = liveEditor.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    description: "",
                  });
                  liveEditor.view.dispatch(tr);
                  return false;
                }
                return true;
              });
            });

          return true;
        }

        // 4. Pasted Markdown document / pipe tables / TSV tables
        const convertedHtml = parseMarkdownOrTableToHtml(text);
        if (convertedHtml) {
          event.preventDefault();
          ed.chain().focus().insertContent(convertedHtml).run();
          return true;
        }
        return false;
      },
    },
    content: openNote?.content ?? "",
    onUpdate: ({ editor: ed }) => {
      const nextHtml = ed.getHTML();
      setDraftContent(nextHtml);
      const snap = serverSnapshotRef.current;
      const changed =
        !snap ||
        latestDraftRef.current.title !== snap.title ||
        normalizeNoteHtml(nextHtml) !== snap.content;
      setHasUnsaved(changed);
      if (!changed && snap) {
        clearLocalDraft(snap.id);
      }
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Auto-resize the Notion-style title textarea so descenders (y, g, j, p) are never clipped
  useEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draftTitle, openNote?.id]);

  // Sync editor when opening a note (restore newer client-side draft if present)
  useEffect(() => {
    if (!openNote) {
      serverSnapshotRef.current = null;
      setDraftTitle("");
      setDraftContent("");
      setHasUnsaved(false);
      return;
    }

    const serverTitle = openNote.title.trim() || "Untitled Note";
    const serverContent = normalizeNoteHtml(openNote.content);
    serverSnapshotRef.current = {
      id: openNote.id,
      title: serverTitle,
      content: serverContent,
    };

    const localDraft = openNote.canEdit ? readLocalDraft(openNote.id) : null;
    const hasNewerLocal =
      localDraft &&
      ((localDraft.title.trim() || "Untitled Note") !== serverTitle ||
        normalizeNoteHtml(localDraft.content) !== serverContent) &&
      new Date(localDraft.savedAt).getTime() >=
        new Date(openNote.updatedAt).getTime();

    const initialTitle = hasNewerLocal ? localDraft.title : openNote.title;
    const initialContent = hasNewerLocal
      ? localDraft.content
      : openNote.content;

    setDraftTitle(initialTitle);
    setDraftContent(initialContent);
    setHasUnsaved(Boolean(hasNewerLocal));

    if (editor) {
      editor.setEditable(openNote.canEdit);
      if (
        normalizeNoteHtml(editor.getHTML()) !== normalizeNoteHtml(initialContent)
      ) {
        editor.commands.setContent(initialContent || "", {
          emitUpdate: false,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNote?.id, openNote?.canEdit, editor]);

  // Keep latest draft ref in sync so mid-save keystrokes are never dropped
  useEffect(() => {
    latestDraftRef.current = {
      title: draftTitle.trim() || "Untitled Note",
      content: draftContent,
    };
  }, [draftTitle, draftContent]);

  const handleSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!openNote || !openNote.canEdit) return true;
      const savedTitle = draftTitle.trim() || "Untitled Note";
      const savedHtml = editor ? editor.getHTML() : draftContent;
      const normalizedHtml = normalizeNoteHtml(savedHtml);

      // Skip API call completely if nothing has actually changed vs server snapshot
      const snap = serverSnapshotRef.current;
      if (
        snap &&
        snap.id === openNote.id &&
        snap.title === savedTitle &&
        snap.content === normalizedHtml
      ) {
        clearLocalDraft(openNote.id);
        setHasUnsaved(false);
        return true;
      }

      if (opts?.silent) {
        if (backgroundSavingRef.current) return true;
        backgroundSavingRef.current = true;
      } else {
        setSaving(true);
      }

      const res = await updatePersonalNoteAction({
        id: openNote.id,
        title: savedTitle,
        content: savedHtml,
      });

      if (opts?.silent) {
        backgroundSavingRef.current = false;
      } else {
        setSaving(false);
      }

      if (res.error) {
        if (!opts?.silent) toast.error(res.error);
        return false;
      }

      const updatedAt = res.updatedAt || new Date().toISOString();
      serverSnapshotRef.current = {
        id: openNote.id,
        title: savedTitle,
        content: normalizedHtml,
      };
      clearLocalDraft(openNote.id);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === openNote.id
            ? {
                ...n,
                title: savedTitle,
                content: savedHtml,
                updatedAt,
              }
            : n
        )
      );

      // Only mark clean if user didn't type more while the save was in-flight
      if (
        latestDraftRef.current.title === savedTitle &&
        normalizeNoteHtml(latestDraftRef.current.content) === normalizedHtml
      ) {
        setHasUnsaved(false);
      }

      if (!opts?.silent) {
        toast.success("Note saved");
      }
      return true;
    },
    [openNote, editor, draftContent, draftTitle]
  );

  // Silent 1-second server auto-save when Auto-save toggle is ON (no loading indicator, skips if unchanged)
  useEffect(() => {
    if (!autoSave || !openNote || !openNote.canEdit || !hasUnsaved) {
      return;
    }
    const timer = setTimeout(() => {
      handleSave({ silent: true });
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoSave, openNote, hasUnsaved, draftTitle, draftContent, handleSave]);

  // Flush unsaved draft to localStorage on tab close / reload so nothing is lost
  useEffect(() => {
    if (!autoSave || !openNote || !openNote.canEdit || !hasUnsaved) return;
    const onBeforeUnload = () => {
      const savedTitle = draftTitle.trim() || "Untitled Note";
      const savedHtml = editorRef.current
        ? editorRef.current.getHTML()
        : draftContent;
      writeLocalDraft(openNote.id, savedTitle, savedHtml);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autoSave, openNote, hasUnsaved, draftTitle, draftContent]);

  // Sync any pending changes silently when closing the note
  const handleCloseNote = useCallback(() => {
    if (openNote && openNote.canEdit && autoSave && hasUnsaved) {
      void handleSave({ silent: true });
    }
    setOpenNoteId(null);
  }, [openNote, autoSave, hasUnsaved, handleSave]);

  // Lock background scroll while full-screen note editor is open
  useEffect(() => {
    if (!openNote) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openNote]);

  // Ctrl+S / Cmd+S shortcut + Esc to close full-screen
  useEffect(() => {
    if (!openNote) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (openNote.canEdit && hasUnsaved && !saving) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openNote, hasUnsaved, saving, handleSave]);

  const handleCreateNote = async () => {
    setCreating(true);
    const res = await createPersonalNoteAction({
      title: "Untitled Note",
      icon: "📝",
      content: "",
    });
    setCreating(false);
    if (res.error || !res.note) {
      toast.error(res.error || "Could not create note");
      return;
    }
    setNotes((prev) => [res.note!, ...prev]);
    setOpenNoteId(res.note.id);
  };

  const handleTogglePin = async (
    note: PersonalNoteItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    if (!note.isOwner) return;
    const nextPinned = !note.isPinned;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, isPinned: nextPinned } : n))
    );
    const res = await updatePersonalNoteAction({
      id: note.id,
      isPinned: nextPinned,
    });
    if (res.error) {
      toast.error(res.error);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, isPinned: note.isPinned } : n
        )
      );
    }
  };

  const handleDeleteNote = async (
    note: PersonalNoteItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    if (!note.isOwner) return;
    const res = await deletePersonalNoteAction(note.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (openNoteId === note.id) {
      setOpenNoteId(null);
    }
    toast.success("Note deleted");
  };

  const openShareModal = (note: PersonalNoteItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const draft: Record<string, { selected: boolean; canEdit: boolean }> = {};
    for (const s of note.shares) {
      draft[s.userId] = { selected: true, canEdit: s.canEdit };
    }
    setShareDraft(draft);
    setShareSearch("");
    setShareModalNote(note);
  };

  const handleSaveShares = async () => {
    if (!shareModalNote) return;
    setSavingShares(true);
    const payload = Object.entries(shareDraft)
      .filter(([, v]) => v.selected)
      .map(([userId, v]) => ({ userId, canEdit: v.canEdit }));

    const res = await updateNoteSharesAction({
      noteId: shareModalNote.id,
      shares: payload,
    });
    setSavingShares(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    setNotes((prev) =>
      prev.map((n) =>
        n.id === shareModalNote.id ? { ...n, shares: res.shares || [] } : n
      )
    );
    setShareModalNote(null);
    toast.success("Sharing settings updated");
  };

  const handleSetLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt(
      "Enter URL (leave empty to remove link):",
      previousUrl
    );
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const safeUrl = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: safeUrl })
      .run();
  };

  const handleInsertImage = () => {
    if (!editor) return;
    const url = window.prompt("Paste image URL (https://...):");
    if (!url || !url.trim()) return;
    const safeUrl = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;
    editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src: safeUrl, alt: "Image" } })
      .run();
  };

  const myCount = notes.filter((n) => n.isOwner).length;
  const sharedCount = notes.filter((n) => !n.isOwner).length;

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (scope === "MINE" && !n.isOwner) return false;
        if (scope === "SHARED" && n.isOwner) return false;
        if (q) {
          return (
            n.title.toLowerCase().includes(q) ||
            stripHtmlPreview(n.content).toLowerCase().includes(q) ||
            n.owner.name.toLowerCase().includes(q)
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
  }, [notes, scope, search]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedNotes = filteredNotes.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const filteredShareUsers = useMemo(() => {
    const q = shareSearch.trim().toLowerCase();
    if (!q) return shareableUsers;
    return shareableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q)
    );
  }, [shareableUsers, shareSearch]);

  const ToolbarBtn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors",
        active
          ? "bg-[#F0EFFF] text-[#5148C9] font-semibold"
          : "text-[#525866] hover:bg-[#F3F4F6] hover:text-[#20232B]"
      )}
    >
      {children}
    </button>
  );

  return (
    <>
      <div className="space-y-4">
      {/* Top Controls Bar: Scope Tabs, Search, Card/List Toggle, New Note */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5 shadow-subtle">
            {(
              [
                { key: "ALL", label: `All (${notes.length})` },
                { key: "MINE", label: `My Notes (${myCount})` },
                { key: "SHARED", label: `Shared with Me (${sharedCount})` },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setScope(t.key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                  scope === t.key
                    ? "bg-[#F0EFFF] text-[#5148C9]"
                    : "text-[#737987] hover:text-[#20232B]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notes..."
              className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Card / List View Switcher */}
          <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5 shadow-subtle">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "card"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          <Button size="sm" disabled={creating} onClick={handleCreateNote}>
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New Note
          </Button>
        </div>
      </div>

      {/* Notes Listing: Card Grid or List Format */}
      {paginatedNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D9DEE7] bg-white py-16 text-center">
          <StickyNote className="mx-auto h-7 w-7 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">
            {notes.length === 0
              ? "No notes yet"
              : "No notes match your filter"}
          </p>
          <p className="mt-1 text-xs text-[#737987] max-w-sm mx-auto">
            Create rich Notion-style notes and optionally share them with
            teammates.
          </p>
          {notes.length === 0 && (
            <Button
              size="sm"
              className="mt-4"
              disabled={creating}
              onClick={handleCreateNote}
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Note
            </Button>
          )}
        </div>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedNotes.map((note) => {
            const preview = stripHtmlPreview(note.content);
            return (
              <div
                key={note.id}
                onClick={() => setOpenNoteId(note.id)}
                className={cn(
                  "group flex flex-col justify-between rounded-xl border bg-white p-4 shadow-subtle cursor-pointer transition-all hover:border-[#635BDB]/50 hover:shadow-card min-h-[175px]",
                  note.isPinned ? "border-[#DFDCFF] bg-[#FBFBFF]" : "border-[#EAECF0]"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] leading-normal font-semibold text-[#20232B] line-clamp-1 group-hover:text-[#5148C9] transition-colors pt-0.5">
                      {note.title || "Untitled Note"}
                    </h3>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                      {note.isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => openShareModal(note, e)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-[#F0EFFF] hover:text-[#635BDB]"
                            title="Share note"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(note, e)}
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6]",
                              note.isPinned
                                ? "text-[#635BDB]"
                                : "text-[#737987]"
                            )}
                            title={note.isPinned ? "Unpin" : "Pin"}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNote(note, e)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-red-50 hover:text-red-600"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-[#737987] line-clamp-3 leading-relaxed">
                    {preview || "Empty page — click to start writing..."}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-[#F1F3F7] flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {!note.isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 truncate">
                        <Users className="h-2.5 w-2.5 shrink-0" />
                        By {note.owner.name.split(" ")[0]}
                      </span>
                    ) : note.shares.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#DFDCFF] bg-[#F0EFFF] px-2 py-0.5 text-[10px] font-medium text-[#5148C9]">
                        <Users className="h-2.5 w-2.5" />
                        Shared ({note.shares.length})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-[#9CA3AF]">
                        <Lock className="h-2.5 w-2.5" />
                        Private
                      </span>
                    )}
                  </div>
                  <span className="shrink-0">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-[#EAECF0] rounded-xl border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
          {paginatedNotes.map((note) => {
            const preview = stripHtmlPreview(note.content);
            return (
              <div
                key={note.id}
                onClick={() => setOpenNoteId(note.id)}
                className="group flex items-center justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-[#F7F8FA] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm leading-normal font-semibold text-[#20232B] group-hover:text-[#5148C9]">
                        {note.title || "Untitled Note"}
                      </h3>
                      {note.isPinned && (
                        <Pin className="h-3 w-3 shrink-0 text-[#635BDB]" />
                      )}
                      {!note.isOwner ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 shrink-0">
                          Shared by {note.owner.name.split(" ")[0]}
                          {note.canEdit ? " · Edit" : " · View"}
                        </span>
                      ) : note.shares.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#DFDCFF] bg-[#F0EFFF] px-2 py-0.5 text-[10px] font-medium text-[#5148C9] shrink-0">
                          <Users className="h-2.5 w-2.5" />
                          {note.shares.length} shared
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#737987]">
                      {preview || "Empty page"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-xs text-[#9CA3AF]">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                  {note.isOwner && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => openShareModal(note, e)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-[#F0EFFF] hover:text-[#635BDB]"
                        title="Share note"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(note, e)}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6]",
                          note.isPinned ? "text-[#635BDB]" : "text-[#737987]"
                        )}
                        title={note.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNote(note, e)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-red-50 hover:text-red-600"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        currentPage={safePage}
        totalItems={filteredNotes.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="notes"
      />
      </div>

      {/* FULL-SCREEN NOTION-STYLE NOTE EDITOR (portaled to document.body so parent space-y-* never offsets it) */}
      {portalMounted &&
        openNote &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[45] !m-0 h-screen w-screen flex flex-col bg-white">
          {/* Top Full-Screen Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] bg-white px-4 sm:px-6 py-2.5 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-[#525866]"
                onClick={handleCloseNote}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Notes
              </Button>
              <span className="h-4 w-px bg-[#EAECF0]" />
              <span className="truncate text-xs leading-normal font-medium text-[#737987] max-w-[200px] sm:max-w-xs">
                {draftTitle || "Untitled Note"}
              </span>
              {!openNote.canEdit && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">
                  <Eye className="h-3 w-3" />
                  View only
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {openNote.isOwner && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => openShareModal(openNote)}
                  >
                    <Share2 className="h-3.5 w-3.5 text-[#635BDB]" />
                    Share
                    {openNote.shares.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-[#F0EFFF] px-1.5 text-[10.5px] font-semibold text-[#5148C9]">
                        {openNote.shares.length}
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      openNote.isPinned ? "text-[#635BDB]" : "text-[#737987]"
                    )}
                    onClick={() => handleTogglePin(openNote)}
                    title={openNote.isPinned ? "Unpin note" : "Pin note"}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#737987] hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteNote(openNote)}
                    title="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}

              {openNote.canEdit && (
                <>
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] px-2.5 h-8 cursor-pointer select-none">
                    <Switch
                      checked={autoSave}
                      onCheckedChange={handleToggleAutoSave}
                      aria-label="Toggle auto-save"
                    />
                    <span className="text-[11.5px] font-medium text-[#525866]">
                      Auto-save
                    </span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!hasUnsaved || saving}
                    className="h-8 px-3.5 text-xs"
                    onClick={() => handleSave()}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {saving ? "Saving..." : hasUnsaved ? "Save" : "Saved"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Formatting Toolbar (only when user can edit) */}
          {openNote.canEdit && editor && (
            <div className="flex flex-wrap items-center justify-center gap-0.5 border-b border-[#EAECF0] bg-[#FAFBFC] px-4 py-1.5 shrink-0">
              <ToolbarBtn
                active={editor.isActive("heading", { level: 1 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                title="Heading 1"
              >
                <Heading1 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                title="Heading 2"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("heading", { level: 3 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                title="Heading 3"
              >
                <Heading3 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <span className="mx-1 h-4 w-px bg-[#E2E6EE]" />
              <ToolbarBtn
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Underline"
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                title="Highlight"
              >
                <Highlighter className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Inline Code"
              >
                <Code className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("link")}
                onClick={handleSetLink}
                title="Link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={handleInsertImage}
                title="Insert Image (or paste any image / image URL directly)"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <span className="mx-1 h-4 w-px bg-[#E2E6EE]" />
              <ToolbarBtn
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
              >
                <List className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Numbered List"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("taskList")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                title="Checklist"
              >
                <CheckSquare className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Quote / Callout"
              >
                <Quote className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("codeBlock")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code Block"
              >
                <Code2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive("table")}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
                title="Insert Table (or paste directly from Excel / Sheets / Markdown)"
              >
                <Table2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Divider"
              >
                <Minus className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <span className="mx-1 h-4 w-px bg-[#E2E6EE]" />
              <ToolbarBtn
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
              >
                <Undo className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
              >
                <Redo className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Contextual Table Editing Controls */}
              {editor.isActive("table") && (
                <>
                  <span className="mx-1 h-4 w-px bg-[#E2E6EE]" />
                  <div className="inline-flex items-center gap-1 rounded-md border border-[#DFDCFF] bg-[#F5F4FF] px-1.5 py-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        editor.chain().focus().addRowAfter().run()
                      }
                      className="rounded px-1.5 py-0.5 font-medium text-[#5148C9] hover:bg-white"
                    >
                      + Row
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editor.chain().focus().addColumnAfter().run()
                      }
                      className="rounded px-1.5 py-0.5 font-medium text-[#5148C9] hover:bg-white"
                    >
                      + Col
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="rounded px-1.5 py-0.5 font-medium text-[#525866] hover:bg-white"
                    >
                      - Row
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editor.chain().focus().deleteColumn().run()
                      }
                      className="rounded px-1.5 py-0.5 font-medium text-[#525866] hover:bg-white"
                    >
                      - Col
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editor.chain().focus().deleteTable().run()
                      }
                      className="rounded px-1.5 py-0.5 font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete Table
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Centered Full-Screen Document Canvas */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8">
            <div className="mx-auto max-w-4xl space-y-5">
              {!openNote.isOwner && (
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800">
                  <UserAvatar
                    name={openNote.owner.name}
                    avatarUrl={openNote.owner.avatarUrl}
                    size="xs"
                  />
                  Shared by <strong>{openNote.owner.name}</strong>
                </div>
              )}

              <div>
                <textarea
                  ref={titleInputRef}
                  rows={1}
                  value={draftTitle}
                  disabled={!openNote.canEdit}
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      editor?.commands.focus("start");
                    }
                  }}
                  onChange={(e) => {
                    const nextTitle = e.target.value.replace(/\r?\n/g, " ");
                    setDraftTitle(nextTitle);
                    const snap = serverSnapshotRef.current;
                    const currentHtml = editor
                      ? editor.getHTML()
                      : draftContent;
                    const changed =
                      !snap ||
                      (nextTitle.trim() || "Untitled Note") !== snap.title ||
                      normalizeNoteHtml(currentHtml) !== snap.content;
                    setHasUnsaved(changed);
                    if (!changed && snap) {
                      clearLocalDraft(snap.id);
                    }
                  }}
                  placeholder="Untitled Note"
                  className="block w-full resize-none overflow-hidden py-1.5 text-3xl leading-[1.3] sm:text-4xl sm:leading-[1.3] font-bold tracking-tight text-[#20232B] placeholder:text-[#CBD5E1] bg-transparent focus:outline-none disabled:opacity-100"
                />
              </div>

              <div className="meridian-editor pt-2">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Share Note Modal */}
      <Dialog
        open={!!shareModalNote}
        onOpenChange={(open) => {
          if (!open) setShareModalNote(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[#635BDB]" />
              Share Note
            </DialogTitle>
            <DialogDescription>
              Choose teammates who can view or edit{" "}
              <strong className="text-[#20232B]">
                {shareModalNote?.title}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
              <input
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                placeholder="Search teammates..."
                className="h-8 w-full rounded-md border border-[#E2E6EE] pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F3F7] rounded-lg border border-[#EAECF0]">
              {filteredShareUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#9CA3AF]">
                  No teammates found.
                </p>
              ) : (
                filteredShareUsers.map((u) => {
                  const entry = shareDraft[u.id] || {
                    selected: false,
                    canEdit: false,
                  };
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#F7F8FA]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setShareDraft((prev) => ({
                            ...prev,
                            [u.id]: {
                              selected: !entry.selected,
                              canEdit: entry.canEdit,
                            },
                          }))
                        }
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            entry.selected
                              ? "border-[#635BDB] bg-[#635BDB] text-white"
                              : "border-[#D5D9E2] bg-white"
                          )}
                        >
                          {entry.selected && <Check className="h-3 w-3" />}
                        </span>
                        <UserAvatar
                          name={u.name}
                          avatarUrl={u.avatarUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[#20232B]">
                            {u.name}
                          </p>
                          <p className="truncate text-[10.5px] text-[#737987]">
                            {u.designation || u.email}
                          </p>
                        </div>
                      </button>

                      {entry.selected && (
                        <Select
                          value={entry.canEdit ? "edit" : "view"}
                          onValueChange={(v) =>
                            setShareDraft((prev) => ({
                              ...prev,
                              [u.id]: {
                                selected: true,
                                canEdit: v === "edit",
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 w-[100px] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">View only</SelectItem>
                            <SelectItem value="edit">Can edit</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareModalNote(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingShares}
              onClick={handleSaveShares}
            >
              {savingShares && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Save Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
