import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { Backend, OpenAIChatRequest, AnthropicRequest, ProxyResult } from './types';
import { selectBackend, getNextBackendForFailover } from './router';
import { createProxyStream, convertOpenAIToAnthropic, convertAnthropicToOpenAI } from './proxy';
import { getActiveRoutingRule, getAllBackends } from './database';

let server: ReturnType<typeof express.application.listen> | null = null;
let currentPort = 3000;

// 创建 Express 应用
function createApp(): express.Application {
  const app = express();
  
  // CORS 配置 - 允许所有来源
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'anthropic-version', 'Accept'],
    credentials: true,
  }));
  
  // 显式处理 OPTIONS 预检请求
  app.options('*', cors());
  
  app.use(express.json({ limit: '10mb' }));
  
  // 请求日志
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} Content-Type: ${req.get('Content-Type')}`);
    next();
  });
  
  // 健康检查
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // 获取可用模型列表
  app.get('/v1/models', (_req: Request, res: Response) => {
    const backends = getAllBackends();
    const models = backends
      .filter(b => b.isEnabled)
      .map(b => ({
        id: b.model,
        object: 'model',
        created: new Date(b.createdAt).getTime() / 1000,
        owned_by: b.apiType,
      }));
    
    res.json({
      object: 'list',
      data: models,
    });
  });
  
  // OpenAI 兼容的聊天接口
  app.post('/v1/chat/completions', handleChatCompletion);
  
  // Anthropic 兼容的消息接口
  app.post('/v1/messages', handleMessages);
  
  // 错误处理
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: {
        message: err.message,
        type: 'internal_error',
      },
    });
  });
  
  return app;
}

// 处理 OpenAI 格式的聊天请求
async function handleChatCompletion(req: Request, res: Response): Promise<void> {
  const openaiRequest = req.body as OpenAIChatRequest;
  const isStream = openaiRequest.stream === true;
  
  console.log('[Server] 收到 OpenAI 格式请求, stream:', isStream);
  
  // 选择后端
  const backend = selectBackend();
  if (!backend) {
    res.status(503).json({
      error: {
        message: '没有可用的后端服务',
        type: 'service_unavailable',
      },
    });
    return;
  }
  
  console.log(`[Server] 路由请求到后端: ${backend.name} (${backend.apiType})`);
  
  if (isStream) {
    await handleStreamRequest(req, res, backend, openaiRequest, 'openai');
  } else {
    await handleNonStreamRequest(req, res, backend, openaiRequest, 'openai');
  }
}

// 处理 Anthropic 格式的消息请求
async function handleMessages(req: Request, res: Response): Promise<void> {
  const anthropicRequest = req.body as AnthropicRequest;
  const isStream = anthropicRequest.stream === true;
  
  console.log('[Server] 收到 Anthropic 格式请求, stream:', isStream);
  
  // 选择后端
  const backend = selectBackend();
  if (!backend) {
    res.status(503).json({
      error: {
        message: '没有可用的后端服务',
        type: 'service_unavailable',
      },
    });
    return;
  }
  
  console.log(`[Server] 路由请求到后端: ${backend.name} (${backend.apiType})`);
  
  // 如果后端是 OpenAI 类型，需要转换请求
  let requestBody: OpenAIChatRequest | AnthropicRequest;
  if (backend.apiType === 'openai') {
    requestBody = convertAnthropicToOpenAI(anthropicRequest);
  } else {
    requestBody = anthropicRequest;
  }
  
  if (isStream) {
    await handleStreamRequest(req, res, backend, requestBody, 'anthropic');
  } else {
    await handleNonStreamRequest(req, res, backend, requestBody, 'anthropic');
  }
}

// 处理流式请求
async function handleStreamRequest(
  _req: Request,
  res: Response,
  initialBackend: Backend,
  requestBody: OpenAIChatRequest | AnthropicRequest,
  _sourceType: 'openai' | 'anthropic'
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let currentBackend = initialBackend;
  let attempts = 0;
  const maxAttempts = 3;
  
  const attemptRequest = (backend: Backend): void => {
    attempts++;
    console.log(`[Server] 尝试请求后端: ${backend.name} (第 ${attempts} 次)`);
    
    createProxyStream(
      backend,
      requestBody,
      (chunk: Buffer) => {
        res.write(chunk);
      },
      async (result: ProxyResult) => {
        console.log(`[Server] 请求结果: success=${result.success}, error=${result.errorMessage || 'none'}`);
        
        if (!result.success && attempts < maxAttempts) {
          // 尝试故障切换
          const rule = getActiveRoutingRule();
          if (rule && rule.strategy === 'failover') {
            const nextBackend = getNextBackendForFailover(backend.id, rule);
            if (nextBackend) {
              console.log(`[Server] 故障切换: ${backend.name} -> ${nextBackend.name}`);
              attemptRequest(nextBackend);
              return;
            }
          }
          
          // 没有可切换的后端，返回错误
          res.write(`data: ${JSON.stringify({ error: { message: result.errorMessage || '请求失败' } })}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
      }
    );
  };
  
  attemptRequest(currentBackend);
  
  // 处理客户端断开连接
  res.on('close', () => {
    console.log('[Server] 客户端断开连接');
  });
  
  // 处理错误
  res.on('error', (err) => {
    console.error('[Server] 响应错误:', err);
  });
}

