"use client";

import { useState } from "react";
import { Plus, CheckSquare, Trash2, Check, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type Item = RouterOutputs["checklist"]["getAll"][number];

export default function ChecklistPage() {
  const utils = api.useUtils();
  const [input, setInput] = useState("");

  const { data: tasks = [], isLoading } = api.checklist.getAll.useQuery();

  const create = api.checklist.create.useMutation({
    onSuccess: async () => {
      await utils.checklist.getAll.invalidate();
      setInput("");
    },
  });

  const toggle = api.checklist.toggle.useMutation({
    onMutate: async ({ id, done }) => {
      await utils.checklist.getAll.cancel();
      const prev = utils.checklist.getAll.getData();
      utils.checklist.getAll.setData(undefined, (old) =>
        old?.map((t) => (t.id === id ? { ...t, done } : t)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.checklist.getAll.setData(undefined, ctx.prev);
    },
    onSettled: () => utils.checklist.getAll.invalidate(),
  });

  const remove = api.checklist.delete.useMutation({
    onSuccess: () => utils.checklist.getAll.invalidate(),
  });

  const clearCompleted = api.checklist.clearCompleted.useMutation({
    onSuccess: () => utils.checklist.getAll.invalidate(),
  });

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  function addTask() {
    if (!input.trim()) return;
    create.mutate({ label: input.trim() });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4 lg:px-8 lg:py-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Checklist</h1>
          <p className="text-sm text-zinc-500">
            {isLoading
              ? "Loading..."
              : `${pending.length} remaining · ${completed.length} completed`}
          </p>
        </div>
        {completed.length > 0 && (
          <button
            onClick={() => clearCompleted.mutate()}
            disabled={clearCompleted.isPending}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
          >
            {clearCompleted.isPending && <Loader2 size={13} className="animate-spin" />}
            Clear completed
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 lg:p-8">
        <div className="mx-auto max-w-2xl">
          {/* Add task */}
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
              disabled={create.isPending || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:scale-95 disabled:opacity-50"
            >
              {create.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} strokeWidth={2.5} />
              )}
              Add
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-zinc-600" />
            </div>
          )}

          {/* Pending */}
          {!isLoading && pending.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                To do — {pending.length}
              </p>
              <div className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(id, done) => toggle.mutate({ id, done })}
                    onDelete={(id) => remove.mutate({ id })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {!isLoading && completed.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                Completed — {completed.length}
              </p>
              <div className="flex flex-col gap-2">
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(id, done) => toggle.mutate({ id, done })}
                    onDelete={(id) => remove.mutate({ id })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && tasks.length === 0 && (
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
  task: Item;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700">
      <button
        onClick={() => onToggle(task.id, !task.done)}
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
