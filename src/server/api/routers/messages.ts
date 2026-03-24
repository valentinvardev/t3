import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const messagesRouter = createTRPCRouter({
  getRecent: protectedProcedure.query(({ ctx }) =>
    ctx.db.message.findMany({
      take: 50,
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true } },
        coinflipGame: {
          include: {
            creator: { select: { id: true, name: true } },
            joiner: { select: { id: true, name: true } },
          },
        },
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
    .mutation(async ({ ctx, input }) => {
      if (input.sharedNoteTitle) {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const recentShare = await ctx.db.message.findFirst({
          where: {
            userId: ctx.session.user.id,
            sharedNoteTitle: { not: null },
            createdAt: { gte: twoMinutesAgo },
          },
        });
        if (recentShare) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You can only share a note once every 2 minutes",
          });
        }
      }
      return ctx.db.message.create({
        data: {
          content: input.content,
          sharedNoteTitle: input.sharedNoteTitle,
          sharedNoteContent: input.sharedNoteContent,
          userId: ctx.session.user.id,
        },
        include: { user: { select: { id: true, name: true } } },
      });
    }),
});
