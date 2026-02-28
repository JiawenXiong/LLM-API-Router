import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import type { Backend, RoutingRule, RequestStat, BackendStats } from './types';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

// 初始化 SQL.js
async function initSqlJsEngine(): Promise<void> {
  const SQL = await initSqlJs({
    // 在 Electron 中使用 wasm 文件
    locateFile: (file: string) => {
      if (typeof __dirname !== 'undefined') {
        // 开发环境和打包后的路径
        return path.join(__dirname, file);
      }
      return file;
    },
  });
  
  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS backends (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      api_type TEXT DEFAULT 'openai',
      is_enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      connection_status TEXT DEFAULT 'unknown',
      last_checked TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      strategy TEXT NOT NULL,
      active_backend_id TEXT,
      backends_order TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS request_stats (
      id TEXT PRIMARY KEY,
      backend_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      ttft_ms INTEGER,
      avg_speed REAL,
      total_time_ms INTEGER,
      success INTEGER DEFAULT 1,
      error_message TEXT
    )
  `);
  
  // 设置表（用于保存端口等配置）
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  // 数据库迁移：添加缺失的列
  migrateDatabase();
  
  saveDatabase();
}

// 数据库迁移：检查并添加缺失的列
function migrateDatabase(): void {
  if (!db) return;
  
  // 获取 backends 表的列信息
  const columns = db.exec("PRAGMA table_info(backends)");
  if (columns.length === 0) return;
  
  const columnNames = columns[0].values.map(col => col[1] as string);
  
  // 添加 connection_status 列
  if (!columnNames.includes('connection_status')) {
    console.log('[Database] 添加 connection_status 列');
    db.run('ALTER TABLE backends ADD COLUMN connection_status TEXT DEFAULT "unknown"');
  }
  
  // 添加 last_checked 列
  if (!columnNames.includes('last_checked')) {
    console.log('[Database] 添加 last_checked 列');
    db.run('ALTER TABLE backends ADD COLUMN last_checked TEXT');
  }
}

// 保存数据库到文件
function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  }
}

// 获取数据库路径
function getDbPath(): string {
  const { app } = require('electron');
  const userDataPath = app ? app.getPath('userData') : process.cwd();
  return path.join(userDataPath, 'llm-router.db');
}

// 初始化数据库
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;
  
  dbPath = getDbPath();
  await initSqlJsEngine();
  return db!;
}

// 获取数据库实例
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// 关闭数据库
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// ========== 后端配置操作 ==========

export function getAllBackends(): Backend[] {
  const stmt = getDatabase().prepare('SELECT * FROM backends ORDER BY priority ASC, created_at DESC');
  const results: Backend[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      name: row.name as string,
      baseUrl: row.base_url as string,
      apiKey: row.api_key as string,
      model: row.model as string,
      apiType: (row.api_type as 'openai' | 'anthropic') || 'openai',
      isEnabled: row.is_enabled === 1,
      priority: row.priority as number,
      connectionStatus: (row.connection_status as 'valid' | 'invalid' | 'unknown') || 'unknown',
      lastChecked: row.last_checked as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
  stmt.free();
  return results;
}

export function getBackendById(id: string): Backend | null {
  const stmt = getDatabase().prepare('SELECT * FROM backends WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      name: row.name as string,
      baseUrl: row.base_url as string,
      apiKey: row.api_key as string,
      model: row.model as string,
      apiType: (row.api_type as 'openai' | 'anthropic') || 'openai',
      isEnabled: row.is_enabled === 1,
      priority: row.priority as number,
      connectionStatus: (row.connection_status as 'valid' | 'invalid' | 'unknown') || 'unknown',
      lastChecked: row.last_checked as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
  stmt.free();
  return null;
}

export function createBackend(backend: Omit<Backend, 'id' | 'createdAt' | 'updatedAt'>): Backend {
  const now = new Date().toISOString();
  const newBackend: Backend = {
    ...backend,
    id: uuidv4(),
    connectionStatus: 'unknown',
    createdAt: now,
    updatedAt: now,
  };
  
  getDatabase().run(
    `INSERT INTO backends (id, name, base_url, api_key, model, api_type, is_enabled, priority, connection_status, last_checked, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newBackend.id,
      newBackend.name,
      newBackend.baseUrl,
      newBackend.apiKey,
      newBackend.model,
      newBackend.apiType,
      newBackend.isEnabled ? 1 : 0,
      newBackend.priority,
      newBackend.connectionStatus || 'unknown',
      newBackend.lastChecked || null,
      newBackend.createdAt,
      newBackend.updatedAt,
    ]
  );
  
  saveDatabase();
  return newBackend;
}

