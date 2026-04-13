import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function calculateRevenueByRange(
  customerIds: string[] | undefined,
  range: { gte: Date; lte: Date },
) {
  const stats = await prisma.customerOrderStat.findMany({
    where: {
      statDate: range,
      ...(customerIds ? { customerId: { in: customerIds } } : {}),
    },
    include: {
      customer: {
        select: {
          unitProfit: true,
        },
      },
    },
  });

  return stats.reduce((sum, item) => sum + item.orderCount * Number(item.customer.unitProfit), 0);
}

export function thisWeekRange() {
  return {
    gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
    lte: endOfWeek(new Date(), { weekStartsOn: 1 }),
  };
}

export function thisMonthRange() {
  return {
    gte: startOfMonth(new Date()),
    lte: endOfMonth(new Date()),
  };
}
