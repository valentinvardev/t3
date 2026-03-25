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
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { points: true },
      });
      if (user.points < input.bet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points" });
      }
      return ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.session.user.id },
          data: { points: { decrement: input.bet } },
        });
        const game = await tx.coinflipGame.create({
          data: { bet: input.bet, creatorId: ctx.session.user.id, creatorSide: input.creatorSide },
        });
        await tx.message.create({
          data: { content: "", userId: ctx.session.user.id, coinflipGameId: game.id },
        });
        return game;
      });
    }),

  join: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.coinflipGame.findUniqueOrThrow({
        where: { id: input.gameId },
      });
      if (game.status !== "WAITING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is no longer open" });
      }
      if (game.creatorId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot join your own game" });
      }
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { points: true },
      });
      if (user.points < game.bet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points" });
      }
      const result = Math.random() < 0.5 ? ("HEADS" as const) : ("TAILS" as const);
      const winnerId = result === game.creatorSide ? game.creatorId : ctx.session.user.id;
      const resolvedAt = new Date();
      return ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.session.user.id },
          data: { points: { decrement: game.bet } },
        });
        await tx.user.update({
          where: { id: winnerId },
          data: { points: { increment: game.bet * 2 } },
        });
        return tx.coinflipGame.update({
          where: { id: input.gameId },
          data: { joinerId: ctx.session.user.id, winnerId, status: "FINISHED", result, resolvedAt },
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
