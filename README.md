# 蓝色大肥鱼

一个**只在自己手机上**跑的 AI 对话 App：界面像官方 DeepSeek，但用的是**你自己的 API Key**，没有每日限量，数据全部存在本地。

装好之后桌面一个图标，点开就是对话界面。

---

## 三种形态，同一份代码

| 形态 | 怎么用 | 数据存哪 |
|---|---|---|
| **APK（推荐）** | 装到手机，桌面点图标 | App 私有目录 `files/data/state.json` |
| 本地服务 | Termux 里 `node server.mjs` | 手机上的 `data/state.json` |
| 静态网页 | 托管或直接开文件 | 浏览器存储（可能被系统清掉） |

页面启动时自动探测用哪种，不用手动选。

---

## 功能清单

### 对话

- 流式输出，逐字显示（约 20 字/秒，可读不跳）
- **深度思考**：可开关，思考过程折叠展示，结束后自动收起并显示"已思考（用时 N 秒）"
- **联网搜索**：走模型自带的 `deepseek_web_search` 工具
- 模型切换：`deepseek-flash`（1M 上下文、支持图片）/ `deepseek-v4-pro`
- 停止生成、重新生成、复制、删除单条消息
- 消息操作、长按选择、代码块一键复制
- **数学公式**：内置 KaTeX，行内 `$...$` 与块级 `$$...$$` 都渲染
- Markdown：标题、列表、嵌套列表、表格、引用、代码块、链接
- 打字机效果 + 自动滚动跟随（手指一碰就让出控制权，不跟手势抢）
- 余额显示：调用 `/user/balance`，显示剩余金额

### 长上下文与记忆

- 对话累计到阈值（默认 **20 万字**，可改），自动触发记忆压缩
- 压缩时按**权重**挑选重点：
  - 位置越靠后权重越高
  - 用户说的话比 AI 说的权重高
  - 时间越近权重越高（7 天半衰）
  - 含数字、"决定/以后/不要/记住"等信号词加权
- 高权重片段会单独交给摘要器，要求优先保留：身份处境、偏好忌讳、已定决策、未完成事项、关键事实
- **不覆盖原文**：压缩后自动生成新会话「原名字 副本」，原对话一条不删
- 副本带着记忆摘要 + 最近一段原文，接话是连续的

### 文件

- 图片：拍照 / 相册，走 Files API 上传，对话里用 `file_id` 引用
- 任意文件：选文件 → 上传 → 提问（PDF、txt、docx 等）
- 附件在气泡里显示文件名与大小，可点开查看

### 界面

- 深色 + 淡蓝玻璃质感（`backdrop-filter` 毛玻璃）
- 动态背景：整张壁纸缓慢推近循环，底部空档藏在输入区玻璃下
- 弹性滚动：只位移消息层，顶栏和输入区纹丝不动
- **手势**：对话页右滑 → 会话列表；列表内左滑 → 返回
- **返回键**：先关弹层 → 再关列表 → 才退出 App
- 会话列表：搜索、重命名、删除、按今天/昨天/最近 7 天/更早分组
- 全部图标为线性 SVG，随主题变色

### 数据

- 全部本地：会话、设置、附件元数据
- 三种存储后端自动降级：原生桥 → HTTP 服务 → IndexedDB → localStorage
- 原子写入 + 滑动备份（保留最近若干份 `state.json`）
- 设置项：API 地址、Key、模型、系统提示、温度、压缩阈值等

### 导出

- **单个对话导出为 Markdown**：`用户 / AI / 深度思考` 三种内容分块标记，深度思考用引用块包起来
- 文件名形如 `对话标题-2026-11-18-22-40.md`，存到手机「下载」目录
- 全量备份为 JSON（自动剔除 API Key）

---

## 安全

见 [SECURITY.md](SECURITY.md)。要点：

- 数据不上传任何第三方，API Key 只存在本机；
- 仓库里**曾**包含签名密钥（已公开），Release 现在附带 APK 的 SHA-256 供校验；
- 彻底解决需要轮换签名密钥，步骤写在 SECURITY.md 里。

---

## 目录结构

```
index.html                整个 App（HTML + CSS + JS 单文件）
server.mjs                零依赖本地服务器（静态 + /api/state + 备份）
sw.js                     Service Worker
katex/                    KaTeX 本地副本（公式渲染）
android/                  WebView 外壳（Java）
  app/src/main/java/ai/koudai/chat/
    MainActivity.java     窗口、返回键、文件选择
    StoreBridge.java      状态读写 + 导出落盘
.github/workflows/        CI：编译 APK 并发 Release
dev/                      测试与工具脚本
```

---

## 本地开发

```bash
# 网页直接打开
start index.html

# 或用本地服务（数据写在磁盘）
node server.mjs            # 默认 8788 端口

# 跑测试（会自动定位仓库根目录）
node dev/test.js           # 逻辑 39 项
node dev/test-math.js      # 公式 10 项
node dev/test-attach.js    # 附件 21 项
node dev/test-http.js      # 接口 6 项
node dev/test-native.js    # 原生桥 9 项

# 重新生成图标（把方形原图放成 icon-src.png）
python dev/make-icons.py
python dev/make-android-icons.py
```

---

## 构建 APK

推到 `main` 分支即触发 GitHub Actions，自动编译并发 Release：

```
v1.0.<构建号>  →  蓝色大肥鱼 v1.0.<构建号>
```

**签名密钥不进仓库**，CI 从 Secrets 还原，需要先配置：

| Secret | 内容 |
|---|---|
| `KEYSTORE_BASE64` | 密钥库（PKCS12）的 base64，单行 |
| `KEYSTORE_PASSWORD` | 密钥库口令 |

没配置会直接构建失败 —— 避免产出一个装不上去的 APK。详见 [SECURITY.md](SECURITY.md)。

本地构建：把 `koudai.p12` 放到 `android/app/`，并设置环境变量 `KOUDAL_STORE_PASS`。

## 许可

代码为 MIT（见 [LICENSE](LICENSE)）；图像素材仅供个人使用，商用请自行替换。