// 处理非流式请求
async function handleNonStreamRequest(
  _req: Request,
  res: Response,
  initialBackend: Backend,
  requestBody: OpenAIChatRequest | AnthropicRequest,
  _sourceType: 'openai' | 'anthropic'
): Promise<void> {
  let currentBackend = initialBackend;
  let attempts = 0;
  const maxAttempts = 3;
  
  const attemptRequest = async (backend: Backend): Promise<void> => {
    attempts++;
    
    return new Promise((resolve) => {
      createProxyStream(
        backend,
        requestBody,
        () => {
          // 非流式请求，不处理 chunk
        },
        async (result: ProxyResult, responseBody?: string) => {
          if (!result.success && attempts < maxAttempts) {
            // 尝试故障切换
            const rule = getActiveRoutingRule();
            if (rule && rule.strategy === 'failover') {
              const nextBackend = getNextBackendForFailover(backend.id, rule);
              if (nextBackend) {
                console.log(`[Server] 故障切换: ${backend.name} -> ${nextBackend.name}`);
                await attemptRequest(nextBackend);
                resolve();
                return;
              }
            }
            
            // 所有尝试都失败
            res.status(502).json({
              error: {
                message: result.errorMessage || '后端服务错误',
                type: 'backend_error',
              },
            });
          } else if (responseBody) {
            // 返回响应
            try {
              const jsonResponse = JSON.parse(responseBody);
              res.json(jsonResponse);
            } catch {
              res.send(responseBody);
            }
          } else {
            res.status(500).json({
              error: {
                message: '无响应',
                type: 'no_response',
              },
            });
          }
          resolve();
        }
      );
    });
  };
  
  await attemptRequest(currentBackend);
}

// 启动服务器
export function startServer(port: number = 8765): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close();
      server = null;
    }
    
    const app = createApp();
    currentPort = port;
    
    server = app.listen(port, () => {
      console.log(`API 服务器已启动: http://localhost:${port}`);
      resolve(port);
    });
    
    server.on('error', (err: NodeJS.ErrnoException) => {
      server = null;
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用，请选择其他端口`));
      } else if (err.code === 'EACCES') {
        reject(new Error(`没有权限使用端口 ${port}`));
      } else {
        reject(err);
      }
    });
  });
}

// 停止服务器
export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('API 服务器已停止');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// 获取服务器状态
export function getServerStatus(): { isRunning: boolean; port: number } {
  return {
    isRunning: server !== null,
    port: currentPort,
  };
}

// 获取服务器地址
export function getServerUrl(): string {
  return `http://localhost:${currentPort}`;
}