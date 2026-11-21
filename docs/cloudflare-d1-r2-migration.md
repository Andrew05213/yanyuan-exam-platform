# Cloudflare D1 / R2 依赖与迁移处理方案

本文先列清现有托管依赖，再给出国内部署的替换路径。任何会改变数据的迁移都应在备份后、按编号顺序执行；本次新增的个人题库是**追加迁移**，不修改既有表。

## 1. 现有绑定

| 绑定 | 配置位置 | 用途 |
|---|---|---|
| `DB`（D1） | `.openai/hosting.json` → `vite.config.ts` `d1_databases` → 构建后的 `dist/server/wrangler.json` | 全部业务数据、账号档案、AI 用量、题库 |
| `BUCKET`（R2） | `.openai/hosting.json` → `vite.config.ts` `r2_buckets` | 作文原稿图片、共享资料附件、口试录音 |

本地开发时 `vite.config.ts` 注入占位 `database_id`，由 Miniflare 在 `.wrangler/state/v3/` 下创建本地 D1/R2；生产由托管控制面注入真实绑定。

## 2. 数据表（全部在同一个 D1 库）

| 表 | 迁移 | 作用 |
|---|---|---|
| `archive_records` | 0000、0002 | 训练卷、作答、错题、预设、作文、旧版备份 |
| `attachments` | 0001、0002 | 作文原稿图片元数据 |
| `community_materials` / `material_files` | 0002 | 共享题库与附件 |
| `site_users` / `ai_providers` / `ai_usage_events` / `admin_audit_events` | 0003 | 用户档案、Provider、用量与审计 |
| `admin_access_log` / `oral_audio` / `quality_feedback` | 0004 | 后台访问日志、录音、质量反馈 |
| `ai_grading_jobs` | 0005 | 主观题 AI 批改任务 |
| `ai_task_settings` | 0006 | 原音分析独立 Provider |
| `entries` / `materials` | 0007–0009 | 文学笔记、个人资料库 |
| `question_bank` | **0010（本次新增）** | 用户确认后的 AI 生成题目，按 `owner_id` 隔离 |

### R2 对象键

| 前缀 | 写入位置 |
|---|---|
| `essays/asset-<uuid>` | `app/api/attachments/route.ts` |
| `community/material-file-<uuid>` | `app/api/material-files/route.ts` |
| `oral/oral-audio-<uuid>` | `app/api/oral-audio/route.ts` |

读取一律先按 `object_key` 查 D1，再校验所有权，浏览器不能直接指定对象路径。

## 3. 隔离机制

- 统一身份：`principal(request)` 读取网关注入的 `oai-authenticated-user-id`；旧数据 `owner_id IS NULL` 只对配置了 `LEGACY_OWNER_EMAIL` 的账号可见，并在写入时认领。
- 新表 `question_bank` 的每条 SQL 都带 `owner_id = 当前用户`；跨用户 id 返回 404/409，不返回他人内容。
- 文学笔记/资料使用第二套 `getChatGPTUser()` + `user_id` 隔离，新增题库没有混用两套键。

## 4. 迁移机制

1. 结构定义在 `db/schema.ts`（含 re-export 的 `db/literature-schema.ts`）。
2. 生成：`pnpm db:generate`（drizzle-kit），产物为 `drizzle/NNNN_tag.sql` + `drizzle/meta/_journal.json` + 快照。
3. 已应用迁移不可修改；新改动只追加编号。
4. 台账：D1 表 `d1_migrations(id, name, applied_at)`，`name` 为含 `.sql` 的文件名。
5. 三个应用入口：
   - **托管站点**：部署时由控制面应用已提交迁移。
   - **局域网**：`lan/start-built.sh` 执行
     `wrangler d1 migrations apply DB --config dist/server/lan.json --local --persist-to "$data/storage"`。
   - **本机 dev**：`pnpm dev` 不会自动迁移。本机可用
     `node scripts/apply-d1-migrations.mjs --db <本地 sqlite>`（与 wrangler 台账格式一致），
     或在能启动 Miniflare 的机器上执行 wrangler 命令。
6. 幂等：脚本按 `d1_migrations.name` 跳过已应用项；重复运行输出 `0 migration(s) applied`。

### 本机存储位置

| 场景 | 位置 |
|---|---|
| `pnpm dev` | `<repo>/.wrangler/state/v3/d1|r2` |
| `pnpm start` | 同上（`--persist-to .wrangler/state`） |
| 局域网 | `~/.local/share/yanyuan-lan/storage/`，账号库 `accounts.sqlite`，TLS 与 `worker.env` 同目录 |

## 5. 国内部署选项

### 方案 A：保留 Cloudflare
若目标机器可稳定访问 Cloudflare 且合规允许，直接沿用 D1/R2；迁移只走“部署时应用”。优点是零改造；缺点是跨境网络与数据合规风险。

### 方案 B：D1 → SQLite（推荐的单机/校内方案）
- 保持 `env.DB` 的 D1 接口形状：`prepare().bind().first()/all()/run()`、`batch()`。实现一个 SQLite 适配层（`node:sqlite` 或 better-sqlite3），在 `db/index.ts`、`db/store.ts`、`lib/admin-access.ts` 注入。
- 迁移文件原样复用；台账仍是 `d1_migrations`。
- 注意：D1 的 `meta.changes`、`RETURNING`、部分唯一索引（`WHERE is_default=1`、`status='pending'`）需确认 SQLite 版本支持（3.35+ 均支持）。
- 备份：停服后复制 `.sqlite` 文件及 `-wal/-shm`，或 `VACUUM INTO`。

### 方案 C：R2 → 本地磁盘 / S3 兼容存储
- 现有代码只用 `BUCKET.get(key)`、`BUCKET.put(key, body, {httpMetadata})`（以及删除失败回滚时的 `delete`）。实现同名适配层即可。
- 单机：落盘到数据目录，路径做 `..` 穿越校验；多机：MinIO / 阿里云 OSS / 腾讯云 COS 的 S3 兼容接口。
- 数据库仍存 `object_key`，迁移时按前缀原样搬迁。

### 账号网关
- `lan/gateway.mjs` 已独立于 Cloudflare，账号/会话在 `accounts.sqlite`，转发到 `127.0.0.1:5173`。
- 新增接口已加入网管白名单：`/api/ai-questions`、`/api/question-bank`。国内部署若不使用该网关，需要在反向代理层实现等价的身份注入与来源校验。

## 6. 本次改动对数据的影响

- **只新增** `question_bank` 表与两个索引（迁移 0010），不修改、不删除既有表或数据。
- 个人题库通过 `archive_records` 之外的独立表保存，但组卷产物仍是标准 `packet` 记录，作答/错题/档案完全复用既有结构。
- 本机验证库已应用 0010；托管站点与局域网库需在各自发布/启动流程中应用同一迁移。
- 迁移前请备份：D1 导出（`wrangler d1 export`）或复制本地 sqlite；R2 按前缀同步。

## 7. 验收顺序（每次迁移）

1. 备份当前库。
2. `node scripts/apply-d1-migrations.mjs --db ...` 或 wrangler 命令应用。
3. `SELECT name FROM d1_migrations ORDER BY id` 核对编号连续。
4. 冒烟：登录 → 读档案 → 写一条笔记/题库 → 刷新恢复。
5. 再跑一次迁移，确认输出 0 条（可重复运行）。
