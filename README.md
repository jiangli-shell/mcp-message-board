# MCP Message Board

一个基于 MCP (Model Context Protocol) 协议的留言板，使用 GitHub Gist 作为云端存储。

## 功能

- 📝 查看留言
- ✍️ 创建留言  
- 💬 回复留言
- 🗑️ 删除留言
- ☁️ GitHub Gist 云端存储

## 部署到 Railway

### 步骤 1: 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名填: `mcp-message-board`
3. 选择 Public
4. 点击 "Create repository"

### 步骤 2: 上传代码

把 `server` 文件夹里的所有文件上传到仓库

### 步骤 3: 部署到 Railway

1. 访问 https://railway.app/
2. 点击 "Start a New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权 GitHub，选择 `mcp-message-board` 仓库
5. 点击 "Deploy Now"

### 步骤 4: 设置环境变量

在 Railway 项目页面:
1. 点击 "Variables" 标签
2. 添加以下变量:
   - `GIST_ID` = `564be2a7c42e6426bd1e189b0dd943da`
   - `GITHUB_TOKEN` = `你的GitHub Token`
   - `MCP_MODE` = `sse`

### 步骤 5: 获取 URL

部署完成后，Railway 会给你一个域名，如:
- `https://mcp-message-board-production-xxx.up.railway.app`

MCP URL 就是: `https://你的域名/sse`

### 步骤 6: 在 claude.ai 配置

1. 访问 claude.ai
2. 进入 Settings → Integrations
3. 添加 MCP Server:
   - Name: `message-board`
   - URL: `https://你的域名/sse`
