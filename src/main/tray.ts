import { Tray, Menu, nativeImage, BrowserWindow, app, shell } from 'electron';
import path from 'path';
import { getServerUrl, getServerStatus } from '../core/server';

// 创建系统托盘
export function createTray(
  mainWindow: BrowserWindow, 
  getIsQuitting: () => boolean,
  setIsQuitting: (val: boolean) => void
): Tray {
  // 创建托盘图标
  const iconPath = path.join(__dirname, '../../resources/icon.svg');
  let icon: Electron.NativeImage;
  
  try {
    icon = nativeImage.createFromPath(iconPath);
    // 如果图标太大，调整大小
    if (!icon.isEmpty()) {
      icon = icon.resize({ width: 16, height: 16 });
    }
  } catch {
    // 如果图标文件不存在，创建一个默认图标
    icon = nativeImage.createEmpty();
  }
  
  const tray = new Tray(icon);
  
  // 更新托盘菜单
  const updateMenu = (): Menu => {
    const serverStatus = getServerStatus();
    const serverUrl = getServerUrl();
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'LLM API 路由器',
        enabled: false,
      },
      {
        type: 'separator',
      },
      {
        label: `服务状态: ${serverStatus.isRunning ? '运行中' : '已停止'}`,
        enabled: false,
      },
      {
        label: `API 地址: ${serverUrl}`,
        click: () => {
          shell.openExternal(serverUrl);
        },
      },
      {
        type: 'separator',
      },
      {
        label: '显示主窗口',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: '打开 API 文档',
        click: () => {
          shell.openExternal(`${serverUrl}/health`);
        },
      },
      {
        type: 'separator',
      },
      {
        label: '退出',
        click: () => {
          setIsQuitting(true);
          app.quit();
        },
      },
    ]);
    
    tray.setContextMenu(contextMenu);
    return contextMenu;
  };
  
  // 初始化菜单
  updateMenu();
  
  // 设置托盘提示
  tray.setToolTip('LLM API 路由器');
  
  // 点击托盘图标显示主窗口
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  
  // 定期更新菜单
  setInterval(updateMenu, 5000);
  
  return tray;
}