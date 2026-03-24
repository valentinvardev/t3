import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const notesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(({ ctx }) =>
    ctx.db.note.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
  ),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.note.create({
        data: { ...input, userId: ctx.session.user.id },
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.note.deleteMany({
        where: { id: input.id, userId: ctx.session.user.id },
      }),
    ),
});
