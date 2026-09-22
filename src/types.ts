export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  senderName?: string;
  sources?: GroundingSource[];
  searchQueries?: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  createdAt: number;
}

export interface Collaborator {
  id: string;
  name: string;
  avatarColor: string;
  isTyping?: boolean;
  lastActive: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  model: string;
  personaId: string;
}

export interface IdeaItem {
  title: string;
  description: string;
  category: string;
  impact: string;
  actionItem: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  icon: string;
}
