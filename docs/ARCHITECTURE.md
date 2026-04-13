# FLMAN-CN Architecture

## 技术架构
- 前端：Next.js App Router + React + TypeScript + Tailwind CSS
- 认证：NextAuth Credentials（邮箱/密码）
- 数据库：PostgreSQL + Prisma ORM
- 权限：基础 RBAC + 数据范围隔离（owner/team/all）

## 模块分层
- `app/(auth)`：登录相关
- `app/(dashboard)`：后台布局和业务模块
- `app/actions`：Server Actions，按模块拆分
- `lib`：认证、权限、数据范围、通用工具
- `prisma`：Schema + Seed

## RBAC 规则
- SALES：仅本人数据
- SALES_MANAGER：本人 + 团队数据
- FINANCE：财务与统计数据
- ADMIN：全量数据

## 收入口径
- 客户收入 = `CustomerOrderStat.orderCount * Customer.unitProfit`
- 销售收入 = 名下客户收入汇总
- 时间维度支持：今日 / 本周 / 本月

## 扩展建议
- 后续接入对象存储实现 `QuoteAttachment` 上传
- 会议模块对接 ASR（语音转写）和 LLM（纪要结构化）
- 将核心统计改为物化视图或定时聚合表，提升高并发性能
