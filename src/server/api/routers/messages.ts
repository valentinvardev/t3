import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const messagesRouter = createTRPCRouter({
  getRecent: protectedProcedure
    .input(z.object({ since: z.date().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.message.findMany({
        // When polling incrementally, skip the limit and only return new messages.
        // On initial load (no since) fetch the last 50.
        take: input?.since ? undefined : 50,
        where: input?.since ? { createdAt: { gt: input.since } } : undefined,
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
          sharedNoteTitle: z.string().max(200).optional(),
          sharedNoteContent: z.string().max(20_000).optional(),
        })
        .refine(
          (d) => d.content.trim().length > 0 || !!d.sharedNoteTitle,
          "Must have content or a shared note",
        ),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sharedNoteTitle) {
        // Rate limit note shares: 1 per 2 minutes
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const recentShare = await ctx.db.message.findFirst({
          where: {
            userId: ctx.session.user.id,
            sharedNoteTitle: { not: null },
            createdAt: { gte: twoMinutesAgo },
          },
          select: { id: true },
        });
        if (recentShare) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You can only share a note once every 2 minutes",
          });
        }
      } else {
        // Rate limit regular messages: 1 per 2 seconds
        const twoSecondsAgo = new Date(Date.now() - 2_000);
        const recentMsg = await ctx.db.message.findFirst({
          where: {
            userId: ctx.session.user.id,
            sharedNoteTitle: null,
            coinflipGameId: null,
            createdAt: { gte: twoSecondsAgo },
          },
          select: { id: true },
        });
        if (recentMsg) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Slow down",
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
