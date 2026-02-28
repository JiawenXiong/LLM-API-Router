import type { Backend, RoutingRule, RoutingStrategy } from './types';
import { getAllBackends, getBackendById, getActiveRoutingRule } from './database';

// 获取启用的后端列表
export function getEnabledBackends(): Backend[] {
  return getAllBackends().filter(b => b.isEnabled);
}

// 固定模式：返回指定的后端
function fixedRoute(backendId: string): Backend | null {
  return getBackendById(backendId);
}

// 随机模式：从启用后端中随机选择
function randomRoute(): Backend | null {
  const backends = getEnabledBackends();
  if (backends.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * backends.length);
  return backends[randomIndex];
}

// 故障切换模式：按优先级顺序尝试
function failoverRoute(backendsOrder: string[]): Backend | null {
  const enabledBackends = getEnabledBackends();
  const enabledIds = new Set(enabledBackends.map(b => b.id));
  
  // 按配置顺序查找第一个可用的后端
  for (const id of backendsOrder) {
    if (enabledIds.has(id)) {
      const backend = getBackendById(id);
      if (backend && backend.isEnabled) {
        return backend;
      }
    }
  }
  
  // 如果配置顺序中没有可用的，则选择优先级最高的可用后端
  const sortedBackends = enabledBackends.sort((a, b) => a.priority - b.priority);
  return sortedBackends.length > 0 ? sortedBackends[0] : null;
}

// 主路由函数：根据当前活动的路由规则选择后端
export function selectBackend(): Backend | null {
  const rule = getActiveRoutingRule();
  
  // 如果没有配置规则，使用随机模式
  if (!rule) {
    return randomRoute();
  }
  
  return selectBackendByRule(rule);
}

// 根据指定规则选择后端
export function selectBackendByRule(rule: RoutingRule): Backend | null {
  switch (rule.strategy) {
    case 'fixed':
      if (!rule.activeBackendId) return null;
      return fixedRoute(rule.activeBackendId);
    
    case 'random':
      return randomRoute();
    
    case 'failover':
      return failoverRoute(rule.backendsOrder);
    
    default:
      return randomRoute();
  }
}

// 故障切换：当某个后端失败时，尝试下一个可用的后端
export function getNextBackendForFailover(failedBackendId: string, rule: RoutingRule): Backend | null {
  if (rule.strategy !== 'failover') {
    // 非故障切换模式，直接使用随机
    return randomRoute();
  }
  
  const order = rule.backendsOrder;
  const failedIndex = order.indexOf(failedBackendId);
  
  // 从失败的后端之后开始查找
  for (let i = failedIndex + 1; i < order.length; i++) {
    const backend = getBackendById(order[i]);
    if (backend && backend.isEnabled) {
      return backend;
    }
  }
  
  // 如果后面没有可用的，尝试从开头查找
  for (let i = 0; i < failedIndex; i++) {
    const backend = getBackendById(order[i]);
    if (backend && backend.isEnabled) {
      return backend;
    }
  }
  
  return null;
}

// 获取路由策略显示名称
export function getStrategyDisplayName(strategy: RoutingStrategy): string {
  const names: Record<RoutingStrategy, string> = {
    fixed: '固定模式',
    random: '负载均衡',
    failover: '故障切换',
  };
  return names[strategy];
}
