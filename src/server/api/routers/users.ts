import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const usersRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, points: true },
    }),
  ),

  getAll: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      select: { id: true, name: true, email: true, lastSeen: true },
      orderBy: { name: "asc" },
    }),
  ),

  heartbeat: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { lastSeen: new Date() },
    }),
  ),
});
