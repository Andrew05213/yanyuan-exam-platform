# 接手状态（2026-11-19）

本文件记录本次在本机副本上实际完成、已验证和仍待条件的事项。原托管站点有独立发布配置，本次没有改动线上环境。

## 已完成

### 1. 运行环境与本地启动
- 依赖按 `pnpm-lock.yaml` 安装（`pnpm install --frozen-lockfile`），使用项目内 `.sites-runtime/pnpm-store`。
  - 本机 Windows 下需要 `node-linker=hoisted`（符号链接受限）与 `ignore-scripts`（沙箱禁止子进程管道）；esbuild/workerd 二进制可用。
- 本地 D1 迁移已应用到 `.wrangler/state/v3/d1`，共 12 条（0000–0011）。
  - 新增离线迁移脚本 `scripts/apply-d1-migrations.mjs`，台账格式与 wrangler 的 `d1_migrations` 一致，可重复运行。
- `pnpm dev` 运行于 `http://127.0.0.1:5173/`；`/`、`/training.html`、`/literature`、`/admin` 均返回 200。
- 修复：Vite 监视器会被工具临时文件触发 `EBUSY` 崩溃，已在 `vite.config.ts` 忽略 `.wrangler`、`.sites-runtime`、`artifacts` 与 `*.tmpdir`。

### 2. DeepSeek 服务端配置
- 文档：`docs/deepseek-server-config.md`，示例：`.dev.vars.example`（均已被 `.gitignore` 覆盖）。
- 两条路径：服务端环境变量 `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL`，或管理后台加密 Provider（`AI_CREDENTIALS_ENCRYPTION_KEY`）。
- 密钥只在服务端读取；前端只调用自有路由。

### 3. 文学口试点评
- 现有接口 `/api/literature/feedback` 的契约测试通过（引文必须来自学生输入、证据缺口、修改建议、两个不同追问）。
- 浏览器端失败保留输入已实测：在 `/literature` 打开作品 → 填写依据与回答 → 提交（模型未配置，503）→ 两个文本框内容原样保留，按钮恢复可用。
- 真实模型调用**未执行**：本机没有 DeepSeek 凭据。阻塞结果与耗时已写入
  `artifacts/literature-feedback-<timestamp>.json`（`status: blocked`，仅保存长度与哈希）。
- 配置凭据后运行：`node scripts/verify_literature_feedback.mjs`（成功时写出脱敏反馈与耗时）。

### 4. 组卷入口的 AI 专题出题
- 新页面模块 `public/ai-questions.js`，接入实时组卷页 `TierStudio`：
  - 科目：英语（阅读 / 词汇语法）、日本国别、文学口试；
  - 主题、难度、题型、数量、限时；
  - 生成中状态、失败提示与“重试”、全选/取消、逐题预览（题干/选项/答案/解析）、保存到个人题库；
  - 生成内容统一标注“AI 生成 · 待审核”，组卷说明也注明未审核。
- 服务端 `app/api/ai-questions/route.ts` + 纯逻辑 `lib/ai-question-generation.ts` + 校验 `lib/question-bank-contracts.ts`：
  - 严格 JSON 解析（容忍代码块/前后说明），题量、选项数、答案、解析、重复项、HTML 注入、口试参考回答等校验；
  - 失败不会保存任何题目；返回耗时、模型、`reviewStatus: "pending"`。

### 5. 个人题库与组卷
- 新表 `question_bank`（迁移 `0010_futuristic_korvac.sql`），按 `owner_id` 隔离，带 revision 乐观锁。
- `app/api/question-bank/route.ts`：GET 列表、POST 批量保存（≤20 组）、PUT 审核状态、DELETE（需 revision）。
- 组卷闭环：
  - “用我的题库组卷”生成标准 schema-2 笔试卷（英语/日本国别）或 schema-1 口试卷（文学口试）；
  - 保存后经现有 `Hub.createPacket` → `archive_records(kind=packet)`，作答/错题/学习档案流程不变；
  - 英语题库条目会并入常规组卷库存（`TierStudio.data.items`），社区资料刷新后会自动重新合并。
- 实测：笔试卷 10 项断言、口试卷 5 项断言全部通过（含 hash 跳转、题目渲染、档案落库、`sourceId` 回指题库）。

