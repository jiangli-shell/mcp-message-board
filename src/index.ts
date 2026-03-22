import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
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

async function runHTTP(): Promise<void> {
  const app = express();
  
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'mcp-session-id'],
    credentials: false
  }));
  
  app.use(express.json());
  app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));
  app.use(express.text({ type: 'text/plain' }));

  app.get('/health', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json({ 
      status: 'ok', 
      message: 'MCP Message Board Server is running',
      messageCount: messages.length,
      gistConfigured: !!process.env.GIST_ID
    });
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createServer();
  server.connect(transport);

  const handleRequest = async (req: express.Request, res: express.Response) => {
    console.log(`收到 ${req.method} 请求: ${req.path}`);
    await transport.handleRequest(req as any, res as any, req.body);
  };

  app.get('/mcp', handleRequest);
  app.post('/mcp', handleRequest);
  app.delete('/mcp', handleRequest);

  app.get('/sse', async (req, res) => {
    console.log('SSE 连接请求 (兼容模式)');
    await transport.handleRequest(req as any, res as any);
  });

  app.post('/messages', async (req, res) => {
    console.log('收到 POST 消息 (兼容模式)');
    await transport.handleRequest(req as any, res as any, req.body);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`MCP 留言板服务器已启动 (HTTP 模式)`);
    console.log(`网页留言板: http://localhost:${PORT}`);
    console.log(`MCP 端点: http://localhost:${PORT}/mcp`);
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
    if (MODE === 'stdio') {
      await runStdio();
    } else {
      runHTTP();
    }
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

main();
