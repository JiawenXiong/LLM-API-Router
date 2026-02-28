import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Empty, Badge, Tooltip, Space, Button, Card } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  ReloadOutlined,
  ApiOutlined
} from '@ant-design/icons';
import type { RequestStat, Backend } from '../../core/types';

const { Text } = Typography;

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<RequestStat[]>([]);
  const [backends, setBackends] = useState<Backend[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取后端名称映射
  const getBackendName = (backendId: string) => {
    const backend = backends.find(b => b.id === backendId);
    return backend?.name || backendId;
  };

  // 加载日志
  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsData, backendsData] = await Promise.all([
        window.electronAPI.getRecentStats(200),
        window.electronAPI.getBackends(),
      ]);
      setLogs(logsData as RequestStat[]);
      setBackends(backendsData as Backend[]);
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // 每 10 秒刷新一次
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <Text style={{ fontSize: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {new Date(timestamp).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '后端',
      dataIndex: 'backendId',
      key: 'backendId',
      render: (backendId: string) => (
        <Tag icon={<ApiOutlined />} color="blue">
          {getBackendName(backendId)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 100,
      render: (success: boolean) => (
        success ? (
          <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
        ) : (
          <Tooltip title="失败">
            <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
          </Tooltip>
        )
      ),
    },
    {
      title: '输入 Tokens',
      dataIndex: 'inputTokens',
      key: 'inputTokens',
      width: 120,
      render: (tokens: number) => tokens?.toLocaleString() || '-',
    },
    {
      title: '输出 Tokens',
      dataIndex: 'outputTokens',
      key: 'outputTokens',
      width: 120,
      render: (tokens: number) => tokens?.toLocaleString() || '-',
    },
    {
      title: '首Token延迟',
      dataIndex: 'ttftMs',
      key: 'ttftMs',
      width: 120,
      render: (ms: number) => {
        if (!ms) return '-';
        const color = ms < 500 ? 'success' : ms < 1000 ? 'warning' : 'error';
        return <Badge status={color} text={`${ms}ms`} />;
      },
    },
    {
      title: '输出速度',
      dataIndex: 'avgSpeed',
      key: 'avgSpeed',
      width: 120,
      render: (speed: number) => {
        if (!speed) return '-';
        return `${speed.toFixed(1)} tok/s`;
      },
    },
    {
      title: '总耗时',
      dataIndex: 'totalTimeMs',
      key: 'totalTimeMs',
      width: 100,
      render: (ms: number) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
      },
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (msg: string) => msg ? (
        <Tooltip title={msg}>
          <Text type="danger" style={{ fontSize: 12 }}>{msg}</Text>
        </Tooltip>
      ) : '-',
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">显示最近 200 条请求记录</Text>
          <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
            刷新
          </Button>
        </div>

        {logs.length > 0 ? (
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            size="small"
          />
        ) : (
          <Empty description="暂无请求记录" />
        )}
      </Card>
    </div>
  );
};

export default Logs;