### 5b. AI 出题限制（服务端）
- 新表 `ai_question_jobs`（迁移 `0011_tan_micromax.sql`）记录每次生成，用于限流、幂等重放和失败记录。
- 限制：每账号 **每 10 分钟 6 次**、**每天 30 次**、**单次最多 10 题**（阅读最多 6 题，口试最多 5 题）。
- 重复提交保护：客户端为每次生成带 `requestId`；同一编号 + 相同内容直接返回缓存结果（不重复调用模型），同一编号换内容返回 409，正在生成的相同请求提示稍候。
- 超限返回 429，带 `retryAfterSeconds` 与限制元数据；前端显示倒计时并在解除后恢复按钮。
- 结果与失败都会写入任务行；失败请求不返回题目，重试会使用新的 `requestId`。

### 6. 账号网关与 D1/R2
- 审计文档：`docs/cloudflare-d1-r2-migration.md`（绑定、表、R2 前缀、存储位置、迁移机制、国内替换方案）。
- 网关白名单已加入 `/api/ai-questions`、`/api/question-bank`；`lan/README.md` 已补充说明。
- 本机持久化实测：文学笔记 PUT/GET 往返（含 workId/tags/locator/reviewOn）、题库保存/审核/删除/跨用户拒绝。
- 本次只新增 `question_bank` 表，不改既有表结构；托管库与局域网库尚未应用 0010（需在各自发布/启动时执行）。

### 7. 验证结果
| 检查 | 结果 |
|---|---|
| `node --experimental-strip-types scripts/verify_ai_questions.mjs` | 37 项通过 |
| `node --experimental-strip-types scripts/verify_ai_limits_http.mjs` | 13 项通过（429、幂等重放、requestId 复用、单次上限、失败留痕） |
| `node scripts/verify_question_bank_http.mjs` | 21 项通过 |
| `node scripts/verify_bank_compose.mjs` | 10 项通过 |
| `node scripts/verify_oral_compose.mjs` | 5 项通过 |
| `node scripts/verify_app.mjs` | 通过 |
| `node scripts/verify_ai_contracts.mjs` | 通过 |
| `node scripts/verify_lan_auth_policy.mjs` | 通过 |
| `node --experimental-strip-types scripts/verify_reading_review.mjs` | 通过 |
| `tsc --noEmit` | 0 错误 |
| `pnpm build` | 成功，包含 2 个新路由 |

## 真实验收结果（2026-11-19 晚，deepseek-flash）

- 可回退快照：`C:\Users\王\Documents\deepseek-harness\default-workspace\versions\hezhi-source-20261119-212451.zip`
  （25.8 MB，538 个源文件，SHA256 `02068B88E8F8B62BBD0B1D1E6DEE1B7D34AF81822EBA84D9DF254AB98333DA9F`）。
- 私有配置准确路径：`C:\Users\王\Documents\deepseek-harness\default-workspace\hezhi-harness-export\.dev.vars`
  （已 gitignore；当前模型 `deepseek-flash`，密钥为官方 `sk-` 格式）。
- 上游模型：`GET /models` 返回 `deepseek-flash`（DeepSeek-V4.1-Flash，1M 上下文），账号余额可用。
- 密钥诊断过程：前两次 36 位非 `sk-` 密钥均被 `api.deepseek.com` 以 **401** 拒绝（网络正常，约 528 ms；不是余额或模型名问题）；
  换成官方 `sk-` 密钥后 `/models` 与 `/chat/completions` 均 200。

| 验收项 | 结果 |
|---|---|
| 文学点评（`verify_literature_feedback.mjs`） | 成功，2222 ms，引文/证据缺口/建议/两个追问全部通过 |
| 《丰饶之海》完整练习（`verify_hojo_flow.mjs`） | 成功，3020 ms，8 项通过；复练后保存，刷新后笔记仍在（`literature-hojo-*.json`） |
| 日本国别 3 题（少子老龄化） | 成功，5169 ms，3 题 4 选项、解析完整、无统计数字；内容已人工核对政策事实 |
| 英语阅读 5 题 | 成功，12589 ms，原文 2762 字符；5 题均可由原文推出、无多解、解析引用原文 |
| 完整网页流程（`verify_full_flow.mjs`） | 成功，14 项通过：生成→预览→存题库→组卷→作答→提交→错题→重做→刷新 |
| 个人数据落库 | 刷新后 D1 中同时存在 `packet`、`written-attempt`、`error-set`、`review-attempt` 四类记录 |
| 限流 | 13 项 HTTP 检查通过；真实配置下 429 界面显示“限流中 94s”倒计时（`studio-ai-limit.png`） |

