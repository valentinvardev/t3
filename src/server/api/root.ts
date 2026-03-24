import { postRouter } from "~/server/api/routers/post";
import { notesRouter } from "~/server/api/routers/notes";
import { checklistRouter } from "~/server/api/routers/checklist";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  notes: notesRouter,
  checklist: checklistRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