export function updateBackend(id: string, updates: Partial<Omit<Backend, 'id' | 'createdAt' | 'updatedAt'>>): Backend | null {
  const existing = getBackendById(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  const updated = { ...existing, ...updates, updatedAt: now };
  
  getDatabase().run(
    `UPDATE backends 
     SET name = ?, base_url = ?, api_key = ?, model = ?, api_type = ?, is_enabled = ?, priority = ?, connection_status = ?, last_checked = ?, updated_at = ?
     WHERE id = ?`,
    [
      updated.name,
      updated.baseUrl,
      updated.apiKey,
      updated.model,
      updated.apiType,
      updated.isEnabled ? 1 : 0,
      updated.priority,
      updated.connectionStatus || 'unknown',
      updated.lastChecked || null,
      updated.updatedAt,
      id,
    ]
  );
  
  saveDatabase();
  return updated;
}

// 更新后端连接状态
export function updateBackendConnectionStatus(id: string, status: 'valid' | 'invalid' | 'unknown'): void {
  const now = new Date().toISOString();
  getDatabase().run(
    `UPDATE backends SET connection_status = ?, last_checked = ?, updated_at = ? WHERE id = ?`,
    [status, now, now, id]
  );
  saveDatabase();
}

export function deleteBackend(id: string): boolean {
  getDatabase().run('DELETE FROM backends WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// ========== 路由规则操作 ==========

export function getActiveRoutingRule(): RoutingRule | null {
  const stmt = getDatabase().prepare('SELECT * FROM routing_rules WHERE is_active = 1 LIMIT 1');
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      name: row.name as string,
      strategy: row.strategy as 'fixed' | 'random' | 'failover',
      activeBackendId: row.active_backend_id as string | null,
      backendsOrder: row.backends_order ? JSON.parse(row.backends_order as string) : [],
      isActive: row.is_active === 1,
    };
  }
  stmt.free();
  return null;
}

export function getAllRoutingRules(): RoutingRule[] {
  const stmt = getDatabase().prepare('SELECT * FROM routing_rules ORDER BY id DESC');
  const results: RoutingRule[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      name: row.name as string,
      strategy: row.strategy as 'fixed' | 'random' | 'failover',
      activeBackendId: row.active_backend_id as string | null,
      backendsOrder: row.backends_order ? JSON.parse(row.backends_order as string) : [],
      isActive: row.is_active === 1,
    });
  }
  stmt.free();
  return results;
}

export function createRoutingRule(rule: Omit<RoutingRule, 'id'>): RoutingRule {
  const newRule: RoutingRule = {
    ...rule,
    id: uuidv4(),
  };
  const now = new Date().toISOString();
  
  getDatabase().run(
    `INSERT INTO routing_rules (id, name, strategy, active_backend_id, backends_order, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newRule.id,
      newRule.name,
      newRule.strategy,
      newRule.activeBackendId,
      JSON.stringify(newRule.backendsOrder),
      newRule.isActive ? 1 : 0,
      now,
    ]
  );
  
  saveDatabase();
  return newRule;
}

export function updateRoutingRule(id: string, updates: Partial<Omit<RoutingRule, 'id'>>): RoutingRule | null {
  const stmt = getDatabase().prepare('SELECT * FROM routing_rules WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const existing = stmt.getAsObject();
  stmt.free();
  
  const updated = {
    id,
    name: updates.name ?? (existing.name as string),
    strategy: updates.strategy ?? (existing.strategy as 'fixed' | 'random' | 'failover'),
    activeBackendId: updates.activeBackendId ?? (existing.active_backend_id as string | null),
    backendsOrder: updates.backendsOrder ?? (existing.backends_order ? JSON.parse(existing.backends_order as string) : []),
    isActive: updates.isActive ?? (existing.is_active === 1),
  };
  
  getDatabase().run(
    `UPDATE routing_rules 
     SET name = ?, strategy = ?, active_backend_id = ?, backends_order = ?, is_active = ?
     WHERE id = ?`,
    [
      updated.name,
      updated.strategy,
      updated.activeBackendId,
      JSON.stringify(updated.backendsOrder),
      updated.isActive ? 1 : 0,
      id,
    ]
  );
  
  saveDatabase();
  return updated;
}

export function setActiveRoutingRule(id: string): void {
  getDatabase().run('UPDATE routing_rules SET is_active = 0');
  getDatabase().run('UPDATE routing_rules SET is_active = 1 WHERE id = ?', [id]);
  saveDatabase();
}

// ========== 统计操作 ==========

export function saveRequestStat(stat: Omit<RequestStat, 'id'>): RequestStat {
  const newStat: RequestStat = {
    ...stat,
    id: uuidv4(),
  };
  
  getDatabase().run(
    `INSERT INTO request_stats (id, backend_id, timestamp, input_tokens, output_tokens, ttft_ms, avg_speed, total_time_ms, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newStat.id,
      newStat.backendId,
      newStat.timestamp,
      newStat.inputTokens,
      newStat.outputTokens,
      newStat.ttftMs,
      newStat.avgSpeed,
      newStat.totalTimeMs,
      newStat.success ? 1 : 0,
      newStat.errorMessage || null,
    ]
  );
  
  saveDatabase();
  return newStat;
}

