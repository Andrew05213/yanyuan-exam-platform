# 和知 AI 接手说明

导出日期为北京时间 2026 年 11 月 19 日。源码来自已私有发布的版本，提交号为 427a55cee13aea3179d70038eb6170e3461f4624，包含最新扩大后的读书笔记编辑器。

## 打开工程

解压整个压缩包，将 hezhi-harness-export 文件夹作为 Harness 的工作目录。先读取本文件，再读取 HARNESS_TASK_复制到对话框.txt 与 lan/README.md。前后端、公开题库、研究资料链接、SQL 迁移、测试和依赖锁文件都在包内。依赖需要在接手机器重新安装。

项目采用 TypeScript、React、Vinext、Cloudflare Worker，当前数据访问依赖 D1 和 R2 接口。校内试用通过 Wrangler 的本地模拟器和独立账号网关运行。这些依赖需要在后续国内部署方案中明确处理。调用国产模型和实现国内部署分别验收。

## 启动顺序

建议首次在 Linux 或 Windows 的 WSL2 Linux 环境中运行。现有校内启动脚本依赖 Bash。

1. 安装 Node.js 22.13 或更新版本，并按照 package.json 的 packageManager 字段安装对应 pnpm。
2. 在工程根目录执行 pnpm install --frozen-lockfile。
3. 首次本地开发可执行 pnpm dev。本机开发登录使用项目附带的模拟身份，适合查看页面。文学笔记数据库需要应用迁移，Harness 应先检查本地 Wrangler 配置及存储位置，再执行迁移。校内多账号验收按后面的网关流程。
4. 校内运行先执行 YANYUAN_LAN_AUTH=1 pnpm build，然后按 lan/README.md 配置管理员、证书和 worker.env，执行 bash lan/start-built.sh。
5. 网关运行在 HTTPS 8443，本机后端监听 127.0.0.1:5173。通过网关注册或登录并测试个人数据。
6. 每个迁移编号按顺序应用，已有数据库由启动脚本检查待执行迁移。备份已有数据后再迁移。

完整的账号和证书设置见 lan/README.md。新电脑开始时拥有独立的数据库。

## 关键入口

- app/literature/study.tsx 为文学资料、笔记编辑和文学脉络
- app/literature/practice.tsx 为阅读后的口试回答、点评和复练
- app/api/literature/feedback/route.ts 为 DeepSeek 点评接口
- app/api/literature/entries/route.ts 为账号隔离的笔记保存与导入
- app/api/literature/materials/route.ts 为个人资料库
- public/training.html、public/hub.js 为备考与组卷界面
- public/bank.json、public/difficulty.json、public/schools.json 为公开训练内容与学校资料
- db、drizzle 为数据结构和迁移
- lan 为独立账号与校内 HTTPS 网关
- scripts/verify_notebook_api.mjs 与 scripts/verify_reading_review.mjs 为笔记和反馈验证
- .openai/hosting.json 为原托管站点配置，保留供追溯。迁移工作应先修改本地副本，新部署需要单独配置目标环境。

## DeepSeek 配置

由使用者在接手机器私有配置中填写真实密钥与已开通模型 ID。示例见 handoff-worker.env.example，复制到网关账号目录的 worker.env 再填写。Harness 自身的模型登录或订阅，与本网站后端的模型配置分别处理。真实网站调用需要后端可读取的有效凭据。

第一阶段完成文学口试点评的真实请求，核对引文、两个追问、异常提示、耗时和保存。随后增加 AI 专题出题。当前组卷主要从已有题库抽题，AI 动态整卷生成仍待开发。

## 验收要求

先测试登录、资料读取、笔记保存与恢复，随后验证真实模型反馈。测试至少覆盖一次成功请求、错误密钥、网络异常，以及返回内容不完整的情况。反馈引文需要匹配用户输入。题目生成需要校验题量、选项、答案与解析，并明确训练题来源和审核状态。

每阶段向用户提供可执行的启动命令、实际访问地址、修改文件和测试结果。真实模型调用需要保存脱敏的结果与耗时，缺少凭据时如实记录阻塞。

## 内容与数据

包内包含公开训练材料及参考文献链接。后续公开展示或传播时，需要核对原始材料的使用权限。源码导出包含项目自带的固定示例身份字符串和测试占位值。

个人云端笔记、历史作答、上传附件、账号数据库、真实 API 密钥及本机运行数据需要通过对应的数据导出、备份渠道另行处理。本包中的 JSON 备份入口支持笔记、状态与自建或修改过的文学资料。
