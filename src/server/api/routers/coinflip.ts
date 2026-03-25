import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const coinflipRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      bet: z.number().int().min(10).max(10000),
      creatorSide: z.enum(["HEADS", "TAILS"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 1 game created per 10 seconds
      const tenSecondsAgo = new Date(Date.now() - 10_000);
      const recentGame = await ctx.db.coinflipGame.findFirst({
        where: { creatorId: ctx.session.user.id, createdAt: { gte: tenSecondsAgo } },
        select: { id: true },
      });
      if (recentGame) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Wait before creating another game" });
      }

      return ctx.db.$transaction(async (tx) => {
        // Atomically deduct points only if balance is sufficient — fixes TOCTOU race
        const deducted = await tx.user.updateMany({
          where: { id: ctx.session.user.id, points: { gte: input.bet } },
          data: { points: { decrement: input.bet } },
        });
        if (deducted.count === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points" });
        }
        const game = await tx.coinflipGame.create({
          data: { bet: input.bet, creatorId: ctx.session.user.id, creatorSide: input.creatorSide },
          include: {
            creator: { select: { id: true, name: true } },
            joiner:  { select: { id: true, name: true } },
          },
        });
        const message = await tx.message.create({
          data: { content: "", userId: ctx.session.user.id, coinflipGameId: game.id },
          include: {
            user: { select: { id: true, name: true } },
            coinflipGame: {
              include: {
                creator: { select: { id: true, name: true } },
                joiner:  { select: { id: true, name: true } },
              },
            },
          },
        });
        return { game, message };
      });
    }),

  join: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Pre-flight checks (cheap; race-condition-safe version happens inside tx)
      const game = await ctx.db.coinflipGame.findUniqueOrThrow({
        where: { id: input.gameId },
      });
      if (game.status !== "WAITING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is no longer open" });
      }
      if (game.creatorId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot join your own game" });
      }

      const result = Math.random() < 0.5 ? ("HEADS" as const) : ("TAILS" as const);
      const winnerId = result === game.creatorSide ? game.creatorId : ctx.session.user.id;
      const resolvedAt = new Date();

      return ctx.db.$transaction(async (tx) => {
        // Atomically deduct joiner's points — fixes TOCTOU race
        const deducted = await tx.user.updateMany({
          where: { id: ctx.session.user.id, points: { gte: game.bet } },
          data: { points: { decrement: game.bet } },
        });
        if (deducted.count === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points" });
        }
        // Atomically claim the game — prevents double-join under concurrent requests
        const claimed = await tx.coinflipGame.updateMany({
          where: { id: input.gameId, status: "WAITING" },
          data: { joinerId: ctx.session.user.id, status: "FINISHED", result, winnerId, resolvedAt },
        });
        if (claimed.count === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Game is no longer open" });
        }
        await tx.user.update({
          where: { id: winnerId },
          data: { points: { increment: game.bet * 2 } },
        });
        return tx.coinflipGame.findUniqueOrThrow({
          where: { id: input.gameId },
          include: {
            creator: { select: { id: true, name: true } },
            joiner: { select: { id: true, name: true } },
          },
        });
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.coinflipGame.findUniqueOrThrow({
        where: { id: input.gameId },
      });
      if (game.status !== "WAITING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is no longer open" });
      }
      if (game.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your game" });
      }
      return ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.session.user.id },
          data: { points: { increment: game.bet } },
        });
        return tx.coinflipGame.update({
          where: { id: input.gameId },
          data: { status: "CANCELLED" },
        });
      });
    }),
});
