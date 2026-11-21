# 和知 AI 发布清单（源码包）

- 发布编号：`hezhi-source-20261119-2230-verified`
- 生成时间：2026-11-19 22:30（Asia/Shanghai）
- 对应验收：真实模型 `deepseek-flash`，文学点评/《丰饶之海》/日本国别/英语阅读/完整网页闭环均通过
- 旧快照保留：`versions/hezhi-source-20261119-212451.zip`（本包不影响旧快照）

## 本包包含

- 前后端源码（`app/`、`lib/`、`db/`、`worker/`、`components/`、`hooks/`）
- 前端静态站点（`public/`，含 `ai-questions.js`、`training.html`）
- 全部数据库迁移：`drizzle/0000`–`0011` 与 `drizzle/meta/`（journal + 快照）
- 依赖锁文件：`pnpm-lock.yaml`、`package.json`、`pnpm-workspace.yaml`
- 配置模板：`.dev.vars.example`、`handoff-worker.env.example`
- 部署与说明：`README.md`、`START_HERE_接手说明.md`、`HANDOFF_STATUS.md`、
  `docs/deepseek-server-config.md`、`docs/cloudflare-d1-r2-migration.md`、`lan/README.md`
- 验证脚本：`scripts/verify_*.mjs`、`scripts/export_personal_data.mjs`、
  `scripts/apply-d1-migrations.mjs`、`scripts/diagnose_deepseek.mjs`
- 测试与构建脚本、eslint/tsconfig/vite 配置

## 明确排除（已检查）

- `.dev.vars`（真实密钥）、`.env*`
- `node_modules/`、`.sites-runtime/`（pnpm store、浏览器 profile）
- `.wrangler/`（本地 D1 SQLite 与 R2 模拟数据）
- `dist/`、`.next/`、`.vinext/`
- `artifacts/`（截图、日志、生成内容）与 `*.log`
- `versions/`（历史快照与个人数据导出）
- 任何个人笔记、题库、作答、附件、录音

> 正式笔记不在源码包内。导出方式见文末。

## 部署到原私有站点

### 1. 先备份

- D1：`wrangler d1 export <DB> --remote --output backup-<date>.sql`（或平台备份入口）
- R2：按前缀 `essays/`、`community/`、`oral/` 同步备份
- 记录当前 `d1_migrations` 的最后编号

### 2. 执行迁移（按编号顺序，只追加）

已有库若最后是 `0009`，需要执行：

- `drizzle/0010_futuristic_korvac.sql`：新增个人题库表 `question_bank`
- `drizzle/0011_tan_micromax.sql`：新增 AI 出题任务表 `ai_question_jobs`

全新库则按 `0000`–`0011` 全部执行。执行后核对：

```sql
SELECT id, name FROM d1_migrations ORDER BY id;
```

托管环境由发布流程应用迁移；本机可用：

```powershell
node scripts/apply-d1-migrations.mjs --db <本地 sqlite 路径>
```

### 3. 配置变量（只填服务端，密钥值由你在托管平台填写）

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek 官方或中转密钥；只放服务端 Secret |
| `DEEPSEEK_MODEL` | 是 | 官方当前为 `deepseek-flash` 或 `deepseek-v4-pro` |
| `DEEPSEEK_BASE_URL` | 否 | 中转地址，如 `https://gateway.example.com/v1`；默认官方 |
| `AI_MODEL_HOSTS` | 否 | 非官方中转域名白名单，逗号分隔 |
| `ADMIN_EMAILS` | 管理后台必填 | 管理员邮箱，逗号分隔 |
| `ADMIN_USER_IDS` | 否 | 可信用户编号白名单 |
| `AI_CREDENTIALS_ENCRYPTION_KEY` | 后台保存 Provider 密钥时必填 | 32 字节 Base64，更换会导致旧密钥不可解密 |
| `LEGACY_OWNER_EMAIL` | 否 | 仅用于认领旧的无 owner 记录 |
| `ORAL_AUDIO_PROVIDER_ID` | 否 | 原音分析独立 Provider |

局域网另需：`YANYUAN_ADMIN_EMAILS`、`YANYUAN_PUBLIC_ORIGINS`、`YANYUAN_LAN_PREFIX`、
`YANYUAN_BIND`、`YANYUAN_DATA_DIR`、`YANYUAN_TLS_DIR`、`YANYUAN_ALLOWED_HOSTS`。

### 4. 发布后冒烟

1. 登录 → 资料读取 → 笔记保存/刷新恢复
2. `/api/ai-questions` 返回 `ready:true` 且模型名正确
3. 生成 3 题 → 预览标注“AI 生成 · 待审核” → 存题库
4. 题库组卷 → 作答 → 提交 → 错题 → 重做
5. 429 限流与 `retryAfterSeconds` 提示

## 仍需补跑的测试

- 本机 Miniflare 无法启动 workerd，以下隔离 Worker 套件需在 Linux/CI 补跑：
  `verify_admin.mjs`、`verify_multiuser.mjs`、`verify_notebook_api.mjs`、
  `verify_ai_grading.mjs`、`verify_oral_analysis.mjs`、`verify_merge_features.mjs`、
  `verify_ui_flows.mjs`、`verify_startup.mjs`、`verify_public_assets.mjs`
- `scripts/verify-ci.mjs` 全量套件
- `scripts/verify_lan_gateway.mjs`（需 HTTPS 网关、证书、管理员邮箱）
- 托管环境迁移演练：在备份副本上执行 0010/0011 后跑上述冒烟
- 国内部署适配层（SQLite/S3）尚未接入，需目标机器条件后单独实现与测试

## 正式笔记导出

个人笔记不在源码包内，使用下面任一方式单独导出：

```powershell
node scripts/export_personal_data.mjs `
  --base https://<站点域名> `
  --cookie "<登录后的 Cookie>" `
  --out ..\versions\personal-export.json
```

或直接调用（需登录 Cookie）：

- `GET /api/literature/entries`：读书笔记（含 tags、locator、reviewOn）
- `GET /api/literature/materials`：个人资料库
- `GET /api/archive`：训练卷/作答/错题/作文等档案元数据

本机已导出：`versions/hezhi-personal-notes-20261119-222848.json`（1 条笔记、45 条资料，不含密钥）。
