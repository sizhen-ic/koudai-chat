# 安全说明

这个仓库是**公开**的，而它同时承担两件事：源码托管 + APK 分发。下面把实际存在的风险和已经做的加固讲清楚。

---

## 一、已暴露的东西：签名密钥

`android/app/koudai.jks` 连同口令 `koudai123456` **提交在公开仓库里**（口令同时写在 `build.gradle` 和 workflow 中）。

**这意味着什么**

- 任何人拿到这个密钥，都能签出一个「签名和你的一模一样」的 APK；
- Android 只认签名，不认来源 —— 只要签名相同，就能**直接覆盖安装**，不需要卸载；
- 也就是说，有人可以伪造一个"升级包"，让你在已装好的 App 上覆盖安装一个带后门的版本。

**影响边界（重要）**

- 这**不会**泄露你的 API Key：Key 只存在手机本地（`/data/user/0/ai.koudai.chat/files/data/state.json`），仓库和历史里都没有；
- 攻击者无法远程推送到你手机 —— 必须**你主动下载并点击安装**才会生效；
- 威胁场景是"有人把这个仓库/Release 页面做成钓鱼链接让你装"。

**当前缓解措施**

- Release 说明里现在会附上 APK 的 **SHA-256**，下载后可核对：
  ```
  sha256sum app-debug.apk
  ```
- 只从你自己的仓库 Releases 页下载，不要信任转发的链接。

---

## 二、彻底解决：轮换密钥（需要你手动做一次）

密钥一旦公开过，就**无法收回**（git 历史里永久存在）。唯一彻底的办法是换一把新的。

代价：新密钥签名的 APK **不能覆盖**旧版安装，必须先卸载重装 —— 而卸载会清空 App 数据。

操作步骤：

1. **先导出数据**：App 里把重要对话逐个「导出这个对话」，或到设置里「备份到文件」；
2. 在本地生成新密钥：
   ```bash
   keytool -genkeypair -v -keystore koudai.jks -storetype PKCS12 -alias koudai \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass "换成你的新口令" -keypass "同上" \
     -dname "CN=Koudai App, OU=SelfUse, O=Personal, L=City, ST=State, C=CN"
   ```
3. 把新密钥转成 base64 存进 GitHub Secrets：
   ```bash
   base64 -w0 koudai.jks
   ```
   仓库 → Settings → Secrets and variables → Actions → New repository secret：
   | 名称 | 值 |
   |---|---|
   | `KEYSTORE_BASE64` | 上一步输出的 base64 |
   | `KEYSTORE_PASSWORD` | 新口令 |
4. 从仓库里删掉旧密钥：
   ```bash
   git rm --cached android/app/koudai.jks
   echo "android/app/koudai.jks" >> .gitignore
   ```
5. 卸载手机上的旧版 → 装新构建 → 导入备份。

> 做完第 3 步之后，workflow 会自动优先使用 Secrets 里的密钥；仓库内那份旧密钥可以安全删除。

---

## 三、已经做的加固（本次）

| 项目 | 之前 | 现在 |
|---|---|---|
| 触发条件 | 任意分支 push 都构建并发版 | **仅 `main`** + 手动触发 |
| Token 权限 | job 级 `contents: write` | 默认 `contents: read`，只有发版 job 提权 |
| 第三方 action | `@v4`（标签可被上游改写） | **锁定 commit SHA** |
| checkout 凭据 | 默认留在本地 | `persist-credentials: false` |
| 发布产物 | 只有 APK | APK + **SHA-256**、大小 |
| 签名口令 | 写死在 gradle | 优先读 Secrets，缺省才回退 |
| 版本号 | 永远是 1.0 | 跟随构建号（`1.0.<run>`） |

---

## 四、没有暴露的部分

- **你的 API Key**：只存在于手机本地存储，不进仓库、不进备份文件（导出 JSON 时会主动清空 `apiKey` 字段）；
- **对话内容**：同上，纯本地；
- **仓库里没有任何 secret 文件**（已用 `git grep` 全量核查）。

---

## 五、如果你想要更强的隔离

- 把仓库改为 **private**：能挡住"顺手克隆"的人，但挡不住已经看过历史的人（密钥已经泄露，改私有不能收回）；
- 给 GitHub 账号开 **2FA**：真正的高价值目标其实是账号 —— 拿到账号就能直接改源码发版，比偷密钥更省事；
- 定期检查 Releases 页有没有你不认识的 tag。
