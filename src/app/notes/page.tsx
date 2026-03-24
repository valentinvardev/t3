"use client";

import { useState } from "react";
import { Plus, Search, FileText, Trash2 } from "lucide-react";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
};

const SAMPLE_NOTES: Note[] = [
  {
    id: "1",
    title: "Project kickoff ideas",
    content: "Think about the overall structure of the app. We need a clean API layer, good state management, and a consistent design system.",
    updatedAt: new Date("2026-03-23"),
  },
  {
    id: "2",
    title: "Meeting notes — March 24",
    content: "Discussed deployment pipeline. Agreed on Vercel + Supabase for the stack. Next step: set up CI/CD and environment variables.",
    updatedAt: new Date("2026-03-24"),
  },
  {
    id: "3",
    title: "Reading list",
    content: "- The Pragmatic Programmer\n- Clean Architecture\n- Designing Data-Intensive Applications",
    updatedAt: new Date("2026-03-22"),
  },
];

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(SAMPLE_NOTES);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()),
  );

  function addNote() {
    if (!newTitle.trim()) return;
    setNotes([
      {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        content: newContent.trim(),
        updatedAt: new Date(),
      },
      ...notes,
    ]);
    setNewTitle("");
    setNewContent("");
    setShowNew(false);
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Notes</h1>
          <p className="text-sm text-zinc-500">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Search */}
        <div className="relative mb-6 max-w-sm">
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
                className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
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

        {/* Notes grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText size={40} className="mb-3 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500">No notes found</p>
            <p className="text-sm text-zinc-600">Create your first note to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((note) => (
              <div
                key={note.id}
                className="group relative rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition hover:border-zinc-700"
              >
                <button
                  onClick={() => deleteNote(note.id)}
                  className="absolute right-3 top-3 hidden rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400 group-hover:flex"
                >
                  <Trash2 size={14} />
                </button>
                <h3 className="mb-1.5 pr-6 text-sm font-semibold text-zinc-100 line-clamp-1">
                  {note.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-zinc-500 line-clamp-3">
                  {note.content || <span className="italic text-zinc-600">Empty note</span>}
                </p>
                <p className="text-xs text-zinc-600">{formatDate(note.updatedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
