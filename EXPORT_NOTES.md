# 导出说明

源码对应线上版本 7 的提交 d946ba96cec92ab12299d6900740b15124c98b1e。包含前后端代码、依赖配置、迁移、公开题库和训练资料。

为避免包含用户原始数据，本包不含用户上传的五个原始样卷文件：public/sources/chinese-first-page.png、chinese-original.pdf、chinese-restored.pdf、english-original.pdf、math-original.pdf。因此“原始样卷”中的这些下载链接在重新配置或补充文件前不可用。站点数据库、私人错题和作文及用户上传附件不包含在内。

网站依赖 Sites 身份信息、Cloudflare D1 和 R2 等服务；源代码不包含真实密钥、线上数据和服务账户。更换部署环境需配置相应服务、绑定及身份验证，不能仅靠 GitHub 静态托管直接运行后端。部署项目 ID 已替换为占位符。

依赖按 package.json / pnpm-lock.yaml 安装；按 README 执行准备 OCR 资源和构建。OCR 资源由脚本根据锁定依赖生成，不随包提供。请先核对资料的公开分享权限，再选择公开仓库。
