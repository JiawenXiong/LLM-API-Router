import { ipcMain } from 'electron';
import {
  getAllBackends,
  getBackendById,
  createBackend,
  updateBackend,
  updateBackendConnectionStatus,
  deleteBackend,
  getAllRoutingRules,
  getActiveRoutingRule,
  createRoutingRule,
  updateRoutingRule,
  setActiveRoutingRule,
  getBackendStats,
  getAllBackendStats,
  getRecentStats,
  getSavedPort,
  savePort,
} from '../core/database';
import { startServer, stopServer, getServerStatus, getServerUrl } from '../core/server';
import { getOverallStats } from '../core/stats';
import type { Backend, RoutingRule } from '../core/types';
import https from 'https';
import http from 'http';

// 设置 IPC 处理器
export function setupIpcHandlers(): void {
  // ========== 后端管理 ==========
  
  ipcMain.handle('get-backends', async () => {
    return getAllBackends();
  });
  
  ipcMain.handle('get-backend', async (_event, id: string) => {
    return getBackendById(id);
  });
  
  ipcMain.handle('create-backend', async (_event, backend: Omit<Backend, 'id' | 'createdAt' | 'updatedAt'>) => {
    return createBackend(backend);
  });
  
  ipcMain.handle('update-backend', async (_event, id: string, updates: Partial<Omit<Backend, 'id' | 'createdAt' | 'updatedAt'>>) => {
    return updateBackend(id, updates);
  });
  
  ipcMain.handle('update-backend-status', async (_event, id: string, status: 'valid' | 'invalid' | 'unknown') => {
    updateBackendConnectionStatus(id, status);
    return getBackendById(id);
  });
  
  ipcMain.handle('delete-backend', async (_event, id: string) => {
    return deleteBackend(id);
  });
  
  // ========== 路由规则管理 ==========
  
  ipcMain.handle('get-routing-rules', async () => {
    return getAllRoutingRules();
  });
  
  ipcMain.handle('get-active-routing-rule', async () => {
    return getActiveRoutingRule();
  });
  
  ipcMain.handle('create-routing-rule', async (_event, rule: Omit<RoutingRule, 'id'>) => {
    return createRoutingRule(rule);
  });
  
  ipcMain.handle('update-routing-rule', async (_event, id: string, updates: Partial<Omit<RoutingRule, 'id'>>) => {
    return updateRoutingRule(id, updates);
  });
  
  ipcMain.handle('set-active-routing-rule', async (_event, id: string) => {
    setActiveRoutingRule(id);
  });
  
  // ========== 统计 ==========
  
  ipcMain.handle('get-backend-stats', async (_event, backendId: string) => {
    return getBackendStats(backendId);
  });
  
  ipcMain.handle('get-all-backend-stats', async () => {
    return getAllBackendStats();
  });
  
  ipcMain.handle('get-recent-stats', async (_event, limit?: number) => {
    return getRecentStats(limit || 100);
  });
  
  ipcMain.handle('get-overall-stats', async () => {
    return getOverallStats();
  });
  
  // ========== 服务器控制 ==========
  
  ipcMain.handle('get-server-status', async () => {
    return getServerStatus();
  });
  
  ipcMain.handle('start-server', async (_event, port?: number) => {
    try {
      const actualPort = await startServer(port || 8765);
      return { success: true, port: actualPort };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  ipcMain.handle('stop-server', async () => {
    return stopServer();
  });
  
  ipcMain.handle('get-server-url', async () => {
    return getServerUrl();
  });
  
  ipcMain.handle('get-saved-port', async () => {
    return getSavedPort();
  });
  
  ipcMain.handle('save-port', async (_event, port: number) => {
    savePort(port);
    return true;
  });
  
  // ========== 测试后端连接 ==========
  
  ipcMain.handle('test-backend-connection', async (_event, backend: Backend) => {
    return testBackendConnection(backend);
  });
}

// 测试后端连接（通过发送简单聊天请求）
async function testBackendConnection(backend: Backend): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    // 解析 baseUrl，保留路径部分
    let hostname: string;
    let port: number | undefined;
    let basePath: string;
    let isHttps = true;
    
    try {
      const url = new URL(backend.baseUrl);
      hostname = url.hostname;
      port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
      basePath = url.pathname.replace(/\/$/, ''); // 移除末尾斜杠
      isHttps = url.protocol === 'https:';
    } catch {
      // 如果解析失败，尝试添加协议
      const url = new URL('https://' + backend.baseUrl);
      hostname = url.hostname;
      port = 443;
      basePath = url.pathname.replace(/\/$/, '');
    }
    
    const httpModule = isHttps ? https : http;
    
    let apiPath: string;
    let headers: Record<string, string>;
    let body: string;
    
    if (backend.apiType === 'openai') {
      // OpenAI 兼容 API：发送简单聊天请求
      apiPath = basePath + '/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${backend.apiKey}`,
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: backend.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      });
    } else {
      // Anthropic API：发送简单消息请求
      apiPath = basePath + '/v1/messages';
      headers = {
        'x-api-key': backend.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: backend.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }
    
    console.log(`[Test] 测试连接: ${backend.name} -> ${hostname}${apiPath}`);
    
    const req = httpModule.request(
      {
        hostname: hostname,
        port: port,
        path: apiPath,
        method: 'POST',
        headers: headers,
        timeout: 30000, // 30秒超时（大模型响应可能较慢）
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log(`[Test] 响应状态: ${res.statusCode}`);
          if (res.statusCode && res.statusCode < 400) {
            resolve({ success: true, message: '连接成功' });
          } else {
            let errorMsg = `HTTP ${res.statusCode}`;
            try {
              const json = JSON.parse(data);
              errorMsg = json.error?.message || json.message || json.error?.error?.message || errorMsg;
            } catch {
              // ignore
            }
            resolve({ success: false, message: errorMsg });
          }
        });
      }
    );
    
    req.on('error', (error) => {
      console.log(`[Test] 请求错误: ${error.message}`);
      resolve({ success: false, message: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: '连接超时' });
    });
    
    req.write(body);
    req.end();
  });
}
