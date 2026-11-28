# 和知 AI 3.0 · 阶段 06 全局知识关联与可视化知识图谱
## 0. 前置验收与边界
阶段05基础版 PR #14、完整化 PR #15 均已合并。main c247fd4 的 CI 46087677974 完整成功：43套隔离回归、28项每日规则、10项整周规则、实际D1接口与迁移回填、1280/390px Chromium及关闭与目录清理均通过。阶段05约定的代码范围完成。生产部署、真实账号和0022生产迁移未独立核实；旧站同步未授权且不属于验收范围。当前阶段06是完整系统设计草稿，不代表图谱已实现或通过CI。生产接入继续本PR，不另建重复阶段。
## 1. 产品定位
私人知识图谱是独立研究工作台，将已有材料、作者、时代、主题、本人有效笔记、本人研究项目、真实错题知识点组织成可检索可追溯的知识网络。与既有社区议题关系模块分离；不自动发布、共享或混入他人私人数据。首页/研究项目/读书笔记提供导航入口；主入口位于研究项目旁，#knowledge-graph。初版纯确定性规则，无模型调用、无外部CDN。下一阶段文献管理可增加资料类型，不把现有书目标签冒充已核验的文献引用。
## 2. 节点、关系与证据
节点类型：resource（文学/研究资料）、author（资料署名字段，保留原文不自动拆合）、era（资料时代字段）、topic（明确主题或用户标签）、note（本人active笔记）、project（本人active项目）、weakness（实际错题报告的学科+知识点）、concept（本人手工创建的概念）。区分作者/时代/主题原始元数据与用户学术判断；资源可含现代研究论文及统计资料，不全部称文学作品。未核验的元数据不标注为学术事实。
关系类型：authored_by、classified_in、has_theme、note_on、tagged_with、project_note、observed_wrong_tag、related_to、supports、contrasts、cites、defines。前七类按真实结构字段或有记录的证据派生，只读；后五类为人工确认关系，分别明确方向与说明。supports/contrasts/cites是本人研究判断，非系统证明；cites要求用户填写定位或出处，不自动生成引用。相同标签仅生成“同标签/待比较”建议，不宣称思想影响、因果或支持。规则候选有来源、解释与规则版本，必须主动确认才成为持久边；拒绝/隐藏建议可恢复。不按相似度创造事实，不从标签、作答记录推断个人能力、录取率或其他敏感属性。
每个节点使用类型命名空间与稳定ID（源主键或SHA-256规范化元组，禁止仅按标题合并）；同名材料/作者不确定时保留原始来源并展示歧义。每条边保留来源类型、sourceId、关联版本/快照、创建时间、创建方式；不存私人正文、共享者身份、无关用户数据。原节点修改/删除/归档后重新校验有效性，失效边不显示旧标题或正文；可在本人管理区以不泄露原节点内容的占位显示并删除。节点身份不由客户端声明。
## 3. 接入清单（核对当前代码）
- app/literature/data.ts 的 works 由 researchCatalog 与 originalWorks 合并；app/literature/materials.ts 的 mergeMaterials 根据本人覆盖/删除决定有效资料。复用此逻辑，不额外恢复本人已隐藏的资料；只返回必要标题、署名、时代、主题和固定应用导航，链接不直接信任用户输入。
- entries：严格 WHERE user_id=? AND folder='active'；仅取id,title,work_id,tags,discipline,revision,updated_at。work_id关联有效资料；笔记标签使用有明确分隔符的规范化解析，限制个数/长度；不读正文或历史版本。原入口 /reading-notes#note/<encoded-id>。
- research_projects：第一版只汇入 owner_id=? AND status='active' 的本人项目，解析title与 links 中 ownerId===本人且当前有效的 noteId，禁止把协作者私人笔记、成员列表、邀请或共享讨论带进私人图谱。以后若加协作项目，必须重用现有 membershipScope、社区停用/屏蔽/撤回过滤，独立验收。项目入口 #projects。
- archive_records：重用 lib/learning-report 的真实错题聚合逻辑，但新图谱强制 owner_id=?，不使用旧 owned 的 legacyOwner NULL 兜底。记录上限及总字节限制沿用报告（2000/8MB），按学科+tag显示实际不同错题数；截断明确，空数据不推断薄弱点。来源链接 #mistakes / #report，绝不回传题干/答案/成绩明细。
- 现有 app/api/literature/network/route.ts 仅作用于受控社区出版物、参考书目及其版本关系，保留 requireCommunity、publicationVisible 等现有授权；本阶段不读社区内容、不修改该接口的权限，不复用其关系表作为私人图谱。
- 本人学习计划 /api/study-plans：可由图谱推荐“去复习”跳转今日学习/原模块；生成或点击图谱不算完成学习任务，不改变复习计划、成绩或数据；后续显式加入计划必须使用阶段05的预览确认机制。
## 4. 数据与接口
迁移0023（实现时再次检查最新编号）新增 knowledge_concepts（user_id,id,title,description,revision,created_at,updated_at）、knowledge_links（user_id,id,source_type,source_id,target_type,target_id,relation,note,source_revision,target_revision,revision,created_at,updated_at）、knowledge_suggestion_decisions（user_id,stable_suggestion_id,state,revision,updated_at）。复合主键/唯一关系键，限制每用户概念及边总量，所有写操作本人范围、参数绑定、版本CAS、幂等建议确认、禁止自环及重复边。派生边不重复写入，不修改已有资料或笔记；删除手工概念/边不删除原内容。源端变化或无权限不再显示；链接端点在每次读取/写入时重新验证，不能依据持久化边绕过原数据权限。不得把旧数据的未拥有行归给当前账号。
GET /api/knowledge-graph 支持 mode=overview/search/node/suggestions（限制查询字符串、节点类别、分页游标和每次邻接边数）；只返回已授权节点与两端均可见的边，分页和截断标记；概览用明确上限，搜索与节点详情可访问概览外的本人节点，不能静默遗漏。图谱全局统计明确是有界结果，不伪造完整数。POST action=concept-create/update/delete, link-create/update/delete, suggestion-confirm/dismiss/restore；sameOrigin、principal、readLimitedText、privateHeaders；客户端仅提供经校验的引用和编辑字段，服务端解引用验证，未知/未拥有/不可见一律404，不泄露存在性。JSON输出数据结构校验，严格限制字符串长度与请求体；管理员无私人数据越权；不加入第三方模型、外部分析/追踪。状态变化、重新登录及离开页面时取消请求，丢弃迟到响应。
## 5. 前端
public/index.html 在研究项目旁添加知识图谱入口；public/app.js names与路由接入，离开路由释放请求和选中状态；精确 /api/knowledge-graph 加入 lan/gateway.mjs 白名单。独立 public/knowledge-graph.js/.css 带缓存版本。深蓝/象牙白/学术金视觉；顶部搜索与节点类型筛选、关系类型筛选；桌面图谱与详情双栏，手机单栏可折叠。以选中节点为中心，限制邻接数量，逐层展开；SVG/DOM安全文本，不拼接任意HTML、脚本或URL，无外部CDN。可点击/键盘选择节点、缩放/重置（有限值）、查看相邻关系与来源、人工添加编辑删除、自定义概念、审阅建议。节点列表作为图谱的无障碍/低性能替代，同步选择。区分自动元数据关系、明确人工确认关系、待审核建议。无记录有清晰空状态和来源模块入口，权限撤回及删除后立即刷新。错误可重试，不能伪造保存成功；保存期间防重复提交，不丢未提交编辑。
## 6. 验收与发布
- 规则测试：稳定ID、同名不同源、标签标准化、边方向、重复/自环/未知类型、无证据不生成边、建议确认/拒绝/恢复、来源变更失效、可见端点过滤、查询边界及排序、确定性布局。
- 真实隔离D1/API：0022→新增迁移兼容，真实有效资料覆盖/删除、相同id跨账号、归档/回收站/撤销、私人项目成员隔离、仅真实错题、所有写入所有者校验、并发CAS、重复确认幂等、CSRF、管理员无越权、恶意文本无脚本、来源分页、空数据、错误响应；禁止使用真实用户数据。
- Chromium（1280与390px）：从导航进入，搜索、筛选、选中节点、查看来源、创建概念与关系、确认建议、刷新持久化、修改与删除、来源归档后消失、键盘访问、窄屏无横向溢出、切路由时无陈旧响应；沿用PR15正常关闭及独立进程组清理。不能只通过核心算法测试就宣称阶段完成。
- 更新全套verify-ci.mjs，运行构建、类型检查、全部现有回归及新测试。最新HEAD通过后用户明确审批，核验合并后main CI；生产部署/迁移与真实账号验收另列。自动任务不得自动合并或部署。
## 7. 完成定义
数据库、真实来源、权限过滤、可操作图谱UI、人工关系管理、建议审批、来源失效处理及实际测试同时交付。本PR当前仅为设计，不构建数据库或UI，不变更生产；完整实现和验收必须继续当前分支，不另建重复阶段。
