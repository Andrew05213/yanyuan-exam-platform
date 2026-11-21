# DeepSeek 服务端配置（文学点评 / AI 专题出题）

本项目的模型密钥只在服务端读取，浏览器不会收到密钥。两条等价路径，任选其一。

## 路径 A：服务端环境变量（推荐首次验收）

适合本机 `pnpm dev` 与局域网 `lan/start-built.sh`。

1. 复制示例文件：

   ```powershell
   Copy-Item .dev.vars.example .dev.vars
   ```

2. 在 `.dev.vars` 中填入真实值（该文件已被 `.gitignore` 忽略）：

   ```dotenv
   DEEPSEEK_API_KEY=sk-...
   DEEPSEEK_MODEL=deepseek-flash
   ```

   - `DEEPSEEK_MODEL` 必须是你在 DeepSeek 控制台已开通、可调用的模型 ID；不同账号可用 ID 不同，请按控制台填写。
   - 服务端默认使用 `https://api.deepseek.com/v1`。如使用中转/代理，设置 `DEEPSEEK_BASE_URL`，并把其主机名加入 `AI_MODEL_HOSTS`；否则请求会被允许列表拒绝（409），不会访问未知地址。

3. 重启 `pnpm dev`。生效顺序：`DEEPSEEK_API_KEY` + `DEEPSEEK_MODEL` 都存在时直接使用；否则回退到管理后台配置的默认 Provider。

4. 局域网试用时，把同样的两行写入账号目录的 `worker.env`（`lan/start-built.sh` 会用 `--env-file` 传给后端），权限设为仅运行账号可读。

## 路径 B：管理后台加密保存（适合多人维护）

1. 在服务端配置：
   - `ADMIN_EMAILS`（逗号分隔）或 `ADMIN_USER_IDS`；
   - `AI_CREDENTIALS_ENCRYPTION_KEY`：32 字节随机值的 Base64（43 字符 + `=`）。
     生成示例：`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`。
     更换主密钥会导致已保存的 Provider 密钥无法解密，必须重新录入。
2. 登录 `/admin`，新建 Provider，选择 DeepSeek 预设（OpenAI 兼容、`https://api.deepseek.com/v1`），保存 API Key。
3. 点“从上游获取模型”，选择控制台已开通的模型，保存并设为默认。
4. 页面与接口只显示“是否已设置”，不返回密钥原文、密文或前后缀。

## 两条路径的差异

| | 环境变量 | 管理后台 |
|---|---|---|
| 生效范围 | 整站单密钥 | 多 Provider、默认可切换 |
| 需要重启 | 是 | 否 |
| 适合 | 单机验收、局域网试用 | 长期维护、用量与费用统计 |
| 文学点评 | 支持 | 支持（须为 DeepSeek 官方主机） |
| AI 专题出题 | 支持 | 支持（须为 DeepSeek 官方主机） |

## 本机安全检查

- 不要把 `.dev.vars`、`worker.env`、`*.pem` 提交或打包；它们已在 `.gitignore` 中。
- 浏览器端只调用 `/api/literature/feedback`、`/api/ai-questions`、`/api/question-bank`，请求体不含密钥。
- 服务端对上游请求禁止重定向、限制响应大小与超时；错误信息会过滤密钥。
- 若密钥缺失：文学点评返回 503 并提示“尚无可用的默认模型”，AI 出题返回“模型未配置”，两者都不会清空用户输入。

## 验收命令

配置后执行：

```powershell
# 1) 文学口试点评：真实请求、脱敏结果与耗时写入 artifacts/
node scripts/verify_literature_feedback.mjs

# 2) AI 专题出题：真实生成 3 题并校验结构（需要已配置密钥）
node scripts/verify_ai_questions_live.mjs
```

两个脚本都会在 `artifacts/` 写出脱敏 JSON（不含密钥、不含完整学生原文），失败时返回非零退出码并保留原因。
