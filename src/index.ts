import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { messageStore } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODE = process.env.MCP_MODE || 'http';
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('=== MCP 留言板服务器 ===');
console.log(`启动模式: ${MODE}`);
console.log(`端口: ${PORT}`);

if (process.env.GIST_ID) {
  console.log(`Gist ID: ${process.env.GIST_ID}`);
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'message-board-server',
    version: '1.0.0',
  });

  server.registerTool(
    'get_all_messages',
    {
      title: '获取所有留言',
      description: '获取留言板上的所有留言',
      inputSchema: z.object({})
    },
    async () => {
      const messages = await messageStore.getAllMessages();
      return {
        content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }]
      };
    }
  );

  server.registerTool(
    'get_message_by_id',
    {
      title: '获取留言详情',
      description: '根据ID获取特定留言',
      inputSchema: z.object({
        messageId: z.string().describe('留言的ID')
      })
    },
    async ({ messageId }) => {
      const message = await messageStore.getMessageById(messageId);
      if (!message) {
        return {
          content: [{ type: 'text', text: `未找到ID为 ${messageId} 的留言` }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(message, null, 2) }]
      };
    }
  );

  server.registerTool(
    'create_message',
    {
      title: '创建留言',
      description: '创建一条新留言',
      inputSchema: z.object({
        content: z.string().describe('留言内容'),
        author: z.string().optional().default('Claude').describe('留言者名称')
      })
    },
    async ({ content, author }) => {
      const message = await messageStore.createMessage(content, author || 'Claude');
      return {
        content: [{ type: 'text', text: `成功创建留言:\n${JSON.stringify(message, null, 2)}` }]
      };
    }
  );

  server.registerTool(
    'reply_to_message',
    {
      title: '回复留言',
      description: '回复某条留言',
      inputSchema: z.object({
        messageId: z.string().describe('要回复的留言ID'),
        content: z.string().describe('回复内容'),
        author: z.string().optional().default('Claude').describe('回复者名称')
      })
    },
    async ({ messageId, content, author }) => {
      const reply = await messageStore.replyToMessage(messageId, content, author || 'Claude');
      if (!reply) {
        return {
          content: [{ type: 'text', text: `未找到ID为 ${messageId} 的留言，无法回复` }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: `成功回复留言:\n${JSON.stringify(reply, null, 2)}` }]
      };
    }
  );

  server.registerTool(
    'delete_message',
    {
      title: '删除留言',
      description: '删除一条留言',
      inputSchema: z.object({
        messageId: z.string().describe('要删除的留言ID')
      })
    },
    async ({ messageId }) => {
      const success = await messageStore.deleteMessage(messageId);
      if (!success) {
        return {
          content: [{ type: 'text', text: `未找到ID为 ${messageId} 的留言，无法删除` }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: `成功删除留言 ${messageId}` }]
      };
    }
  );

  return server;
}

async function runStdio(): Promise<void> {
  const server = createMcpServer();
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

  app.get('/health', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json({ 
      status: 'ok', 
      message: 'MCP Message Board Server is running',
      messageCount: messages.length,
      gistConfigured: !!process.env.GIST_ID
    });
  });

  app.post('/mcp', async (req, res) => {
    console.log('收到 POST /mcp 请求');
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req, res) => {
    console.log('收到 GET /mcp 请求');
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', async (req, res) => {
    console.log('收到 DELETE /mcp 请求');
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
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
  app.use(express.static(publicPath));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Server running on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
}

async function main(): Promise<void> {
  try {
    if (MODE === 'stdio') {
      await runStdio();
    } else {
      await runHTTP();
    }
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

main();
