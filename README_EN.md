# LLM API Router

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://www.microsoft.com/windows)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green.svg)](https://nodejs.org/)

English | [简体中文](./README.md)

A desktop application for unified management and routing of multiple LLM API backends, allowing your LLM clients to access multiple AI model services through a single local API address.

## ✨ Features

### 🔗 Multi-Backend Management
- Support for multiple LLM API backends (OpenAI compatible, Anthropic format)
- Configure each backend with: Base URL, API Key, Model Name, Priority
- Quick duplicate configuration to create new backends

### 🚀 Flexible Routing Strategies
- **Fixed Mode**: Always use a specified backend model
- **Load Balancing**: Randomly select enabled backends to distribute request load
- **Failover**: Automatic switching by priority; use backup models when primary fails

### 📊 Detailed Statistics
- Input/Output token count tracking
- Time to First Token (TTFT)
- Average output speed (tokens/second)
- Request success rate tracking

### 🔧 Other Features
- SSE streaming output support
- Customizable service port
- System tray background running
- Configuration validity testing
- Local persistent data storage
- Command line tool support

## 📸 Screenshots

<details>
<summary>Click to expand</summary>

### Dashboard
![Dashboard](./dashboard-page.jpg)

### Backend Management
![Backend Management](./backend-management.jpg)

### Add Backend
![Add Backend](./add-backend-modal.jpg)

### Routing Strategy
![Routing Strategy](./routing-strategy.jpg)

### Request Logs
![Request Logs](./request-logs.jpg)

</details>

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm run dist
```

## 📖 Usage

### 1. Add Backend Configuration

Add your LLM API configuration on the "Backend Management" page:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Custom name | GPT-4, Claude 3 |
| API Type | OpenAI Compatible or Anthropic | OpenAI Compatible |
| Base URL | API service address | `https://api.openai.com` |
| API Key | Your API key | `sk-xxx...` |
| Model Name | Model identifier | `gpt-4`, `claude-3-opus-20240229` |

### 2. Configure Routing Strategy

Select routing mode on the "Routing Strategy" page:

| Mode | Description |
|------|-------------|
| Fixed | Always use the specified backend model |
| Load Balancing | Randomly select enabled backends |
| Failover | Auto-switch by priority; use backup when primary fails |

### 3. Start Service

Start the local API service on the "Dashboard" page, then configure your LLM client to use the local address:

```
http://localhost:8765/v1/chat/completions
```

## 💻 Supported Clients

Any LLM client that supports custom API addresses can use this router:

- [Cherry Studio](https://github.com/kangfenmao/cherry-studio)
- [ChatBox](https://github.com/Bin-Huang/chatbox)
- [OpenCat](https://opencat.app/)
- Other clients supporting OpenAI API format

## 🛠️ Tech Stack

| Type | Technology |
|------|------------|
| Frontend | Electron + React + TypeScript + Ant Design |
| Backend | Node.js + Express |
| Database | SQLite (sql.js) |

## 📁 Project Structure

```
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main process entry
│   │   ├── ipc.ts      # IPC communication
│   │   ├── preload.ts  # Preload script
│   │   └── tray.ts     # System tray
│   │
│   ├── renderer/       # Renderer process (React frontend)
│   │   ├── App.tsx     # Main app component
│   │   └── pages/      # Page components
│   │       ├── Dashboard.tsx  # Dashboard
│   │       ├── Backends.tsx   # Backend Management
│   │       ├── Routing.tsx    # Routing Strategy
│   │       └── Logs.tsx       # Request Logs
│   │
│   └── core/           # Core business logic
│       ├── server.ts   # Local API server
│       ├── router.ts   # Routing strategy engine
│       ├── proxy.ts    # API proxy forwarding
│       ├── stats.ts    # Statistics module
│       ├── database.ts # Database operations
│       └── types.ts    # Type definitions
│
└── resources/          # Resource files
```

## ⌨️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode (starts frontend and main process) |
| `npm run build` | Build for production |
| `npm run start` | Start the application |
| `npm run dist` | Package installer |

## 📄 License

[MIT License](LICENSE)
