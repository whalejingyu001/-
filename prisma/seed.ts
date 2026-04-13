import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roleSeeds = [
    { name: RoleName.SALES, label: "销售" },
    { name: RoleName.SALES_MANAGER, label: "销售主管" },
    { name: RoleName.FINANCE, label: "财务" },
    { name: RoleName.ADMIN, label: "管理员" },
  ];

  for (const role of roleSeeds) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { label: role.label },
      create: role,
    });
  }

  const [salesRole, managerRole, financeRole, adminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.SALES } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.SALES_MANAGER } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.FINANCE } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } }),
  ]);

  const passwordHash = await bcrypt.hash("123456", 10);

  const manager = await prisma.user.upsert({
    where: { email: "manager@flman.cn" },
    update: { teamName: "销售一部", status: "ACTIVE" },
    create: {
      email: "manager@flman.cn",
      name: "销售主管-王敏",
      roleId: managerRole.id,
      teamName: "销售一部",
      status: "ACTIVE",
      passwordHash,
    },
  });

  const [admin, finance, salesA, salesB] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@flman.cn" },
      update: { teamName: "管理中心", status: "ACTIVE" },
      create: {
        email: "admin@flman.cn",
        name: "系统管理员",
        roleId: adminRole.id,
        teamName: "管理中心",
        status: "ACTIVE",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "finance@flman.cn" },
      update: { teamName: "财务部", status: "ACTIVE" },
      create: {
        email: "finance@flman.cn",
        name: "财务-李青",
        roleId: financeRole.id,
        teamName: "财务部",
        status: "ACTIVE",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "sales1@flman.cn" },
      update: { supervisorId: manager.id, teamName: "销售一部", status: "ACTIVE" },
      create: {
        email: "sales1@flman.cn",
        name: "销售-张磊",
        roleId: salesRole.id,
        supervisorId: manager.id,
        teamName: "销售一部",
        status: "ACTIVE",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "sales2@flman.cn" },
      update: { supervisorId: manager.id, teamName: "销售一部", status: "ACTIVE" },
      create: {
        email: "sales2@flman.cn",
        name: "销售-陈晨",
        roleId: salesRole.id,
        supervisorId: manager.id,
        teamName: "销售一部",
        status: "ACTIVE",
        passwordHash,
      },
    }),
  ]);

  const customerA = await prisma.customer.upsert({
    where: { id: "seed-customer-a" },
    update: {},
    create: {
      id: "seed-customer-a",
      name: "华东连锁仓配",
      companyName: "华东连锁仓配有限公司",
      title: "采购负责人",
      contactName: "刘总",
      phone: "13800001111",
      wechat: "liuzong-hd",
      company: "华东连锁仓配有限公司",
      ownerId: salesA.id,
      createdById: salesA.id,
      priority: "HIGH",
      businessNeeds: "海外仓,机构",
      notes: "重点维护客户，周频跟进。",
      tags: "重点客户,快消",
      stage: "FOLLOWING",
      nextFollowUpAt: addDays(new Date(), 1),
      unitProfit: 18.5,
    },
  });

  const customerB = await prisma.customer.upsert({
    where: { id: "seed-customer-b" },
    update: {},
    create: {
      id: "seed-customer-b",
      name: "南方跨境物流",
      companyName: "南方跨境物流科技有限公司",
      title: "物流总监",
      contactName: "周经理",
      phone: "13900002222",
      wechat: "zhoumanager-nf",
      company: "南方跨境物流科技有限公司",
      ownerId: salesB.id,
      createdById: salesB.id,
      priority: "CRITICAL",
      businessNeeds: "海外仓",
      notes: "已成交客户，关注履约稳定性。",
      tags: "跨境,高利润",
      stage: "WON",
      nextFollowUpAt: subDays(new Date(), 1),
      unitProfit: 26,
    },
  });

  await prisma.followUp.createMany({
    data: [
      {
        customerId: customerA.id,
        userId: salesA.id,
        content: "确认本周报价反馈",
        status: "PENDING",
        dueAt: addDays(new Date(), 1),
      },
      {
        customerId: customerB.id,
        userId: salesB.id,
        content: "补充合同盖章流程",
        status: "OVERDUE",
        dueAt: subDays(new Date(), 2),
      },
    ],
  });

  await prisma.quote.createMany({
    data: [
      {
        customerId: customerA.id,
        createdById: salesA.id,
        version: 1,
        isLatest: false,
        operationFee: 1200,
        shippingFee: 500,
        totalAmount: 1700,
        notes: "首版报价",
      },
      {
        customerId: customerA.id,
        createdById: salesA.id,
        version: 2,
        isLatest: true,
        operationFee: 1400,
        shippingFee: 450,
        totalAmount: 1850,
        notes: "按客户折扣调整",
      },
      {
        customerId: customerB.id,
        createdById: salesB.id,
        version: 1,
        isLatest: true,
        operationFee: 2200,
        shippingFee: 800,
        totalAmount: 3000,
      },
    ],
  });

  await prisma.customerOrderStat.createMany({
    data: [
      { customerId: customerA.id, statDate: new Date(), orderCount: 46 },
      { customerId: customerA.id, statDate: subDays(new Date(), 1), orderCount: 44 },
      { customerId: customerB.id, statDate: new Date(), orderCount: 70 },
      { customerId: customerB.id, statDate: subDays(new Date(), 1), orderCount: 63 },
    ],
  });

  await prisma.reimbursement.createMany({
    data: [
      {
        applicantId: salesA.id,
        amount: 320,
        reason: "客户拜访交通费",
        status: "PENDING",
      },
      {
        applicantId: salesB.id,
        amount: 860,
        reason: "展会差旅",
        status: "APPROVED",
        reviewerId: finance.id,
      },
    ],
  });

  await prisma.meetingRecord.create({
    data: {
      customerId: customerA.id,
      userId: salesA.id,
      title: "华东连锁仓配季度协同会",
      sourceType: "AUDIO_UPLOAD",
      sourceUrl: "https://example.com/meeting-audio.mp3",
      transcript: "客户提出希望压缩尾程时效，并关注异常订单回传机制。",
      aiSummary: JSON.stringify({
        summary: "会议明确将试点新线路并优化回传 SLA。",
        keyPoints: ["尾程时效优化", "异常回传机制", "试点客户范围"],
        decisions: ["下周提交 V3 方案"],
        actionItems: ["销售整理新报价", "运营给出 SLA 明细"],
      }),
    },
  });

  await prisma.attendanceRecord.createMany({
    data: [
      {
        userId: salesA.id,
        attendanceDate: new Date(),
        checkInAt: subDays(new Date(), 0),
        status: "WORKING",
      },
      {
        userId: salesB.id,
        attendanceDate: new Date(),
        checkInAt: subDays(new Date(), 0),
        status: "BLOCKED",
        note: "存在逾期客户未跟进",
      },
    ],
  });

  console.log("Seed completed", { admin: admin.email, finance: finance.email, manager: manager.email, sales: salesA.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
