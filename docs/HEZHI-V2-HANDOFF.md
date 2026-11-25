# 和知 AI 2.0 · 中国版技术交接与合并前验收

交接日期：2026-11-25。交接对象：负责中国版部署、维护和审核的同学。
**本次仅交接源码和审核资料，不批准合并、不部署、不操作生产数据库。**
主分支基线：bd14c09869f93257a2ad1e919bd0241d32ba51c8（保留同学已经完成的中国版修改）；交接代码：feature/knowledge-community-v2，PR #3，交接前功能及测试修复提交 af16036。PR 继续保持 Draft，必须同学实际审核通过并由用户明确授权后才可考虑合并。

## 1. 改动范围

| 阶段 | 内容 | 主要文件与入口 | 状态 |
|---|---|---|---|
| 1 | 任意语种、原文语种、学科、筛选、备份兼容 | app/literature/notes.ts, entries API, db/literature-schema.ts | 独立阶段 CI 通过 |
| 2 | 公共议题、多人独立笔记、显式公开和撤回 | community.tsx, /api/literature/community | 修复后阶段 CI 通过 |
| 3 | 段落批注、作者回复、版本绑定、举报及屏蔽 | research-interactions.tsx, /api/literature/interactions | 阶段 CI 通过 |
| 4 | 双向引用、手动衍生关系、观点对照、共享书目 | research-network.tsx, /api/literature/network | 阶段 CI 通过 |
| 5 | 本地多语种检索、AI 关键词扩展、观点/文献/问题分析 | research-assistant.tsx, research-assistant-contract.ts, /api/literature/research-ai, lib/study-ai.ts | 早期构建和类型检查通过；模拟请求体测试修复待最新 CI |
| 6 | 今日学习、统一品牌、深链、移动端布局 | public/today.js, public/index.html, public/app.js, /api/today, study.tsx, CSS | 代码提交；完整最新 CI 与浏览器验收未完成 |

保留已有学校中心、组卷、口试、作文与翻译、错题、学习档案、原始样卷、题库、文学资料、原有 Provider 配置、用量核算、LAN 网关与 OCR。数据库和已保存数据不清空，不覆盖生产配置。此前通过 CI 的版本不是对最终组合版本的验收结论。

## 2. 本地审核步骤（独立工作区与测试数据库）

```bash
git fetch origin
git switch -c review-hezhi-v2 origin/feature/knowledge-community-v2
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
pnpm install --frozen-lockfile
node scripts/prepare-ocr.mjs
pnpm run build
pnpm exec tsc --noEmit
node scripts/verify-ci.mjs
```

使用 CI 固定 Node 22.18.0（最低 22.13）、pnpm 11.25.0。命令在全新审核 checkout 执行；如同名本地分支已存在，改用新名字。不要直接在运行中的生产工作树执行。构建会通过 run-framework.mjs 重新生成文学入口；不要只复制 public/index.html 或单个前端文件。测试套件使用隔离 D1、合成账号和模拟模型，不需要生产密钥。没有执行生产部署。CI 见 PR Checks。

第五阶段排错记录：初版 verify_research_assistant.mjs 在首个模拟模型请求返回 502，诊断提交 a45f709 将断言失败与模型响应分开，确认后续 AI 功能/计量断言执行到了最终隐私断言；实际 mock body 为 ReadableStream，原序列化无法读取中文或 PRIVATE_B。af16036 改为流式解码并等待全部检查，**没有删除隐私断言**。该修复仍需 CI 验证。若仍失败，检查 MockAgent 的流读取生命周期、UTF-8 解码、请求 body 实际结构及断言，勿将真实模型请求改为无验证模式。先解决失败再评估后续套件；CI 是 fail-fast，之前失败使其后的测试未执行。

## 3. 数据库迁移与回退

依顺序核对实际已应用迁移。基线预期截至 0011；以实际数据库迁移账本为准，不凭文件名猜测。只应用尚未执行的增量迁移：
- 0012_multilingual_notes.sql：entries 增加可空 language、source_language、discipline；保留旧笔记。
- 0013_research_community.sql：research_topics、research_publications；历史笔记不会自动公开。
- 0014_research_interactions.sql：research_annotations、research_replies、research_blocks、research_reports、research_hidden；撤回公开笔记级联移除批注和回复。
- 0015_research_network.sql：research_links、research_references；撤回时级联移除引用边。
- 第五、第六阶段没有新迁移。研究助手使用原 ai_usage_events。

先停写或使用一致性快照方式备份测试/正式环境的 D1、R2、LAN 账号与会话目录、配置、TLS、加密主密钥；备份文件只允许授权维护者访问。测试环境应使用独立状态目录、独立账号和假数据，不复制真实私人正文到公开仓库。根据原部署的迁移机制及 D1 binding 执行，勿重复直接执行 ALTER TABLE，勿 reset 或重建数据库。先验证旧库升级、原数据行数与旧记录读取、外键级联、数据库完整性及备份恢复。正式回退优先保留兼容的新增表列，必要时恢复一致快照并协调新写入数据；不能把有新记录的数据库直接覆盖成旧快照。保持旧发布版本可重新运行。

## 4. 中国版运行环境

