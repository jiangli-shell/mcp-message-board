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
