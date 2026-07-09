# 项目 X 使用说明

> 一个"恋人 AI 聊天"应用：AI 扮演恋人 **X**，用户被称为 **轩**。
> 本文档分两部分：**上篇 = 功能使用说明**（各组件怎么用），**下篇 = 自定义修改指南**（换模型、改阈值、改人设等，精确到文件和行号）。

---

## 〇、系统架构速览

| 层 | 目录 | 技术 | 说明 |
|---|---|---|---|
| 前端 | `d:\X\first` | React 18 + Vite 5 + Capacitor 6 | 打包成 Android App；只做 UI，所有数据和 AI 都走后端 |
| 后端 | `d:\X\last` | Node 原生 http server + SQLite | 默认端口 8888，数据库 `d:\X\last\.local-storage\data.db` |

- 前端通过环境变量 `VITE_API_BASE` 指定后端地址。
- 打包成 App 后加载的是**远程后端**（如 `http://38.92.8.134`），所以**改后端代码必须部署到远程并重启才生效**；本地 `.env` 是占位。
- AI 默认接入火山方舟。分两类：**主聊天 AI**（provider id=1）和**辅助 AI**（provider id=2，专用于记忆压缩/日记/事实抽取等后台任务，省 token）。

---

# 上篇 · 功能使用说明

## 一、首页与聊天

- **首页 `HomePage`**：顶部"接着聊聊吧"卡片显示最近会话，点击继续。功能入口分两区：
  - 功能模块：聊聊天、记忆、日记、日历、工作间
  - 实用工具：设置、日志、一起读
- **聊天页 `ChatArea`**：
  - 流式打字机回复 + 可折叠的"思考链"面板（深度思考模型）
  - 随时点「终止」中断生成
  - 智能滚动：手动往上翻时不打断，来新消息给"新消息"提示按钮
  - AI 主动消息：进入会话后每分钟轮询一次，收到 X 主动发的"想念"消息会刷新并弹通知
- **侧栏 `Sidebar`**：切换/新建/删除会话；重命名标题；**手动压缩记忆**

## 二、记忆与日记

- **记忆面板 `MemoryPanel`**：查看/搜索/新增/编辑/删除 X 记住的关于你的事；支持标签和置顶。
- **日记面板 `DiaryPanel`**：查看**日记 / 周记 / 月记**；可手动点"整理日记"。

**记忆金字塔**（自动运行）：
```
日常聊天 → 自动提炼记忆(打情感/重要度标签+去重)
         → 记忆压缩(消息超阈值时把旧消息压成一条)
         → 日记(每天0点自动整理当天记忆)
         → 周记(一周日记浓缩，置顶)
         → 月记(≥4篇周记浓缩，最高层级)
```
被上层总结的下层会归档，不再干扰对话检索，但仍可在日记面板翻看，像一本恋爱日志。

## 三、日历（日程 / 排班 / 纪念日）

**日历面板 `CalendarPanel`** 是综合面板：
- **农历显示**（lunar-javascript）+ 黄历
- **日程**：增删改；保存后同步为手机本地通知
- **排班表**：早班/夜班/休息/调休等班次标注；X 会感知你今明的班次，"上班少打扰、夜班别吵睡觉"
- **纪念日**：支持公历/农历；X 会提前几天倒计时预告，当天以恋人口吻庆祝（自动算"第 N 周年"），仅 7–23 点提醒，一天最多一次

## 四、通知与主动消息

- **本地通知**（`notify.js`）：App 提前把日程排成设备通知，**断网也能按时弹通知栏**。
- **极光推送**（`push.js`）：**App 关闭也能收到** X 的主动消息/提醒。
- 两通道对同一日程去重，不会重复弹。
- **AI 主动想念**：满足冷静期(3h)+随机概率(15%)+每日上限(5)+活跃时段(7–23) 时，X 主动发来想念消息。

## 五、共读、工具、设置