沿用 lan/README.md 与 docs/admin.md：
- 上游仍仅监听 127.0.0.1:5173，YANYUAN_LAN_AUTH=1；不得将上游直接暴露。
- 保留网关真实来源校验、会话认证、身份头清洗、管理员白名单、HTTPS 证书与现有域名和端口配置。YANYUAN_PUBLIC_ORIGINS 必须包含完整实际 HTTPS 来源（包括非默认端口），YANYUAN_ALLOWED_HOSTS 只配置主机名。
- 保留 YANYUAN_ADMIN_EMAILS / ADMIN_EMAILS 的对应关系和已有 ADMIN_USER_IDS；管理员凭据不能公开。原 .dev.vars 与加密主密钥继续留在服务器私有目录。无需重新申请或提交 API Key，不改现有模型默认选择。
- LAN 新增精确路由 /api/literature/community、/api/literature/interactions、/api/literature/network、/api/literature/research-ai、/api/today；不扩大整个 API 前缀。
- 原网关的注册邮箱未验证、没有找回密码；原 README 明确它不是生产互联网部署。**公开研究社区的“公开”目前为所有已登录用户可见，并未实现邀请制/审核准入。不得向不受控陌生用户开放。** 在开放前由维护者落实受控账号注册或访问边界、举报责任人、隐私说明及有效处置方案（包括账号级禁用）。在缺少上述条件时仅隔离测试。

## 5. 必须逐项验收（均未做真实环境验收）

- [ ] 最新 PR 完整 CI 绿色，所有测试实际执行而非跳过；检查差异没有生产配置、密钥、真实笔记或私人数据。
- [ ] 两个普通测试账号 A、B 与独立管理员：A 的旧笔记、导入导出、个人资料与档案 B 不能读取；无登录与伪造身份头被拒绝；跨站写入被拒绝。
- [ ] A/B 同议题分别发布独立笔记，相同私人笔记 ID 不串账号；预览明确且不自动公开，改私人正文不改变公开快照，撤回不删私人原稿。
- [ ] 批注对应当前段落和版本；重新发布旧批注不冒充新批注；作者回复权限、本人删除、管理员隐藏/恢复、双向屏蔽及解除均验证；撤回级联删除互动和引用。
- [ ] 同议题双向引用、衍生研究、2–3 篇对照、共享文献举报/恢复；隐藏/屏蔽/撤回内容不出现在其他 API、统计、搜索或对照中；检查缓存和延迟响应。
- [ ] 研究助手：本地搜索无需 Provider；未选私人材料不被发送，混合范围拒绝，预览摘要绑定内容/版本/用户/Provider；变更材料或模型必须重新确认。模拟恶意材料指令、假引文、失效材料、非本人 ID、异常响应、调用超额，检查拒绝和费用计量；真实模型测试仅用人工合成材料、经维护者明确同意。模型结果不是学术事实核验。
- [ ] 旧版训练：学校中心、题量/题型、组卷、口试、计时、作文与 OCR、客观判分、AI 批改、错题、导入导出、管理员统计与原始资料均实际可用；不把非官方训练标成真题。
- [ ] 桌面与手机真实浏览器：默认今日学习、全部旧 hash 路由、/literature#notes/#community/#review、#note/id 深链、输入法、键盘导航、窄屏布局、加载失败和返回导航；网关 HTTPS、静态资源缓存及新路径均验证。测试账号不能看到另一人的今日记录。
- [ ] 测试环境迁移、备份恢复和启动回退演练完成；测试账号清理；同学签字或在 PR 中留下审核结论。
- [ ] 受控社区访问与管理责任落实，用户明确同意模型发送机制，明确上游保留政策；用户最终明确授权合并。未满足任一阻断项不得合并或部署。

## 6. 已知边界与待处理项

- 当前并非跨语种向量索引，使用字面匹配与可选模型词扩展；书目是用户填写的元数据，不验证真伪，不上传全文或自动抓取外网。模型分析每次 1–4 份，每份最多 4500 字符，24 小时 12 次请求，结果不自动持久化。模型上游可能留存已发送信息，撤回不能收回远端副本。
- 衍生笔记主动发布后手动建立关系；关联限同议题，比较选当前页 2–3 篇。历史关联保留版本号而非完整旧正文。无跨议题图谱、全文版本档案。
- 管理员可审查公开内容举报摘录，不能借此查看私人档案。当前缺少账号封禁、邀请制、独立治理工作流及完整审核历史；隐藏后撤回再发布可能产生新 ID，须评估重复发布治理。
- 今日统计按北京时间计算保存/更新，不等于完成任务、学习时长或未掌握题数。手机视觉与真实网关尚未验证。
- 本交接属于代码阅读与既有 CI 结果整理，不是完整渗透测试或生产验收。请在 PR 按阻断项反馈，保留所有旧功能与同学改动，解决最新 CI 后复核完整组合。
 
## 7. 交接索引

PR：https://github.com/Andrew05213/yanyuan-exam-platform/pull/3
第四阶段成功 CI：https://github.com/Andrew05213/yanyuan-exam-platform/actions/runs/45606334436
最新流式测试修复 CI（交接编写时运行中）：https://github.com/Andrew05213/yanyuan-exam-platform/actions/runs/45610764180
模块说明：multilingual-notes.md、research-community.md、research-interactions.md、research-network.md、research-assistant.md、workspace-ux.md（本目录）。
合并责任：同学先审查并确认，用户明确授权后再考虑合并。此次交接没有执行合并、部署或真实模型调用。
