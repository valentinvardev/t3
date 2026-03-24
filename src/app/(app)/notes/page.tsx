"use client";

import { useState } from "react";
import { Plus, Search, FileText, Trash2, Loader2, Share2, Check } from "lucide-react";
import { api } from "~/trpc/react";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotesPage() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const { data: notes = [], isLoading } = api.notes.getAll.useQuery();

  const create = api.notes.create.useMutation({
    onSuccess: async () => {
      await utils.notes.getAll.invalidate();
      setNewTitle("");
      setNewContent("");
      setShowNew(false);
    },
  });

  const remove = api.notes.delete.useMutation({
    onSuccess: () => utils.notes.getAll.invalidate(),
  });

  const [justShared, setJustShared] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const shareToChat = api.messages.send.useMutation({
    onSuccess: (_data, vars) => {
      setJustShared(vars.sharedNoteTitle ?? null);
      setShareError(null);
      setTimeout(() => setJustShared(null), 2000);
    },
    onError: (err) => {
      setShareError(err.message);
      setTimeout(() => setShareError(null), 3000);
    },
  });

  function shareNote(note: { title: string; content: string }) {
    shareToChat.mutate({
      content: "",
      sharedNoteTitle: note.title,
      sharedNoteContent: note.content,
    });
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()),
  );

  function addNote() {
    if (!newTitle.trim()) return;
    create.mutate({ title: newTitle.trim(), content: newContent.trim() });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4 lg:px-8 lg:py-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Notes</h1>
          <p className="text-sm text-zinc-500">
            {isLoading ? "Loading..." : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="hidden items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:scale-95 lg:flex"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Note
        </button>
      </div>

      {/* Share rate limit toast */}
      {shareError && (
        <div className="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 lg:mx-8">
          {shareError}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-24 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-95 lg:hidden"
      >
        <Plus size={24} className="text-white" strokeWidth={2.5} />
      </button>

      <div className="flex-1 overflow-y-auto p-5 lg:p-8">
        {/* Search */}
        <div className="relative mb-6 w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* New note form */}
        {showNew && (
          <div className="mb-6 rounded-xl border border-indigo-500/30 bg-zinc-900 p-5 shadow-lg shadow-black/20">
            <input
              autoFocus
              type="text"
              placeholder="Note title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="mb-3 w-full bg-transparent text-base font-semibold text-zinc-100 placeholder-zinc-600 outline-none"
            />
            <textarea
              placeholder="Write something..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-zinc-400 placeholder-zinc-600 outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={addNote}
                disabled={create.isPending || !newTitle.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {create.isPending && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
              <button
                onClick={() => { setShowNew(false); setNewTitle(""); setNewContent(""); }}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText size={40} className="mb-3 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500">
              {search ? "No notes match your search" : "No notes yet"}
            </p>
            <p className="text-sm text-zinc-600">
              {search ? "Try a different keyword" : "Tap + to create your first note"}
            </p>
          </div>
        )}

        {/* Notes grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((note) => {
              const shared = justShared === note.title;
              return (
                <div
                  key={note.id}
                  className={`group relative rounded-xl border bg-zinc-900 p-5 shadow-sm transition ${
                    shared
                      ? "border-indigo-500/50 ring-1 ring-indigo-500/20"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Action buttons — visible on hover */}
                  <div className="absolute right-3 top-3 hidden items-center gap-1 group-hover:flex">
                    <button
                      onClick={() => shareNote(note)}
                      disabled={shareToChat.isPending}
                      title="Share to chat"
                      className="rounded-md p-1.5 text-zinc-600 transition hover:bg-indigo-500/10 hover:text-indigo-400"
                    >
                      {shared ? <Check size={14} className="text-indigo-400" /> : <Share2 size={14} />}
                    </button>
                    <button
                      onClick={() => remove.mutate({ id: note.id })}
                      className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <h3 className="mb-1.5 pr-14 text-sm font-semibold text-zinc-100 line-clamp-1">
                    {note.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-zinc-500 line-clamp-3">
                    {note.content || <span className="italic text-zinc-600">Empty note</span>}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-600">{formatDate(note.updatedAt)}</p>
                    {shared && (
                      <span className="text-xs font-medium text-indigo-400">Shared to chat</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
