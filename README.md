# 口袋对话 v4

桌面上一个图标，点开就是对话界面，**数据全部在手机本地**。

三种形态，同一个 `index.html`，启动时自动选择数据存放位置：

| 形态 | 怎么用 | 数据在哪 |
|---|---|---|
| **APK（原生外壳）** ⭐ | 装到手机，桌面图标点开 | App 私有目录 `files/data/state.json` |
| **本地服务** | Termux 里 `node server.mjs`，浏览器打开 | 手机上的 `data/state.json` |
| 静态网页 | 托管或直接开文件 | 浏览器存储（会丢，仅试用） |

---

## 数据优先级（代码里的顺序）

```
启动
 ├─ 有 window.KoudaiNative ？ → 原生模式：读写 App 私有目录里的 state.json
 ├─ 有 /api/state ？        → 服务模式：读写手机上的真实文件
 └─ 都没有                  → 浏览器 IndexedDB / localStorage
```

设置页里会实时显示当前用的是哪种。**只要不是第三种，清浏览器缓存都不会丢数据。**

---

## 路线 A：装 APK

### 为什么不能直接给你安装包

这个工作环境里没有 Java、没有 Gradle、没有 Android SDK，**编译不了 APK**。所以我把整个工程写好，用 GitHub Actions 在云端编译。

### 步骤

1. 注册/登录 GitHub，新建一个**空仓库**（Private 也行）
2. 把 `phone-chat` 文件夹里的**所有内容**传上去（网页文件 + `android/` + `.github/`）
   - 网页上传：仓库页 → Add file → Upload files → 拖进去
   - 注意 `.github/workflows/build-apk.yml` 必须在仓库根目录的 `.github/workflows/` 下
3. 进仓库的 **Actions** 标签页，会看到 `build-apk` 正在跑（约 3–6 分钟）
4. 跑完点进去，底部 **Artifacts** 下载 `koudai-apk.zip`，解压得到 `app-debug.apk`
5. 传到手机上安装（需要允许未知来源）

### 这个 APK 做了什么

- 一个全屏 WebView，加载打包在里面的对话界面，**没有地址栏**
- 界面通过 `KoudaiNative` 桥把数据写进 **App 私有目录**，完全不碰浏览器存储
- 每次保存：临时文件 + rename（原子写），另有每 10 分钟一次的快照，保留最近 30 份
- 清理浏览器缓存、换浏览器、换 WiFi 都不影响；**卸载 App 才会删**

### ⚠️ 先说清楚风险

我**没能在这里编译验证**它一定能通过。第一次跑 CI 有可能报错（Gradle 版本、SDK 组件之类）。

如果失败了：把 Actions 里的报错日志贴给我，我按报错改。这类问题一般一两轮就能修好。

---

## 路线 B：本地服务 + 网盘备份（不用 GitHub）

```bash
pkg install -y nodejs
cd ~/phone-chat
PORT=8080 node server.mjs
```

浏览器打开 `http://127.0.0.1:8080/`，加到主屏幕。

想要更强的容灾，加一个外部副本目录：

```bash
termux-setup-storage
KOUDAI_SD=/sdcard/Documents/koudai PORT=8080 node server.mjs
```

服务会往那里写 `koudai-latest.json` 和按天的副本，**再把网盘 App 的备份指向这个文件夹**，数据就上云了。

开机自启：

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-chat <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd $HOME/phone-chat
KOUDAI_SD=/sdcard/Documents/koudai PORT=8080 node server.mjs >> $HOME/chat.log 2>&1
EOF
chmod +x ~/.termux/boot/start-chat
```

---

## 首次配置

打开应用 → 右上角 ⚙：

1. **API 地址**：`https://api.deepseek.com`
2. **API Key**：<https://platform.deepseek.com/> → API keys
3. **模型**：`deepseek-flash`
4. 点「测试连接」

价格（deepseek-flash，空闲时段）：输入 1 元/百万 token，输出 4 元/百万。日常几十轮通常一两块钱。

---

## 功能

- 多会话：分组、搜索、重命名、删除
- 消息：复制 / 编辑重发 / 重新生成 / 删除
- 模型切换、深度思考折叠展示
- 长上下文：滚动摘要，原文永久保留
- Markdown：标题、列表、表格、代码块复制、链接
- 三种存储模式自动切换
- 一键备份（服务模式下快照 + 下载；原生模式下自动快照）

## 还没做

- 发图片 / 传文件（Files API）
- 联网搜索 / 深度思考开关
- 语音输入

---

## 开发与测试

```bash
node --check server.mjs
node dev/test.js          # 33 项：浏览器模式逻辑
node dev/test-http.js     # 6 项：本地服务模式
node dev/test-native.js   # 9 项：APK 原生桥模式
node dev/check-ids.js     # DOM id 一致性
python dev/make-icons.py          # 网页图标
python dev/make-android-icons.py  # APK 启动图标
```

服务端接口（只监听 127.0.0.1）：

```
GET    /api/health
GET    /api/state
PUT    /api/state      原子写入 + 自动快照
GET    /api/backup     下载 JSON
POST   /api/backup     立即快照 + 复制到外部目录
```

## 目录

```
index.html              应用本体
server.mjs              本地服务（可选）
manifest.webmanifest    PWA 清单
sw.js                   离线外壳
icons                   web / android 两套
android/                Android 工程（WebView 外壳 + 数据桥）
.github/workflows/      云端编译 APK
dev/                    测试与工具脚本
```