export function getBackendStats(backendId: string): BackendStats | null {
  const backend = getBackendById(backendId);
  if (!backend) return null;
  
  // 获取最后一次请求统计
  const lastStmt = getDatabase().prepare(
    `SELECT * FROM request_stats WHERE backend_id = ? ORDER BY timestamp DESC LIMIT 1`
  );
  lastStmt.bind([backendId]);
  let lastStat: Record<string, unknown> | null = null;
  if (lastStmt.step()) {
    lastStat = lastStmt.getAsObject();
  }
  lastStmt.free();
  
  // 获取总计统计
  const countStmt = getDatabase().prepare(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_count
    FROM request_stats WHERE backend_id = ?`
  );
  countStmt.bind([backendId]);
  let counts: Record<string, unknown> = { total: 0, success_count: 0, failed_count: 0 };
  if (countStmt.step()) {
    counts = countStmt.getAsObject();
  }
  countStmt.free();
  
  return {
    backendId,
    backendName: backend.name,
    lastUsed: (lastStat?.timestamp as string) || '',
    inputTokens: (lastStat?.input_tokens as number) || 0,
    outputTokens: (lastStat?.output_tokens as number) || 0,
    ttftMs: (lastStat?.ttft_ms as number) || 0,
    avgSpeed: (lastStat?.avg_speed as number) || 0,
    totalRequests: (counts?.total as number) || 0,
    successRequests: (counts?.success_count as number) || 0,
    failedRequests: (counts?.failed_count as number) || 0,
  };
}

export function getAllBackendStats(): BackendStats[] {
  const backends = getAllBackends();
  return backends.map(b => getBackendStats(b.id)).filter((s): s is BackendStats => s !== null);
}

export function getRecentStats(limit: number = 100): RequestStat[] {
  const stmt = getDatabase().prepare(
    `SELECT * FROM request_stats ORDER BY timestamp DESC LIMIT ?`
  );
  stmt.bind([limit]);
  const results: RequestStat[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      backendId: row.backend_id as string,
      timestamp: row.timestamp as string,
      inputTokens: row.input_tokens as number,
      outputTokens: row.output_tokens as number,
      ttftMs: row.ttft_ms as number,
      avgSpeed: row.avg_speed as number,
      totalTimeMs: row.total_time_ms as number,
      success: row.success === 1,
      errorMessage: row.error_message as string | undefined,
    });
  }
  stmt.free();
  return results;
}

// 初始化默认路由规则（如果没有）
export function initDefaultRoutingRule(): void {
  const rules = getAllRoutingRules();
  if (rules.length === 0) {
    createRoutingRule({
      name: '默认规则',
      strategy: 'random',
      activeBackendId: null,
      backendsOrder: [],
      isActive: true,
    });
  }
}

// ========== 设置操作 ==========

export function getSetting(key: string, defaultValue: string = ''): string {
  const stmt = getDatabase().prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row.value as string || defaultValue;
  }
  stmt.free();
  return defaultValue;
}

export function setSetting(key: string, value: string): void {
  getDatabase().run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
  saveDatabase();
}

// 获取保存的端口
export function getSavedPort(): number {
  const portStr = getSetting('server_port', '8765');
  const port = parseInt(portStr, 10);
  return isNaN(port) ? 8765 : port;
}

// 保存端口
export function savePort(port: number): void {
  setSetting('server_port', port.toString());
}