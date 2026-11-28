# 可核验的版本更新与回退

- main CI 构建后自动生成 SHA-256 资源指纹及 release.json，检查产物、入口和版本一致；通过全部回归才归档 manifest。GitHub Actions 未持有正式机密钥，不自动发布生产。
- `pnpm build` 产物位于 dist/client 和 dist/server；/api/release 由编译后的后端提供 commit，不从网页推断。部署后用 `node scripts/check-release-health.mjs https://站点域名 完整40位提交SHA` 检查实际 HTML、后端提交、全部入口资源字节；不读取私人数据、不调用 AI。
- LAN 网关默认仍为原开发模式，采用无版本 URL 和重新验证；生产候选可显式配置 YANYUAN_SERVE_BUILT=1，网关工作目录须为候选 checkout，后端须运行同一 checkout 编译的 Worker，监听既有回环端口。必须配置外置 D1/R2 状态、认证账号数据、TLS/密钥、真实域名和受信证书；不要把这些复制进 release checkout 或 CI artifact。
- 运维方可在独立目录从已通过 CI 的 main 精确提交创建候选 checkout，安装锁定依赖、构建、验证并完成隔离测试；不能直接覆盖正在运行的目录。配置 releases/current 符号链接、两个独立 release 目录及由运维方维护的固定绝对路径重启 hook（同时重启网关和后端，禁止从 PR 取得服务命令）。以专用低权限账户运行，限制目录写权限。
- 只有新旧 release 已有有效 manifest、当前健康、新 commit 与候选一致且候选没有已跟踪文件本地改动、迁移文件没有变化且数据库兼容已人工确认，才运行 `node scripts/activate-verified-release.mjs /绝对路径/releases/current /绝对路径/releases/候选 完整SHA /绝对路径/restart-hook https://站点域名`。先加互斥锁，再原子切换 symlink，重启并检查前后端/全部入口资源；失败则恢复旧 symlink、重启并验证旧版。回滚失败需人工立即处理。自动回退不恢复数据库；迁移变更或首次采用本流程必须另行备份、人工部署和验收。切勿自动恢复旧数据覆盖新增记录。
- 若已有服务器自动更新器，需由部署方接入上述流程或等效机制并验证；目前仓库无法证明正式服务器已接入。不要将 GitHub CI 成功当作生产已更新。