- 训练卷/题库截图：`artifacts/full-flow-archive.png`；文学复练：`artifacts/literature-hojo.png`。
- 已检查 `dev.log` 与 `artifacts/`，不存在密钥原文。

### 真实调用中发现并修复的问题

1. **日本国别被当成口试**：`section` 为 `country`，提示词只判断 `mc`，落入口试分支，返回空选项。
   已改为 `mc || country` 并明确“笔试客观题，不是口试”。
2. **日本国别生成日文阅读题**：模型输出日文文章与“本文の内容…”题干，和中文知识题定位不符。
   已强化提示词（中文题干/选项/解析、自包含、不得附阅读材料），并增加结构校验：
   知识题带阅读材料、引用“上文/本文”、非中文题干、选项含“以上都对”均拒绝。
3. **思考模式挤占输出**：官方新模型默认开启思考，5 token 测试即出现 `finish_reason=length`。
   两条模型调用均对 `api.deepseek.com` 显式发送 `thinking:{type:"disabled"}`。
4. **中转/代理不可用**：原先硬编码官方地址。已增加 `DEEPSEEK_BASE_URL`，主机仍需在 `AI_MODEL_HOSTS` 白名单内。
5. 测试脚本问题（非产品缺陷）：Radix 标签页需 pointer 事件、保存提示需整页文本轮询；已修正。

### 仍需人工审核的生成内容

题库中的 3 道日本国别题仍为 `pending`（界面显示“AI 生成 · 待审核”）。建议教师复核：

1. 第 1 题“现收现付型”表述：日本公年金为賦課方式，但另有 GPIF 积累金，措辞可再精确。
2. 第 2 题儿童津贴/育儿休假的具体范围随年度制度调整，需按最新年度核对。
3. 第 3 题“购物弱者”定义可核对经济产业省手册；地方交通现状建议补一项年度数据。

核对来源：GPIF《公的年金制度》<https://www.gpif.go.jp/gpif/public-pension-scheme.html>；
经济产业省“買い物弱者”资料 <https://www.meti.go.jp/policy/economy/distribution/pdf/kaimonoseminar.pdf>。

## 仍待条件

1. **真实模型验收已完成**：官方 `sk-` 密钥下，文学点评、《丰饶之海》复练、日本国别、英语阅读与完整网页流程全部通过（见上表）。
2. **Miniflare 测试套件**：本机 `wrangler`/Miniflare 直接启动 workerd 时报 `ERR_RUNTIME_FAILURE`（`std::terminate`），因此 `verify_admin`、`verify_multiuser`、`verify_notebook_api` 等隔离 Worker 套件无法在本机运行；Vite 插件内的 workerd 正常。需在 Linux/CI 或可正常启动 Miniflare 的机器补跑。
3. **局域网网关实测**：需要 TLS 证书、`YANYUAN_ADMIN_EMAILS`、Bash 与 Linux（`lan/start-built.sh`）；本机未启动 HTTPS 网关，也未跑 `verify_lan_gateway.mjs`。
4. **国内目标机器部署**：等待机器的网络、操作系统、域名/证书、存储与合规条件；方案见 `docs/cloudflare-d1-r2-migration.md`，代码尚未接入 SQLite/S3 适配层。
5. **迁移到托管/局域网库**：0010（题库）与 0011（出题任务/限流）需在目标库执行并备份；本次只改了本地副本。
6. **限流参数**：当前为每 10 分钟 6 次、每天 30 次、单次 10 题；公开部署前可按年级/班级在 lib/ai-question-limits.ts 调整。

## 常用命令

```powershell
# 安装（本机 Windows 约束）
pnpm install --frozen-lockfile --config.node-linker=hoisted --config.ignore-scripts=true

# 启动
pnpm dev            # http://127.0.0.1:5173/

# 离线应用本地 D1 迁移
node scripts/apply-d1-migrations.mjs --db .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite

# 构建与检查
pnpm build
node scripts/verify_ai_questions.mjs
node scripts/verify_question_bank_http.mjs
```
