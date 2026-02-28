import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase, initDefaultRoutingRule } from '../core/database';
import { startServer, stopServer, getServerStatus, getServerUrl } from '../core/server';
import { setupIpcHandlers } from './ipc';
import { createTray } from './tray';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// 判断是否是开发环境（只有在设置了 NODE_ENV=development 时才认为是开发环境）
const isDev = process.env.NODE_ENV === 'development';

// 创建主窗口
function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
    show: false, // 先隐藏，加载完成后再显示
  });
  
  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.webContents.openDevTools(); // 开发调试
  }
  
  // 窗口准备就绪时显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  
  // 关闭窗口时最小化到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  return mainWindow;
}

// 应用准备就绪
app.whenReady().then(async () => {
  // 初始化数据库
  await initDatabase();
  initDefaultRoutingRule();
  
  // 设置 IPC 处理器
  setupIpcHandlers();
  
  // 创建窗口
  createWindow();
  
  // 创建系统托盘
  tray = createTray(mainWindow!, () => isQuitting, (val: boolean) => { isQuitting = val; });
  
  // 不自动启动服务，由用户手动控制
  console.log('应用已启动，请在界面中启动 API 服务');
  
  // macOS 激活应用时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', async () => {
  isQuitting = true;
  await stopServer();
  closeDatabase();
});

// 导出获取窗口的函数
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getTray(): Tray | null {
  return tray;
}

export function getIsQuitting(): boolean {
  return isQuitting;
}

export function setIsQuitting(val: boolean): void {
  isQuitting = val;
}
