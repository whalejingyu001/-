# FLMAN-CN

企业内部销售业务管理系统（Web）。

## 1. 项目目录结构

```text
flman-cn/
├─ app/
│  ├─ (auth)/login
│  ├─ (dashboard)/dashboard
│  │  ├─ customers
│  │  ├─ quotes
│  │  ├─ order-stats
│  │  ├─ revenue
│  │  ├─ finance
│  │  ├─ meetings
│  │  └─ supervision
│  ├─ actions/
│  └─ api/auth/[...nextauth]/
├─ components/
│  ├─ layout/
│  └─ ui/
├─ lib/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ docs/ARCHITECTURE.md
└─ .env.example
```

## 2. 本地开发运行

1. 准备 PostgreSQL 数据库并创建库，例如 `flman_cn`
2. 复制环境变量：

```bash
cp .env.example .env
```

3. 执行 Prisma：

```bash
npm run prisma:generate
npm run prisma:push
npm run db:seed
```

4. 启动开发服务：

```bash
npm run dev
```

访问：`http://localhost:3000`

## 3. 演示账号（seed）

- `admin@flman.cn / 123456`
- `manager@flman.cn / 123456`
- `sales1@flman.cn / 123456`
- `sales2@flman.cn / 123456`
- `finance@flman.cn / 123456`

## 4. 关键能力

- 多账号登录（NextAuth）
- 角色化首页（销售 / 财务 / 管理）
- RBAC 模块权限 + 数据范围隔离
- 客户中心、报价版本、单量监控、收入统计、财务中心、会议记录、监督打卡

## 5. 数据模型核心实体

- User / Role
- Customer / FollowUp / MeetingRecord
- Quote / QuoteAttachment
- CustomerOrderStat
- Reimbursement
- AttendanceRecord

详见：`prisma/schema.prisma`

## 6. 后续扩展方向

- 接入 Supabase（PostgreSQL + Storage）
- 审计日志（操作轨迹）
- API 版本化（`/api/v1`）
- 多租户或分公司隔离（如后续需要）

## 7. 线上部署（GitHub + Vercel + Supabase）

### 7.1 Supabase 准备

1. 在 Supabase 创建项目
2. 获取两个连接串：
   - `DATABASE_URL`（Pooler，端口通常 6543）
   - `DIRECT_URL`（Direct，端口通常 5432）
3. 在本地创建生产环境文件：

```bash
cp .env.production.example .env.production
```

并填入真实值。

### 7.2 GitHub 推送

```bash
git add .
git commit -m "chore: prepare production deployment with Vercel and Supabase"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 7.3 初始化 Supabase 数据库结构与种子

```bash
export $(grep -v '^#' .env.production | xargs)
npx prisma generate
npx prisma db push
npm run db:seed
```

### 7.4 Vercel 部署

在 Vercel 导入 GitHub 仓库后，配置环境变量：

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`（线上域名）

并重新部署。

部署后每次 `git push` 到默认分支会自动触发 Vercel 重新部署。