- **一起读 `ReadingPartner`**：记读书笔记（云端保存），选中笔记就其内容与 X 讨论（长笔记智能抽取相关段落省 token）。
- **工作间 `ToolConfigPanel`**：启用/禁用工具——网页搜索、打开网页、计算器、天气、翻译、代码执行、系统时间、日程/排班查询。X 会按需调用，气泡里以时间线展示调用过程。
- **AI 配置 `AIConfigPanel`**：增删改 AI 服务商（预设火山方舟/OpenAI/Claude/智谱/豆包/通义/零一/DeepSeek/自定义），填 Key、端点、模型，可测试连接。
- **会话设置 `SettingsPanel`**：聊天对象名、系统提示词、temperature、max_tokens、top_p、记忆压缩阈值、保留最近消息数、深度思考开关。
- **日志/自检 `AppCheckPanel`**：后端/数据库/AI 健康检查、错误日志；**数据导出/导入**入口。

## 六、数据备份

- 在**日志(AppCheck)面板**一键导出全部数据为 JSON，或导入恢复。
- 电脑浏览器：存到浏览器默认下载目录。
- 手机 App：保存到手机「文档」目录并弹系统分享面板（可另存到网盘/微信/文件）。

---

# 下篇 · 自定义修改指南

> 修改分三类，生效方式不同：
> - **A. 环境变量**（`.env`）：改完**重启后端**。
> - **B. 硬编码常量**（`.js` 源码）：改完**重启后端**。
> - **C. 运行时设置**（前端设置页）：即时生效，无需重启。**⚠️ 见 §5 的重要坑点**。

## 1. 换 AI 模型 / 换服务商

