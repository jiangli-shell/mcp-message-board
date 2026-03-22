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

const transports: { [sessionId: string]: SSEServerTransport } = {};

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runSSE(): Promise<void> {
  const app = express();
  
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json({ status: 'ok', messageCount: messages.length });
  });

  app.get('/sse', async (_req, res) => {
    const server = createServer();
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    res.on('close', () => {
      delete transports[transport.sessionId];
    });
    
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  });

  app.get('/api/messages', async (_req, res) => {
    const messages = await messageStore.getAllMessages();
    res.json(messages);
  });

  app.post('/api/messages', async (req, res) => {
    const { content, author } = req.body;
    const message = await messageStore.createMessage(content, author || 'Anonymous');
    res.json(message);
  });

  app.post('/api/messages/:id/replies', async (req, res) => {
    const { id } = req.params;
    const { content, author } = req.body;
    const reply = await messageStore.replyToMessage(id, content, author || 'Anonymous');
    res.json(reply);
  });

  app.use(express.static(path.join(__dirname, '../public')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Server running on port ${PORT}`);
  });
}

async function main(): Promise<void> {
  if (MODE === 'sse') {
    runSSE();
  } else {
    await runStdio();
  }
}

main();
