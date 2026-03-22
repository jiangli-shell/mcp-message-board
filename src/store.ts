import { Message, Reply } from './types.js';
import { v4 as uuidv4 } from 'uuid';

const GIST_ID = process.env.GIST_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GIST_FILENAME = 'message-board.json';

let cachedMessages: Message[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5000;

async function fetchFromGist(): Promise<Message[]> {
  if (!GIST_ID || !GITHUB_TOKEN) {
    console.error('缺少 GIST_ID 或 GITHUB_TOKEN 环境变量，使用本地内存存储');
    return cachedMessages;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Message-Board'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API 错误: ${response.status}`);
    }

    const gist = await response.json();
    const content = gist.files[GIST_FILENAME]?.content;
    
    if (content) {
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.error('从 Gist 加载数据失败:', error);
    return cachedMessages;
  }
}

async function saveToGist(messages: Message[]): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN) {
    console.error('缺少 GIST_ID 或 GITHUB_TOKEN 环境变量，数据仅保存在内存中');
    return false;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Message-Board'
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(messages, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API 错误: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error('保存到 Gist 失败:', error);
    return false;
  }
}

class MessageStoreImpl {
  private messages: Message[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.messages = await fetchFromGist();
    cachedMessages = this.messages;
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    
    const now = Date.now();
    if (now - lastFetchTime > CACHE_TTL) {
      this.messages = await fetchFromGist();
      cachedMessages = this.messages;
      lastFetchTime = now;
    }
  }

  async getAllMessages(): Promise<Message[]> {
    await this.ensureInitialized();
    return this.messages.map(msg => ({
      ...msg,
      replies: [...msg.replies]
    }));
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    await this.ensureInitialized();
    return this.messages.find(msg => msg.id === id);
  }

  async createMessage(content: string, author: string): Promise<Message> {
    await this.ensureInitialized();
    
    const message: Message = {
      id: uuidv4(),
      content,
      author,
      timestamp: new Date().toISOString(),
      replies: []
    };
    
    this.messages.unshift(message);
    cachedMessages = this.messages;
    await saveToGist(this.messages);
    
    return message;
  }

  async replyToMessage(messageId: string, content: string, author: string): Promise<Reply | null> {
    await this.ensureInitialized();
    
    const message = this.messages.find(msg => msg.id === messageId);
    if (!message) {
      return null;
    }

    const reply: Reply = {
      id: uuidv4(),
      content,
      author,
      timestamp: new Date().toISOString()
    };

    message.replies.push(reply);
    cachedMessages = this.messages;
    await saveToGist(this.messages);
    
    return reply;
  }

  async deleteMessage(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const index = this.messages.findIndex(msg => msg.id === id);
    if (index === -1) {
      return false;
    }
    
    this.messages.splice(index, 1);
    cachedMessages = this.messages;
    await saveToGist(this.messages);
    
    return true;
  }
}

export const messageStore = new MessageStoreImpl();
