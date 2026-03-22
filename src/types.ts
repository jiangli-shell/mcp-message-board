export interface Message {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  replies: Reply[];
}

export interface Reply {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

export interface CreateMessageInput {
  content: string;
  author: string;
}

export interface ReplyMessageInput {
  messageId: string;
  content: string;
  author: string;
}
