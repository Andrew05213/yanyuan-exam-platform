# 局域网试用

此入口用于单台 Linux 虚拟机的局域网试用。`gateway.mjs` 提供 HTTPS、独立账号、会话与注册，转发到仅监听 `127.0.0.1:5173` 的现有服务。设置 `YANYUAN_LAN_AUTH=1` 后关闭原本的本机模拟登录；不要让 5173 端口直接对外监听。网关从可信会话生成用户身份并删除所有客户端身份和转发头。

网关在 `~/.local/share/yanyuan-lan/` 保存账号、会话与 TLS 密钥。目录应仅由运行账号访问；原项目的 `.dev.vars` 保存管理员白名单和 Provider 密钥加密主密钥，也必须保留私有权限。数据库、原稿图片、录音、账号和密钥需一起备份。

域名经反向代理转发到不同内网端口时，通过 `YANYUAN_PUBLIC_ORIGINS` 显式配置浏览器使用的 HTTPS 来源（例如 `https://exam.example.com`，多个来源以逗号分隔）。仅配置同域名的精确来源，不使用客户端转发头推导可信来源。来源不匹配返回 403；真正触发限流返回 429 并提供重试时间。登录失败按账号与来源地址限制，注册采用独立额度，避免共享路由器下的正常用户相互影响。`node scripts/verify_lan_auth_policy.mjs` 检查这些规则。

若用户使用非默认端口访问，例如 `https://exam.example.com:8443`，必须把包含端口的完整来源写入 `YANYUAN_PUBLIC_ORIGINS`，即使反向代理转发的 Host 头省略了端口。同时通过原服务的 `YANYUAN_ALLOWED_HOSTS` 配置允许的域名（只填主机名，不填协议与端口）。

运行服务前，设置 `YANYUAN_ADMIN_EMAILS` 为逗号分隔的管理员邮箱；同一组邮箱需配置到原服务的 `ADMIN_EMAILS`。管理员邮箱不能通过公开注册占用。首次执行 `node --experimental-sqlite lan/gateway.mjs bootstrap-admins` 会创建管理员并将随机初始密码写入私有文件；禁止覆盖已有管理员账号。管理员首次登录后应使用“修改密码”，并安全删除初始密码文件。

`YANYUAN_BIND` 默认为 `127.0.0.1`。局域网部署可设为 `0.0.0.0`，配合 `YANYUAN_LAN_PREFIX` 设置允许的 IPv4 /24 网段。TLS 的 `server.key` 和 `server.crt` 默认放在账号目录，也可以通过 `YANYUAN_TLS_DIR` 指定。IP 地址变更时需要更新证书。运行 `node --experimental-sqlite lan/gateway.mjs` 启动 HTTPS 8443 端口。

自签名证书默认不被其他设备信任，证书指纹应通过可信渠道核对；正式服务应配置与域名匹配、受设备信任的证书。试用注册不验证邮箱，暂不支持找回密码；无法以已注册邮箱作为真实身份的证明。该方案使用 Vite / 本地 D1 和 R2 模拟器，不是面向公网的生产部署。

`scripts/verify_lan_gateway.mjs` 使用 `LAN_TEST_URL` 和 `LAN_TEST_CA` 测试加密连接、账号隔离、管理员保留邮箱、伪造身份头、跨站请求、敏感文件屏蔽和密码修改；测试会创建测试账号与档案，需在隔离环境运行并清理。


## 和知 AI 合并版的校内演示

在 Linux x86-64 机器安装 Node.js 22.13+ 和项目锁定的 pnpm，执行 `pnpm install --frozen-lockfile`、`YANYUAN_LAN_AUTH=1 npm run build`。将与访问域名匹配的 TLS 证书与密钥保存为上述 server.crt 和 server.key。设置 YANYUAN_ADMIN_EMAILS 后在项目根目录运行 `bash lan/start-built.sh`。该入口使用构建后的页面与静态资源，按顺序应用尚未执行的数据库迁移，将笔记、题库档案和上传文件保存在账号目录的 storage 子目录。通过 HTTPS 8443 端口访问，登录使用网关独立账号。

模型联调时可在账号目录创建仅运行用户可读的 worker.env，设置 DEEPSEEK_API_KEY、DEEPSEEK_MODEL（控制台中已开通的模型 ID）。管理功能按需配置 ADMIN_EMAILS 与密钥加密主密钥。恢复同一台演示站时，停服后备份或还原整个账号目录。托管账号与局域网账号使用不同身份标识，新部署默认从空白个人档案开始。

AI 专题出题与个人题库已接入网关白名单：`/api/ai-questions`、`/api/question-bank`。前者使用与文学点评相同的服务端 DeepSeek 配置（环境变量或后台默认 Provider），后者按网关转发的用户编号隔离；浏览器不会收到密钥。局域网机器还需要 Bash 与 Node 22.13+，并使用 `node --experimental-sqlite lan/gateway.mjs` 启动网关。新增题库表需在启动前应用 `drizzle/0010_futuristic_korvac.sql`（`start-built.sh` 会自动应用未执行迁移）。

### 独立版数据备份与恢复

停掉网关和 Worker 后，执行 `bash lan/backup.sh /backup/hezhi.tar.gz.gpg`，在 GnuPG 提示中设置备份密码。备份涵盖数据目录内的账号、笔记、题库、作答、文件和配置。外置证书目录需要单独保管。用 `bash lan/restore.sh /backup/hezhi.tar.gz.gpg /srv/hezhi-restored` 恢复到全新目录，再以该路径设置 YANYUAN_DATA_DIR，启动后核对两名测试用户的记录、附件和录音。Sites 托管数据与独立版账号使用不同身份，此备份用于独立版实例间搬迁。

### 大陆部署验收

腾讯云 CloudBase 默认网址仅供开发测试，正式托管请按平台文档配置自有域名与备案。参考 https://docs.cloudbase.net/service/alias 和 https://cloud.tencent.com/document/product/243/19630 。独立版当前启动脚本使用本地 Worker 模拟器，供隔离试运行。正式公网环境需配置生产服务进程、可信 HTTPS、独立持久卷和经过恢复验证的备份。在关闭代理的校园网与移动网络分别登录，写入笔记、读取同一笔记、调用 DeepSeek 并重启复查持久化后，再切换正式入口。
