import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const checklistRouter = createTRPCRouter({
  getAll: protectedProcedure.query(({ ctx }) =>
    ctx.db.checklistItem.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: protectedProcedure
    .input(z.object({ label: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.checklistItem.create({
        data: { label: input.label, userId: ctx.session.user.id },
      }),
    ),

  toggle: protectedProcedure
    .input(z.object({ id: z.string(), done: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.checklistItem.updateMany({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { done: input.done },
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.checklistItem.deleteMany({
        where: { id: input.id, userId: ctx.session.user.id },
      }),
    ),

  clearCompleted: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.checklistItem.deleteMany({
      where: { userId: ctx.session.user.id, done: true },
    }),
  ),
});
