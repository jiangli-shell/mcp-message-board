import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from './mcp-server.js';
import { messageStore } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODE = process.env.MCP_MODE || 'sse';
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('=== MCP 留言板服务器 ===');
console.log(`启动模式: ${MODE}`);
console.log(`端口: ${PORT}`);

if (process.env.GIST_ID) {
  console.log(`Gist ID: ${process.env.GIST_ID}`);
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runSSE(): Promise<void> {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json({ 
      status: 'ok', 
      message: 'MCP Message Board Server is running',
      messageCount: messages.length,
      gistConfigured: !!process.env.GIST_ID
    });
  });

  app.get('/sse', async (_req, res) => {
    console.log('新的 SSE 连接');
    const server = createServer();
    const transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }
    res.json({ received: true });
  });

  app.get('/api/messages', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json(messages);
  });

  app.post('/api/messages', async (req, res) => {
    const { content, author } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const message = await messageStore.createMessage(content, author || 'Anonymous');
    res.json(message);
  });

  app.post('/api/messages/:id/replies', async (req, res) => {
    const { id } = req.params;
    const { content, author } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    
    const reply = await messageStore.replyToMessage(id, content, author || 'Anonymous');
    if (!reply) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    
    res.json(reply);
  });

  const publicPath = path.join(__dirname, '../public');
  console.log(`静态文件目录: ${publicPath}`);
  app.use(express.static(publicPath));

  app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`MCP 留言板服务器已启动 (SSE 模式)`);
    console.log(`网页留言板: http://localhost:${PORT}`);
    console.log(`SSE 端点: http://localhost:${PORT}/sse`);
    console.log(`API 端点: http://localhost:${PORT}/api/messages`);
    if (process.env.GIST_ID) {
      console.log(`数据存储: GitHub Gist`);
    } else {
      console.log(`数据存储: 本地内存 (未配置 Gist)`);
    }
    console.log(`=================================`);
  });
}

async function main(): Promise<void> {
  try {
    if (MODE === 'sse') {
      runSSE();
    } else {
      await runStdio();
    }
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

main();
