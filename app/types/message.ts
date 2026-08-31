import type { MessageInfo, QuestionInfo, ReasoningPart, ToolPart } from './sse';

export type MessageTokens = {
  input: number;
  output: number;
  reasoning: number;
  total?: number;
  cache?: {
    read: number;
    write: number;
  };
};

export type MessageUsage = {
  tokens: MessageTokens;
  cost?: number;
  providerId?: string;
  modelId?: string;
  contextPercent?: number | null;
};

export type MessageAttachment = {
  id: string;
  url: string;
  mime: string;
  filename: string;
};

export type MessageDiffEntry = {
  file: string;
  diff: string;
  before?: string;
  after?: string;
};

export type MessageStatus = 'streaming' | 'complete' | 'error';

export type HistoryEntry =
  | { kind: 'message'; message: MessageInfo; time: number }
  | { kind: 'tool'; part: ToolPart; time: number }
  | { kind: 'reasoning'; part: ReasoningPart; time: number }
  | { kind: 'question'; part: ToolPart; time: number };

export type HistoryWindowEntry =
  | { key: string; kind: 'message'; content: string; time: number; agent?: string }
  | { key: string; kind: 'tool'; part: ToolPart; time: number }
  | { key: string; kind: 'reasoning'; part: ReasoningPart; time: number }
  | {
      key: string;
      kind: 'question';
      questions: QuestionInfo[];
      status: 'pending' | 'replied' | 'rejected';
      answers?: string[][];
      time: number;
    };

export type ModelMeta = {
  displayName: string;
  providerLabel?: string;
};

export type ThreadTarget = {
  agent?: string;
  modelDisplayName?: string;
  providerLabel?: string;
  variant?: string;
};