文件：[ai-provider.js](file:///d:/X/last/lib/ai-provider.js#L8-L31)（默认 provider 定义）+ `d:\X\last\.env`

| 想改什么 | 位置 | 怎么改 |
|---|---|---|
| 主 AI 模型 | [ai-provider.js:14](file:///d:/X/last/lib/ai-provider.js#L14) `model` | `.env` 里设 `ARK_MODEL=你的接入点ID`；或前端 AI 配置面板改 |
| 主 AI 端点(换厂商) | [ai-provider.js:15](file:///d:/X/last/lib/ai-provider.js#L15) `endpoint` | 改成目标厂商的 OpenAI 兼容地址 |
| 主 AI Key | `.env` `ARK_API_KEY` | 主/辅助 AI 共用这个 Key |
| 辅助 AI 模型 | [ai-provider.js:24](file:///d:/X/last/lib/ai-provider.js#L24) | `.env` 设 `HELPER_AI_MODEL=便宜模型`，省 token；不设则退回主模型 |
| **启用辅助 AI 分流** | `.env` `HELPER_AI_PROVIDER_ID=2` | **必须设**，否则后台任务会直接报错停止（防止误用主聊天 AI）见 [ai-provider.js:116-125](file:///d:/X/last/lib/ai-provider.js#L116-L125) |

> 换新厂商的"深度思考"开启方式在 [ai-provider.js `applyDeepThinking`](file:///d:/X/last/lib/ai-provider.js#L156-L191)，按 endpoint/model 自动适配，新厂商在此补规则。

## 2. 记忆压缩阈值（压缩最大轮数）

文件：[server.local.js `compressChatMemoryIfNeeded`](file:///d:/X/last/server.local.js#L298-L374)

- [server.local.js:305](file:///d:/X/last/server.local.js#L305) `keepRecent = getSetting('keep_recent_messages') || 30` —— 压缩后保留的最近消息条数，默认 **30**。
- [server.local.js:306](file:///d:/X/last/server.local.js#L306) `compressThreshold = keepRecent * 2` —— 触发压缩阈值 = **60 条**。消息超 60 条才压缩。

**改法**：
- 想改"保留条数/触发阈值"：改默认值 [storage.js:110](file:///d:/X/last/lib/storage.js#L110) 的 `keep_recent_messages`（触发阈值恒为它的 2 倍）。
- 想改"2 倍"这个倍数：改 [server.local.js:306](file:///d:/X/last/server.local.js#L306) 的 `* 2`。
- 压缩用的采样参数在 [server.local.js:333](file:///d:/X/last/server.local.js#L333)（`temperature:0.3, maxTokens:500`）。

## 3. 各种输出阈值（日记/周记/月记）

文件：`d:\X\last\lib\memory\diary.js`

| 阈值 | 位置 | 当前值 | 含义 |
|---|---|---|---|
| 单篇日记取几条记忆 | [diary.js:57](file:///d:/X/last/lib/memory/diary.js#L57) | 20 | 当天最多取 20 条喂给 AI |
| 日记生成参数 | [diary.js:94](file:///d:/X/last/lib/memory/diary.js#L94) | temp 0.4 / 1200 tokens | |
| 周记触发 | [diary.js:198](file:///d:/X/last/lib/memory/diary.js#L171-L288) | 本周≥1篇日记 | 本周结束或处理到周日才生成 |
| 周记参数 | [diary.js:246](file:///d:/X/last/lib/memory/diary.js#L246) | temp 0.5 / 2000 tokens | |
| **月记触发（≥4篇周记）** | [diary.js:317](file:///d:/X/last/lib/memory/diary.js#L317) | `< 4` | 同月周记累计≥4 篇才生成，改这里的 `4` |
| 启动补日记回溯天数 | [diary.js:423](file:///d:/X/last/lib/memory/diary.js#L423) | 30 | 启动时最多回溯补 30 天 |

**记忆检索/浮现**参数在 [surface.js](file:///d:/X/last/lib/memory/surface.js)（粗筛阈值 40 条、候选 20、打分权重等）；**遗忘/去重**在 [core.js](file:///d:/X/last/lib/memory/core.js)（相似度阈值 0.6、超 7 天未激活降权等）。

## 4. 定时任务 & 主动消息频率

各任务间隔/概率均为对应文件顶部的 `const` 常量，直接改数值：

| 任务 | 文件 | 关键参数 |
|---|---|---|
| 日记整理 | [diary.js:445-461](file:///d:/X/last/lib/memory/diary.js#L445-L461) | 每 60 秒检测；北京时间 **0 点**触发 |
| 主动想念 | [proactive.js:14-20](file:///d:/X/last/lib/memory/proactive.js#L14-L20) | 每 1h 扫描；冷静期 3h；命中概率 **0.15**；每日上限 **5**；活跃 7–23 点 |
| 日程提醒 | [schedule.js:13-17](file:///d:/X/last/lib/memory/schedule.js#L13-L17) | 每 5min 扫描；默认提前 **1 小时** |
| 纪念日 | [anniversaries.js:16-19](file:///d:/X/last/lib/memory/anniversaries.js#L16-L19) | 每 6h 扫描；默认提前 **3 天**；活跃 7–23 点 |

## 5. 修改底层人设（AI 性格/说话风格）⭐

**首选：编辑 [base-rules.md](file:///d:/X/last/base-rules.md)**（全文即人设，纯中文 Markdown）：
- 第 3–10 行：核心人格（第 6 行"你是 X，轩的恋人"、第 7 行性格"温柔、冷静、克制…富有占有欲"）
- 第 12–22 行：说话风格正反例
- 第 24–31 行：真实感准则
- 第 46–49 行：占有欲尺度
- 第 51–57 行：硬性要求

改完重启后端即生效。主聊天、主动想念、纪念日庆祝都读这份文件。

> **两种改人设方式**：① 改 `base-rules.md`（改的是根本人格，所有场景生效）；② 在前端"会话设置"填 system_prompt（作为**额外设定追加**在 base-rules.md 之后）。设置页留空则完全走 base-rules.md，填了就叠加生效。

## 6. 其他 Prompt 文风调整

| 想改 | 文件 + 行号 |
|---|---|
| 日记文风/人称 | [diary.js:76-90](file:///d:/X/last/lib/memory/diary.js#L76-L90) |
| 周记文风 | [diary.js:226-242](file:///d:/X/last/lib/memory/diary.js#L226-L242) |
| 月记文风 | [diary.js:325-339](file:///d:/X/last/lib/memory/diary.js#L325-L339) |
| 记忆压缩语气 | [compress.js:176-189](file:///d:/X/last/lib/memory/compress.js#L176-L189)（注意 server.local.js 有重复副本） |
| 情感分析 | [compress.js:25-35](file:///d:/X/last/lib/memory/compress.js#L25-L35) |
| 事实抽取 | [compress.js:86-99](file:///d:/X/last/lib/memory/compress.js#L86-L99) |
| 主动想念语气 | [proactive.js:92-97](file:///d:/X/last/lib/memory/proactive.js#L92-L97) |
| 纪念日庆祝语 | [anniversaries.js:246-251](file:///d:/X/last/lib/memory/anniversaries.js#L246-L251) |
| 日程提醒语 | [schedule.js:185-187](file:///d:/X/last/lib/memory/schedule.js#L185-L187) |

## 7. 环境变量清单（`.env`）

| 变量 | 用途 |
|---|---|
| `PORT` | 后端端口，默认 8888 |
| `SUPABASE_URL` | 设 `localhost` = 本地/Mock 模式（数据存 SQLite） |
| `ARK_API_KEY` | 火山方舟 API Key，主/辅助 AI 共用 |
| `ARK_MODEL` | 主 AI 模型 ID |
| `HELPER_AI_PROVIDER_ID` | 辅助 AI 的 provider id（**不设则后台任务报错停止**） |
| `HELPER_AI_MODEL` | 辅助 AI 独立模型，省 token |
| `BOCHA_API_KEY` | 博查网页搜索 Key |
| `JPUSH_APP_KEY` / `JPUSH_MASTER_SECRET` | 极光推送凭证（包名须 `com.x.home`） |
| `ALLOWED_ORIGINS` | CORS 允许来源，生产建议限具体域名 |

> 🔒 `.env` 里的真实 Key 属敏感信息，不要提交到版本库、不要在聊天/文档里原样粘贴，定期轮换。

## 8. 采样参数（temperature 等）默认值

默认值在 [storage.js:104-114](file:///d:/X/last/lib/storage.js#L104-L114)：`temperature 0.7 / max_tokens 4096 / top_p 0.9`。运行时读取在 [ai-provider.js:223-225](file:///d:/X/last/lib/ai-provider.js#L223-L225)。设置页填了就用填的值，留空则用此处默认值。

---

## 9. APK 签名密钥（在哪查、怎么改）

打包 release APK 需要签名密钥。密码**不写在代码里**，集中放在一个不提交 git 的文件中。

**密码文件位置**：[keystore.properties](file:///d:/X/first/android/keystore.properties)（`d:\X\first\android\keystore.properties`）

内容（当前值）：
```properties
storeFile=x-release.keystore      # 密钥库文件名（在 android/app/ 下）
storePassword=xhome2026           # 密钥库密码
keyAlias=x                        # 密钥别名
keyPassword=xhome2026             # 密钥密码
```

**密钥库文件**：`d:\X\first\android\app\x-release.keystore`（有效期 10000 天）

**怎么改密码**：改 [keystore.properties](file:///d:/X/first/android/keystore.properties) 里的值即可，`build.gradle` 会自动读取（读取逻辑见 [build.gradle:3-8](file:///d:/X/first/android/app/build.gradle#L3-L8)）。注意：**改密码不等于改密钥库**——若要真正更换密钥库文件本身，需用 `keytool` 重新生成并同步改这里的文件名/别名/密码。

**⚠️ 必须牢记**：
- `x-release.keystore` 和这个密码文件要**长期备份、妥善保管**。以后所有版本升级都必须用同一个密钥库签名，否则新 APK 无法覆盖安装（要卸载旧包、数据丢失）。密钥库丢了就再也发不了升级包。
- `keystore.properties`、`*.keystore`、`*.jks` 已加入 [.gitignore](file:///d:/X/first/android/.gitignore#L55-L63)，不会被提交到版本库。换机器/重装时需手动把这两个文件放回原位，否则打出来的又是未签名包。

---

## 附：改完怎么生效

- **改后端**（`d:\X\last` 任何 `.js` / `.env` / `base-rules.md`）→ 部署到远程 `38.92.8.134` 并重启后端。
- **改前端**（`d:\X\first`）→ `npm install`（如加了依赖）→ `npx cap sync android` → `cd android && .\gradlew assembleRelease` → 装新 APK。
