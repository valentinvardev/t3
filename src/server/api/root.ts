import { postRouter } from "~/server/api/routers/post";
import { notesRouter } from "~/server/api/routers/notes";
import { checklistRouter } from "~/server/api/routers/checklist";
import { messagesRouter } from "~/server/api/routers/messages";
import { usersRouter } from "~/server/api/routers/users";
import { coinflipRouter } from "~/server/api/routers/coinflip";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  notes: notesRouter,
  checklist: checklistRouter,
  messages: messagesRouter,
  users: usersRouter,
  coinflip: coinflipRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
