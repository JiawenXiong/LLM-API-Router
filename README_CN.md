# LLM API 路由器

[English](./README.md) | 简体中文

一个桌面应用程序，用于统一管理和路由多个 LLM API 后端，让您的 LLM 客户端只需配置一个本地 API 地址即可访问多个大模型服务。

## 功能特性

### 🔗 多后端管理
- 支持配置多个 LLM API 后端（OpenAI 兼容格式、Anthropic 格式）
- 每个后端可配置：Base URL、API Key、模型名称、优先级
- 支持快速复制配置创建新后端

### 🚀 灵活的路由策略
- **固定模式**：始终使用指定的后端模型
- **负载均衡**：随机选择已启用的后端，分散请求压力
- **故障切换**：按优先级自动切换，主模型故障时自动使用备用模型

### 📊 详细统计
- 输入/输出 Token 数量统计
- 首 Token 响应时间（TTFT）
- 平均输出速度（Token/秒）
- 请求成功率追踪

### 🔧 其他特性
- 支持 SSE 流式输出
- 可自定义服务端口
- 系统托盘后台运行
- 配置有效性测试
- 本地数据持久化存储

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm run dist
```

## 使用方法

### 1. 添加后端配置

在「后端管理」页面添加您的 LLM API 配置：
- **名称**：自定义名称，如 "GPT-4"、"Claude 3"
- **API 类型**：OpenAI 兼容 或 Anthropic
- **Base URL**：API 服务地址，如 `https://api.openai.com`
- **API Key**：您的 API 密钥
- **模型名称**：如 `gpt-4`、`claude-3-opus-20240229`

### 2. 配置路由策略

在「路由策略」页面选择路由模式：
- 选择固定模式时需指定使用的后端
- 故障切换模式下按优先级自动切换

### 3. 启动服务

在「仪表盘」页面启动本地 API 服务，然后将您的 LLM 客户端配置为使用本地地址：

```
http://localhost:8765/v1/chat/completions
```

## 支持的客户端

任何支持自定义 API 地址的 LLM 客户端都可以使用，例如：
- Cherry Studio
- ChatBox
- OpenCat
- 其他支持 OpenAI API 格式的客户端

## 技术栈

- **前端**：Electron + React + TypeScript + Ant Design
- **后端**：Node.js + Express
- **数据库**：SQLite (sql.js)

## 项目结构

```
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts    # 主进程入口
│   │   ├── ipc.ts      # IPC 通信
│   │   ├── preload.ts  # 预加载脚本
│   │   └── tray.ts     # 系统托盘
│   │
│   ├── renderer/       # 渲染进程（React 前端）
│   │   ├── App.tsx     # 主应用组件
│   │   └── pages/      # 页面组件
│   │       ├── Dashboard.tsx  # 仪表盘
│   │       ├── Backends.tsx   # 后端管理
│   │       ├── Routing.tsx    # 路由策略
│   │       └── Logs.tsx       # 请求日志
│   │
│   └── core/           # 核心业务逻辑
│       ├── server.ts   # 本地 API 服务器
│       ├── router.ts   # 路由策略引擎
│       ├── proxy.ts    # API 代理转发
│       ├── stats.ts    # 统计模块
│       ├── database.ts # 数据库操作
│       └── types.ts    # 类型定义
│
└── resources/          # 资源文件
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（同时启动前端和主进程） |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动应用 |
| `npm run dist` | 打包安装程序 |

## 许可证

MIT License
