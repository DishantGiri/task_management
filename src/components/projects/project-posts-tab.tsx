"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Lightbulb,
  Loader2,
  Megaphone,
  Pin,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectPostItem, UserSummary } from "@/types";
import {
  createProjectPostAction,
  deleteProjectPostAction,
  togglePinProjectPostAction,
} from "@/actions/project-posts";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/badges";
import { PaginationBar } from "@/components/shared/pagination-bar";

interface ProjectPostsTabProps {
  projectId: string;
  posts: ProjectPostItem[];
  users: UserSummary[];
  currentUserId: string;
  canManage: boolean;
}

export function ProjectPostsTab({
  projectId,
  posts,
  users,
  currentUserId,
  canManage,
}: ProjectPostsTabProps) {
  const router = useRouter();
  const [postType, setPostType] = useState<"ANNOUNCEMENT" | "SUGGESTION">(
    canManage ? "ANNOUNCEMENT" : "SUGGESTION"
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");

  // Feed filters & pagination
  const [typeFilter, setTypeFilter] = useState<
    "ALL" | "ANNOUNCEMENT" | "SUGGESTION"
  >("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filteredMentionUsers = useMemo(() => {
    const q = mentionSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q)
    );
  }, [users, mentionSearch]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (q) {
        const hay = `${p.title} ${p.content} ${p.author.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedPosts = filteredPosts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const insertMention = (name: string) => {
    const first = name.split(" ")[0];
    setContent(
      (prev) =>
        `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}@${first} `
    );
    setShowMentionPicker(false);
    setMentionSearch("");
  };

  const renderWithMentions = (text: string) => {
    const parts = text.split(/(@[A-Za-z][A-Za-z0-9._-]*)/g);
    return parts.map((part, idx) =>
      part.startsWith("@") ? (
        <span
          key={idx}
          className="rounded bg-[#F0EFFF] px-1 py-0.5 font-medium text-[#5148C9]"
        >
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Please enter a title (at least 2 characters).");
      return;
    }
    if (content.trim().length < 2) {
      toast.error("Please enter a message.");
      return;
    }

    setSubmitting(true);
    const res = await createProjectPostAction({
      projectId,
      type: canManage ? postType : "SUGGESTION",
      title: title.trim(),
      content: content.trim(),
      isPinned: canManage ? isPinned : false,
    });
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      postType === "ANNOUNCEMENT" && canManage
        ? "Announcement published"
        : "Suggestion posted"
    );
    setTitle("");
    setContent("");
    setIsPinned(false);
    setShowMentionPicker(false);
    router.refresh();
  };

  const handleTogglePin = async (post: ProjectPostItem) => {
    const res = await togglePinProjectPostAction(post.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.isPinned ? "Post pinned to top" : "Post unpinned");
    router.refresh();
  };

  const handleDelete = async (post: ProjectPostItem) => {
    const res = await deleteProjectPostAction(post.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Post deleted");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Composer */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle space-y-3"
      >
        <div>
          <h3 className="text-[14px] font-semibold text-[#20232B]">
            New Post
          </h3>
          <p className="text-xs text-[#737987] mt-0.5">
            Share project announcements or suggestions and @mention teammates.
          </p>
        </div>

        {/* Type Switcher */}
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setPostType("ANNOUNCEMENT")}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                postType === "ANNOUNCEMENT"
                  ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                  : "border-[#EAECF0] bg-[#F7F8FA] text-[#525866] hover:bg-white"
              )}
            >
              <Megaphone className="h-3.5 w-3.5" />
              Announcement
            </button>
          )}
          <button
            type="button"
            onClick={() => setPostType("SUGGESTION")}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              postType === "SUGGESTION"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-[#EAECF0] bg-[#F7F8FA] text-[#525866] hover:bg-white"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Suggestion
          </button>
        </div>

        <Input
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            postType === "ANNOUNCEMENT"
              ? "Announcement headline (e.g., Staging freeze at 5 PM)"
              : "Suggestion title (e.g., Add export shortcut)"
          }
        />

        <div className="relative">
          <Textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your announcement or suggestion... Use @name to mention a teammate."
          />

          {showMentionPicker && (
            <div className="absolute left-0 right-0 bottom-full mb-1.5 z-30 rounded-lg border border-[#EAECF0] bg-white p-2 shadow-lg space-y-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                <input
                  value={mentionSearch}
                  onChange={(e) => setMentionSearch(e.target.value)}
                  placeholder="Search teammate to @mention..."
                  className="h-7 w-full rounded border border-[#E2E6EE] pl-7 pr-2 text-xs focus:border-[#635BDB] focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {filteredMentionUsers.length === 0 ? (
                  <p className="py-2 text-center text-xs text-[#9CA3AF]">
                    No matching teammates
                  </p>
                ) : (
                  filteredMentionUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertMention(u.name)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F0EFFF]/60 transition-colors"
                    >
                      <UserAvatar
                        name={u.name}
                        avatarUrl={u.avatarUrl}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#20232B]">
                          {u.name}
                        </p>
                        {u.designation && (
                          <p className="truncate text-[10.5px] text-[#737987]">
                            {u.designation}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowMentionPicker((v) => !v)}
            >
              <AtSign className="h-3.5 w-3.5 text-[#635BDB]" />
              Mention user
            </Button>

            {canManage && (
              <button
                type="button"
                onClick={() => setIsPinned((v) => !v)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors",
                  isPinned
                    ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                    : "border-[#EAECF0] bg-white text-[#737987] hover:bg-[#F7F8FA]"
                )}
              >
                <Pin className="h-3 w-3" />
                Pin
              </button>
            )}
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish
          </Button>
        </div>
      </form>

      {/* Right: Feed */}
      <div className="lg:col-span-7 space-y-3">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5">
            {(
              [
                { key: "ALL", label: `All (${posts.length})` },
                {
                  key: "ANNOUNCEMENT",
                  label: `Announcements (${
                    posts.filter((p) => p.type === "ANNOUNCEMENT").length
                  })`,
                },
                {
                  key: "SUGGESTION",
                  label: `Suggestions (${
                    posts.filter((p) => p.type === "SUGGESTION").length
                  })`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTypeFilter(t.key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                  typeFilter === t.key
                    ? "bg-[#F0EFFF] text-[#5148C9]"
                    : "text-[#737987] hover:text-[#20232B]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search posts..."
              className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
            />
          </div>
        </div>

        {/* Posts List */}
        {paginatedPosts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
            <Megaphone className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
            <p className="text-sm font-medium text-[#20232B]">
              No announcements or suggestions yet
            </p>
            <p className="mt-1 text-xs text-[#737987]">
              Post an update or share an improvement idea with the project team.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedPosts.map((post) => {
              const isAnnouncement = post.type === "ANNOUNCEMENT";
              const canDelete = canManage || post.author.id === currentUserId;
              return (
                <div
                  key={post.id}
                  className={cn(
                    "rounded-lg border bg-white p-4 shadow-subtle",
                    post.isPinned
                      ? "border-[#DFDCFF] bg-[#FBFBFF]"
                      : "border-[#EAECF0]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={post.author.name}
                        avatarUrl={post.author.avatarUrl}
                        size="sm"
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                              isAnnouncement
                                ? "border-[#DFDCFF] bg-[#F0EFFF] text-[#5148C9]"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            )}
                          >
                            {isAnnouncement ? (
                              <Megaphone className="h-3 w-3" />
                            ) : (
                              <Lightbulb className="h-3 w-3" />
                            )}
                            {isAnnouncement ? "Announcement" : "Suggestion"}
                          </span>
                          {post.isPinned && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#DFDCFF] bg-white px-2 py-0.5 text-[10.5px] font-medium text-[#635BDB]">
                              <Pin className="h-2.5 w-2.5" />
                              Pinned
                            </span>
                          )}
                          <span className="text-[11px] text-[#9CA3AF]">
                            {formatRelativeTime(post.createdAt)}
                          </span>
                        </div>

                        <h4 className="mt-1.5 text-[14.5px] font-semibold text-[#20232B] break-words">
                          {renderWithMentions(post.title)}
                        </h4>
                        <p className="mt-1 text-[13px] text-[#4B5563] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {renderWithMentions(post.content)}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#737987]">
                          <span className="font-medium text-[#20232B]">
                            {post.author.name}
                          </span>
                          <RoleBadge role={post.author.role} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            post.isPinned
                              ? "text-[#635BDB]"
                              : "text-[#737987] hover:text-[#20232B]"
                          )}
                          onClick={() => handleTogglePin(post)}
                          title={post.isPinned ? "Unpin post" : "Pin to top"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#737987] hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(post)}
                          title="Delete post"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filteredPosts.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="posts"
        />
      </div>
    </div>
  );
}
