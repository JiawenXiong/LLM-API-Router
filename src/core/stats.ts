import type { BackendStats, RequestStat } from './types';
import { getAllBackendStats, getRecentStats } from './database';

// 获取所有后端的最新统计
export function getStats(): BackendStats[] {
  return getAllBackendStats();
}

// 获取最近的请求日志
export function getRecentLogs(limit: number = 100): RequestStat[] {
  return getRecentStats(limit);
}

// 计算总体统计
export function getOverallStats(): {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTtft: number;
  avgSpeed: number;
} {
  const stats = getAllBackendStats();
  
  const totalRequests = stats.reduce((sum, s) => sum + s.totalRequests, 0);
  const totalInputTokens = stats.reduce((sum, s) => sum + s.inputTokens, 0);
  const totalOutputTokens = stats.reduce((sum, s) => sum + s.outputTokens, 0);
  
  const validTtfts = stats.filter(s => s.ttftMs > 0);
  const avgTtft = validTtfts.length > 0 
    ? validTtfts.reduce((sum, s) => sum + s.ttftMs, 0) / validTtfts.length 
    : 0;
  
  const validSpeeds = stats.filter(s => s.avgSpeed > 0);
  const avgSpeed = validSpeeds.length > 0 
    ? validSpeeds.reduce((sum, s) => sum + s.avgSpeed, 0) / validSpeeds.length 
    : 0;
  
  return {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    avgTtft,
    avgSpeed,
  };
}
