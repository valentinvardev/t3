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
    .input(
      z
        .object({
          content: z.string().max(500).default(""),
          sharedNoteTitle: z.string().optional(),
          sharedNoteContent: z.string().optional(),
        })
        .refine(
          (d) => d.content.trim().length > 0 || !!d.sharedNoteTitle,
          "Must have content or a shared note",
        ),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.message.create({
        data: {
          content: input.content,
          sharedNoteTitle: input.sharedNoteTitle,
          sharedNoteContent: input.sharedNoteContent,
          userId: ctx.session.user.id,
        },
        include: { user: { select: { id: true, name: true } } },
      }),
    ),
});
