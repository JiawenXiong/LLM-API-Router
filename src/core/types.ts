// API 类型
export type ApiType = 'openai' | 'anthropic';

// 路由策略类型
export type RoutingStrategy = 'fixed' | 'random' | 'failover';

// 后端配置
export interface Backend {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiType: ApiType;
  isEnabled: boolean;
  priority: number; // 故障切换优先级，数字越小优先级越高
  connectionStatus?: 'valid' | 'invalid' | 'unknown'; // 连接状态
  lastChecked?: string; // 上次检查时间
  createdAt: string;
  updatedAt: string;
}

// 路由规则
export interface RoutingRule {
  id: string;
  name: string;
  strategy: RoutingStrategy;
  activeBackendId: string | null; // 固定模式使用的后端ID
  backendsOrder: string[]; // 故障切换顺序
  isActive: boolean;
}

// 请求统计
export interface RequestStat {
  id: string;
  backendId: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  ttftMs: number; // 首 token 响应时间（毫秒）
  avgSpeed: number; // 平均 token/秒
  totalTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

// 后端实时统计（每个后端最后一次使用的统计）
export interface BackendStats {
  backendId: string;
  backendName: string;
  lastUsed: string;
  inputTokens: number;
  outputTokens: number;
  ttftMs: number;
  avgSpeed: number;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
}

// OpenAI 消息格式
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// OpenAI 请求
export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

// Anthropic 消息格式
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
}

// Anthropic 请求
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
  [key: string]: unknown;
}

// 代理响应结果
export interface ProxyResult {
  success: boolean;
  backendId: string;
  inputTokens: number;
  outputTokens: number;
  ttftMs: number;
  avgSpeed: number;
  totalTimeMs: number;
  errorMessage?: string;
}

// IPC 通信消息类型
export interface IpcMessage<T = unknown> {
  channel: string;
  data: T;
}

// 应用状态
export interface AppState {
  serverPort: number;
  serverStatus: 'running' | 'stopped' | 'error';
  activeRoutingRule: RoutingRule | null;
  backends: Backend[];
}
