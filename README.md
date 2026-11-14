# MCP Message Board Server

一个基于 MCP 协议的留言板服务器，使用 GitHub Gist 作为云端存储。

## 环境变量

- `GIST_ID` - GitHub Gist ID
- `GITHUB_TOKEN` - GitHub Personal Access Token (需要 gist 权限)
- `MCP_MODE` - 运行模式，设置为 `sse`
- `PORT` - 端口号 (可选，默认 3000)

## 本地运行

```bash
npm install
npm run build
npm start
```

## 部署到 Railway

1. Fork 这个仓库
2. 在 Railway 创建新项目
3. 连接你的 GitHub 仓库
4. 设置环境变量
5. 部署完成后，MCP URL 为: `https://你的域名/sse`

## 通义听悟每日签到（附加任务）

仓库里额外有一个 GitHub Actions workflow，每天北京时间 07:37 自动给通义听悟签到领时长。
脚本在 `scripts/tingwu-checkin.mjs`，workflow 在 `.github/workflows/tingwu-checkin.yml`，
与 MCP server 主体独立，不影响 Railway 部署。

### 一次性配置

1. Chrome 打开 <https://tingwu.aliyun.com> 并登录。
2. F12 → Application → Cookies → `https://tingwu.aliyun.com`，复制整条 cookie 字符串
   （形如 `login_aliyunid_ticket=xxx; _tb_token_=yyy; cookie2=zzz; ...`）。
3. 到仓库 `Settings → Secrets and variables → Actions → New repository secret`：
   - Name: `TINGWU_COOKIE`
   - Value: 上一步的 cookie 字符串
4. `Actions → Tingwu Daily Checkin → Run workflow` 手动跑一次验证，下载
   `screenshots-xxx.zip` 里的 `03-done.png` 确认签到状态。

Cookie 一般 1–2 周过期；失败时 GitHub 会自动发邮件通知仓库 owner，
重新导出 cookie 更新同名 Secret 即可。
