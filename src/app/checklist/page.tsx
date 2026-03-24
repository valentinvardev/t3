"use client";

import { useState } from "react";
import { Plus, CheckSquare, Trash2, Check } from "lucide-react";

type Task = {
  id: string;
  label: string;
  done: boolean;
  createdAt: Date;
};

const SAMPLE_TASKS: Task[] = [
  { id: "1", label: "Set up Supabase database", done: true, createdAt: new Date("2026-03-22") },
  { id: "2", label: "Configure Prisma schema", done: true, createdAt: new Date("2026-03-22") },
  { id: "3", label: "Deploy to Vercel", done: false, createdAt: new Date("2026-03-23") },
  { id: "4", label: "Add authentication with Discord", done: false, createdAt: new Date("2026-03-23") },
  { id: "5", label: "Write API routes with tRPC", done: false, createdAt: new Date("2026-03-24") },
];

export default function ChecklistPage() {
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);
  const [input, setInput] = useState("");

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  function addTask() {
    if (!input.trim()) return;
    setTasks([
      ...tasks,
      { id: crypto.randomUUID(), label: input.trim(), done: false, createdAt: new Date() },
    ]);
    setInput("");
  }

  function toggle(id: string) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function clearCompleted() {
    setTasks(tasks.filter((t) => !t.done));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Checklist</h1>
          <p className="text-sm text-zinc-500">
            {pending.length} remaining · {completed.length} completed
          </p>
        </div>
        {completed.length > 0 && (
          <button
            onClick={clearCompleted}
            className="text-sm font-medium text-zinc-500 transition hover:text-red-400"
          >
            Clear completed
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          {/* Add task input */}
          <div className="mb-8 flex gap-3">
            <input
              type="text"
              placeholder="Add a new task..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={addTask}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:scale-95"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add
            </button>
          </div>

          {/* Pending tasks */}
          {pending.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                To do — {pending.length}
              </p>
              <div className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {completed.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                Completed — {completed.length}
              </p>
              <div className="flex flex-col gap-2">
                {completed.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <CheckSquare size={40} className="mb-3 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-500">All clear</p>
              <p className="text-sm text-zinc-600">Add a task above to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700">
      <button
        onClick={() => onToggle(task.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
          task.done
            ? "border-indigo-500 bg-indigo-500"
            : "border-zinc-600 hover:border-indigo-400"
        }`}
      >
        {task.done && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>
      <span
        className={`flex-1 text-sm transition ${
          task.done ? "text-zinc-600 line-through" : "text-zinc-300"
        }`}
      >
        {task.label}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        className="hidden text-zinc-600 transition hover:text-red-400 group-hover:block"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
