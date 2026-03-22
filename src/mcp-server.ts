import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { messageStore } from './store.js';

export function createServer(): Server {
  const server = new Server(
    {
      name: 'message-board-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_all_messages',
          description: '获取留言板上的所有留言，包括每条留言的内容、作者、时间和回复',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_message_by_id',
          description: '根据ID获取特定留言的详细信息',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: {
                type: 'string',
                description: '留言的ID',
              },
            },
            required: ['messageId'],
          },
        },
        {
          name: 'create_message',
          description: '在留言板上创建一条新留言',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: '留言内容',
              },
              author: {
                type: 'string',
                description: '留言者名称（默认为Claude）',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'reply_to_message',
          description: '回复某条留言',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: {
                type: 'string',
                description: '要回复的留言ID',
              },
              content: {
                type: 'string',
                description: '回复内容',
              },
              author: {
                type: 'string',
                description: '回复者名称（默认为Claude）',
              },
            },
            required: ['messageId', 'content'],
          },
        },
        {
          name: 'delete_message',
          description: '删除一条留言',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: {
                type: 'string',
                description: '要删除的留言ID',
              },
            },
            required: ['messageId'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_all_messages': {
        const messages = await messageStore.getAllMessages();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      }

      case 'get_message_by_id': {
        const { messageId } = args as { messageId: string };
        const message = await messageStore.getMessageById(messageId);
        if (!message) {
          return {
            content: [
              {
                type: 'text',
                text: `未找到ID为 ${messageId} 的留言`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(message, null, 2),
            },
          ],
        };
      }

      case 'create_message': {
        const { content, author = 'Claude' } = args as { content: string; author?: string };
        const message = await messageStore.createMessage(content, author);
        return {
          content: [
            {
              type: 'text',
              text: `成功创建留言:\n${JSON.stringify(message, null, 2)}`,
            },
          ],
        };
      }

      case 'reply_to_message': {
        const { messageId, content, author = 'Claude' } = args as {
          messageId: string;
          content: string;
          author?: string;
        };
        const reply = await messageStore.replyToMessage(messageId, content, author);
        if (!reply) {
          return {
            content: [
              {
                type: 'text',
                text: `未找到ID为 ${messageId} 的留言，无法回复`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `成功回复留言:\n${JSON.stringify(reply, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_message': {
        const { messageId } = args as { messageId: string };
        const success = await messageStore.deleteMessage(messageId);
        if (!success) {
          return {
            content: [
              {
                type: 'text',
                text: `未找到ID为 ${messageId} 的留言，无法删除`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `成功删除留言 ${messageId}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `未知工具: ${name}`,
            },
          ],
          isError: true,
        };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'messageboard://messages',
          name: '所有留言',
          description: '留言板上的所有留言列表',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === 'messageboard://messages') {
      const messages = await messageStore.getAllMessages();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(messages, null, 2),
          },
        ],
      };
    }
    throw new Error(`未知资源: ${uri}`);
  });

  return server;
}
