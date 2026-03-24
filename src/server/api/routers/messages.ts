import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const messagesRouter = createTRPCRouter({
  getRecent: protectedProcedure.query(({ ctx }) =>
    ctx.db.message.findMany({
      take: 50,
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
  ),

  send: protectedProcedure
    .input(z.object({ content: z.string().min(1).max(500) }))
    .mutation(({ ctx, input }) =>
      ctx.db.message.create({
        data: { content: input.content, userId: ctx.session.user.id },
        include: { user: { select: { id: true, name: true } } },
      }),
    ),
});
