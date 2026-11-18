# 安全说明

## 现状（2026-11-18 已处理）

签名密钥**已轮换**，新密钥不在仓库里：

| 位置 | 内容 |
|---|---|
| GitHub Secrets | `KEYSTORE_BASE64`、`KEYSTORE_PASSWORD`（CI 构建时还原） |
| 本机 | `_keys/koudai-signing/`（仓库外，需自行另存一份） |

新证书指纹（SHA-256）：

```
8E:E8:FE:11:14:62:DA:04:16:26:27:76:26:D8:0D:3D:04:9B:F1:B1:E7:C9:3C:6C:BE:45:DE:E6:98:93:0C:82
```

> 旧密钥 `db92106c…` 已作废。它历史上曾经公开过，所以**不再可信**。

## 第一次升级必须卸载

Android 只允许「同签名覆盖安装」。新旧密钥不同，所以：

```
备份 → 卸载旧版 → 装新签名版 → 导入备份
```

**只此一次**。之后密钥固定不变，更新照常覆盖，数据不动。

## 历史与残留

- git 历史里仍能看到**旧密钥**和旧口令 —— 但旧密钥已作废，留着没有利用价值；
- 历史提交里也能看到早期的本地绝对路径（属于开发痕迹，不含账号密码）；
- 想彻底抹掉需要重写全部提交并 force push，会影响已有的 release 标签，一般没必要做。

## 构建时的密钥要求

CI 从 Secrets 还原密钥；**没有配置就会构建失败**（这是有意的，避免产出一个装不上去的 APK）。

配置方式：仓库 → Settings → Secrets and variables → Actions → New repository secret

| 名称 | 值 |
|---|---|
| `KEYSTORE_BASE64` | `koudai.p12` 的 base64（单行） |
| `KEYSTORE_PASSWORD` | 密钥库口令 |

本地构建则可以自己放一个 `android/app/koudai.p12`，并设置环境变量 `KOUDAL_STORE_PASS`。

## 已做的加固

| 项目 | 状态 |
|---|---|
| 触发条件 | 仅 `main` 分支 + 手动触发 |
| Token 权限 | 默认 `contents: read`，只有发版 job 提权 |
| 第三方 action | 全部锁定 commit SHA |
| checkout 凭据 | `persist-credentials: false` |
| 发布产物 | APK + **SHA-256** + 大小，可校验 |
| 版本号 | 跟随构建号（`1.0.<run>`） |
| 密钥 | 不进仓库，走 Secrets |

## 数据安全

- API Key、对话内容**只存在手机本地**，仓库和历史里从来没有过；
- 导出的 JSON 备份会主动剔除 `apiKey` 字段；
- 导出 Markdown 只写到手机「下载」目录。

## 建议

- 给 GitHub 账号开 **2FA** —— 账号比密钥更值钱，拿到账号可以直接改源码发版；
- 每次下载 APK 后核对 Release 里的 SHA-256；
- 定期看一眼 Releases 页有没有你不认识的版本。
