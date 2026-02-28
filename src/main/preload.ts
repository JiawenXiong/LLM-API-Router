import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 后端管理
  getBackends: () => ipcRenderer.invoke('get-backends'),
  getBackend: (id: string) => ipcRenderer.invoke('get-backend', id),
  createBackend: (backend: unknown) => ipcRenderer.invoke('create-backend', backend),
  updateBackend: (id: string, updates: unknown) => ipcRenderer.invoke('update-backend', id, updates),
  updateBackendStatus: (id: string, status: 'valid' | 'invalid' | 'unknown') => 
    ipcRenderer.invoke('update-backend-status', id, status),
  deleteBackend: (id: string) => ipcRenderer.invoke('delete-backend', id),
  
  // 路由规则管理
  getRoutingRules: () => ipcRenderer.invoke('get-routing-rules'),
  getActiveRoutingRule: () => ipcRenderer.invoke('get-active-routing-rule'),
  createRoutingRule: (rule: unknown) => ipcRenderer.invoke('create-routing-rule', rule),
  updateRoutingRule: (id: string, updates: unknown) => ipcRenderer.invoke('update-routing-rule', id, updates),
  setActiveRoutingRule: (id: string) => ipcRenderer.invoke('set-active-routing-rule', id),
  
  // 统计
  getBackendStats: (backendId: string) => ipcRenderer.invoke('get-backend-stats', backendId),
  getAllBackendStats: () => ipcRenderer.invoke('get-all-backend-stats'),
  getRecentStats: (limit?: number) => ipcRenderer.invoke('get-recent-stats', limit),
  getOverallStats: () => ipcRenderer.invoke('get-overall-stats'),
  
  // 服务器控制
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  startServer: (port?: number) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getSavedPort: () => ipcRenderer.invoke('get-saved-port'),
  savePort: (port: number) => ipcRenderer.invoke('save-port', port),
  
  // 测试后端连接
  testBackendConnection: (backend: unknown) => ipcRenderer.invoke('test-backend-connection', backend),
});

// TypeScript 类型定义
export interface ElectronAPI {
  getBackends: () => Promise<unknown[]>;
  getBackend: (id: string) => Promise<unknown | null>;
  createBackend: (backend: unknown) => Promise<unknown>;
  updateBackend: (id: string, updates: unknown) => Promise<unknown | null>;
  updateBackendStatus: (id: string, status: 'valid' | 'invalid' | 'unknown') => Promise<unknown | null>;
  deleteBackend: (id: string) => Promise<boolean>;
  
  getRoutingRules: () => Promise<unknown[]>;
  getActiveRoutingRule: () => Promise<unknown | null>;
  createRoutingRule: (rule: unknown) => Promise<unknown>;
  updateRoutingRule: (id: string, updates: unknown) => Promise<unknown | null>;
  setActiveRoutingRule: (id: string) => Promise<void>;
  
  getBackendStats: (backendId: string) => Promise<unknown | null>;
  getAllBackendStats: () => Promise<unknown[]>;
  getRecentStats: (limit?: number) => Promise<unknown[]>;
  getOverallStats: () => Promise<unknown>;
  
  getServerStatus: () => Promise<{ isRunning: boolean; port: number }>;
  startServer: (port?: number) => Promise<{ success: boolean; port?: number; error?: string }>;
  stopServer: () => Promise<void>;
  getServerUrl: () => Promise<string>;
  getSavedPort: () => Promise<number>;
  savePort: (port: number) => Promise<boolean>;
  
  testBackendConnection: (backend: unknown) => Promise<{ success: boolean; message: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
