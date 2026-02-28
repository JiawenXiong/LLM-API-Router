import http from 'http';
import https from 'https';
import type { Backend, OpenAIChatRequest, AnthropicRequest, ProxyResult, OpenAIMessage, AnthropicMessage } from './types';
import { saveRequestStat } from './database';

// 计算消息的 token 数（简单估算）
function estimateTokens(content: string): number {
  // 简单估算：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = content.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

function estimateMessagesTokens(messages: (OpenAIMessage | AnthropicMessage)[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.text) {
          total += estimateTokens(part.text);
        }
      }
    }
    total += 4; // 角色和格式开销
  }
  return total;
}

// 解析 URL，获取 hostname、port、path
function parseBaseUrl(baseUrl: string): { hostname: string; port: number | undefined; basePath: string } {
  try {
    const url = new URL(baseUrl);
    return {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
      basePath: url.pathname.replace(/\/$/, ''), // 移除末尾斜杠
    };
  } catch {
    // 如果解析失败，尝试添加协议
    const url = new URL('https://' + baseUrl);
    return {
      hostname: url.hostname,
      port: 443,
      basePath: url.pathname.replace(/\/$/, ''),
    };
  }
}

// 流式代理请求
export function createProxyStream(
  backend: Backend,
  requestBody: OpenAIChatRequest | AnthropicRequest,
  onChunk: (chunk: Buffer) => void,
  onComplete: (result: ProxyResult, responseBody?: string) => void
): http.ClientRequest {
  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let outputTokens = 0;
  const chunks: Buffer[] = [];
  
  const { hostname, port, basePath } = parseBaseUrl(backend.baseUrl);
  const isHttps = backend.baseUrl.startsWith('https');
  const httpModule = isHttps ? https : http;
  
  let apiPath: string;
  let body: string;
  let headers: Record<string, string>;
  
  if (backend.apiType === 'openai') {
    // OpenAI 兼容 API
    apiPath = basePath + '/v1/chat/completions';
    const openaiBody = { ...requestBody } as OpenAIChatRequest;
    openaiBody.model = backend.model;
    body = JSON.stringify(openaiBody);
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${backend.apiKey}`,
      'Accept': 'text/event-stream',
    };
  } else {
    // Anthropic API
    apiPath = basePath + '/v1/messages';
    const anthropicBody = { ...requestBody } as AnthropicRequest;
    anthropicBody.model = backend.model;
    body = JSON.stringify(anthropicBody);
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': backend.apiKey,
      'anthropic-version': '2023-06-01',
      'Accept': 'text/event-stream',
    };
  }
  
  console.log(`[Proxy] 请求 ${backend.name}: ${hostname}${apiPath}`);
  
  const inputTokens = estimateMessagesTokens(
    backend.apiType === 'openai' 
      ? (requestBody as OpenAIChatRequest).messages 
      : (requestBody as AnthropicRequest).messages
  );
  
  const req = httpModule.request(
    {
      hostname: hostname,
      port: port,
      path: apiPath,
      method: 'POST',
      headers: headers,
      timeout: 120000, // 2分钟超时
    },
    (res) => {
      console.log(`[Proxy] 响应状态: ${res.statusCode}`);
      
      res.on('data', (chunk: Buffer) => {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }
        
        chunks.push(chunk);
        
        // 估算输出 tokens
        const chunkStr = chunk.toString();
        const contentMatches = chunkStr.match(/"content":"([^"]*)"/g);
        if (contentMatches) {
          for (const match of contentMatches) {
            const content = match.replace(/"content":"([^"]*)"/, '$1');
            outputTokens += estimateTokens(content);
          }
        }
        
        onChunk(chunk);
      });
      
      res.on('end', () => {
        const totalTime = Date.now() - startTime;
        const ttftMs = firstTokenTime ? firstTokenTime - startTime : 0;
        const avgSpeed = totalTime > 0 ? (outputTokens / totalTime) * 1000 : 0;
        const responseBody = Buffer.concat(chunks).toString();
        
        // 判断是否成功：HTTP 状态码 < 400
        const success = res.statusCode !== undefined && res.statusCode < 400;
        
        // 尝试解析错误信息
        let errorMessage: string | undefined;
        if (!success) {
          try {
            const json = JSON.parse(responseBody);
            errorMessage = json.error?.message || json.message || `HTTP ${res.statusCode}`;
          } catch {
            errorMessage = responseBody.substring(0, 200) || `HTTP ${res.statusCode}`;
          }
          console.log(`[Proxy] 错误响应: ${errorMessage}`);
        }
        
        const result: ProxyResult = {
          success,
          backendId: backend.id,
          inputTokens,
          outputTokens,
          ttftMs,
          avgSpeed,
          totalTimeMs: totalTime,
          errorMessage,
        };
        
        // 保存统计
        saveRequestStat({
          backendId: backend.id,
          timestamp: new Date().toISOString(),
          inputTokens,
          outputTokens,
          ttftMs,
          avgSpeed,
          totalTimeMs: totalTime,
          success,
          errorMessage,
        });
        
        onComplete(result, responseBody);
      });
    }
  );
  
  req.on('error', (error) => {
    console.error(`[Proxy] 请求错误: ${error.message}`);
    const totalTime = Date.now() - startTime;
    const result: ProxyResult = {
      success: false,
      backendId: backend.id,
      inputTokens,
      outputTokens: 0,
      ttftMs: 0,
      avgSpeed: 0,
      totalTimeMs: totalTime,
      errorMessage: error.message,
    };
    
    saveRequestStat({
      backendId: backend.id,
      timestamp: new Date().toISOString(),
      inputTokens,
      outputTokens: 0,
      ttftMs: 0,
      avgSpeed: 0,
      totalTimeMs: totalTime,
      success: false,
      errorMessage: error.message,
    });
    
    onComplete(result);
  });
  
  req.on('timeout', () => {
    console.error(`[Proxy] 请求超时`);
    req.destroy();
  });
  
  req.write(body);
  req.end();
  
  return req;
}

// 将 OpenAI 请求转换为 Anthropic 请求
export function convertOpenAIToAnthropic(openaiRequest: OpenAIChatRequest): AnthropicRequest {
  const messages: AnthropicMessage[] = [];
  let system: string | undefined;
  
  for (const msg of openaiRequest.messages) {
    if (msg.role === 'system') {
      system = typeof msg.content === 'string' ? msg.content : '';
    } else {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : '',
      });
    }
  }
  
  return {
    model: openaiRequest.model,
    messages,
    system,
    max_tokens: openaiRequest.max_tokens || 4096,
    temperature: openaiRequest.temperature,
    stream: openaiRequest.stream,
  };
}

// 将 Anthropic 请求转换为 OpenAI 请求
export function convertAnthropicToOpenAI(anthropicRequest: AnthropicRequest): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];
  
  if (anthropicRequest.system) {
    messages.push({
      role: 'system',
      content: anthropicRequest.system,
    });
  }
  
  for (const msg of anthropicRequest.messages) {
    messages.push({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : '',
    });
  }
  
  return {
    model: anthropicRequest.model,
    messages,
    max_tokens: anthropicRequest.max_tokens,
    temperature: anthropicRequest.temperature,
    stream: anthropicRequest.stream,
  };
}