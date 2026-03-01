import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Typography, Empty, InputNumber, Button, Space, message, Badge } from 'antd';
import {
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BackendStats } from '../../core/types';

const { Title, Text } = Typography;

interface OverallStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTtft: number;
  avgSpeed: number;
}

interface ServerStatus {
  isRunning: boolean;
  port: number;
}

const Dashboard: React.FC = () => {
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [backendStats, setBackendStats] = useState<BackendStats[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [inputPort, setInputPort] = useState(8765);  // 用户输入的端口
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // 获取服务状态
  const fetchServerStatus = async () => {
    try {
      const status = await window.electronAPI.getServerStatus();
      setIsRunning((status as ServerStatus).isRunning);
      // 只在服务运行时更新端口显示
      if ((status as ServerStatus).isRunning) {
        setInputPort((status as ServerStatus).port);
      }
    } catch (error) {
      console.error('获取服务状态失败:', error);
    }
  };

  // 获取统计数据
  const fetchData = async () => {
    try {
      const [overall, backends] = await Promise.all([
        window.electronAPI.getOverallStats(),
        window.electronAPI.getAllBackendStats(),
      ]);
      setOverallStats(overall as OverallStats);
      setBackendStats(backends as BackendStats[]);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化：加载保存的端口
  useEffect(() => {
    const initPort = async () => {
      try {
        const savedPort = await window.electronAPI.getSavedPort();
        setInputPort(savedPort);
      } catch (error) {
        console.error('获取保存的端口失败:', error);
      }
    };
    initPort();
  }, []);

  useEffect(() => {
    fetchServerStatus();
    fetchData();
    const interval = setInterval(() => {
      fetchServerStatus();
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 启动服务
  const handleStartServer = async () => {
    setStarting(true);
    try {
      // 先保存端口设置
      await window.electronAPI.savePort(inputPort);
      
      const result = await window.electronAPI.startServer(inputPort);
      if ((result as { success: boolean; port?: number; error?: string }).success) {
        message.success(`服务已启动在端口 ${(result as { port: number }).port}`);
        fetchServerStatus();
      } else {
        message.error(`启动失败: ${(result as { error?: string }).error || '端口可能被占用'}`);
      }
    } catch (error) {
      message.error('启动服务失败');
    } finally {
      setStarting(false);
    }
  };

  // 停止服务
  const handleStopServer = async () => {
    setStopping(true);
    try {
      await window.electronAPI.stopServer();
      message.success('服务已停止');
      fetchServerStatus();
    } catch (error) {
      message.error('停止服务失败');
    } finally {
      setStopping(false);
    }
  };

  // 获取服务地址
  const serverUrl = isRunning ? `http://localhost:${inputPort}` : '';

  const columns = [
    {
      title: '后端名称',
      dataIndex: 'backendName',
      key: 'backendName',
      render: (name: string) => (
        <span>
          <ApiOutlined style={{ marginRight: 8 }} />
          {name}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: BackendStats) => {
        const successRate = record.totalRequests > 0 
          ? (record.successRequests / record.totalRequests * 100).toFixed(0) 
          : 0;
        return (
          <Tag color={Number(successRate) >= 90 ? 'success' : Number(successRate) >= 70 ? 'warning' : 'error'}>
            成功率 {successRate}%
          </Tag>
        );
      },
    },
    {
      title: '输入 Tokens',
      dataIndex: 'inputTokens',
      key: 'inputTokens',
      render: (tokens: number) => tokens.toLocaleString(),
    },
    {
      title: '输出 Tokens',
      dataIndex: 'outputTokens',
      key: 'outputTokens',
      render: (tokens: number) => tokens.toLocaleString(),
    },
    {
      title: '首Token延迟',
      dataIndex: 'ttftMs',
      key: 'ttftMs',
      render: (ms: number) => ms > 0 ? `${ms}ms` : '-',
    },
    {
      title: '输出速度',
      dataIndex: 'avgSpeed',
      key: 'avgSpeed',
      render: (speed: number) => speed > 0 ? `${speed.toFixed(1)} tok/s` : '-',
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '从未使用',
    },
  ];

  return (
    <div>
      {/* 服务控制卡片 */}
      <Card 
        style={{ marginBottom: 24 }} 
        title={
          <span>
            <SettingOutlined style={{ marginRight: 8 }} />
            服务控制
          </span>
        }
      >
        <Row align="middle" gutter={24}>
          <Col>
            <Space size="large" align="center">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary">端口:</Text>
                <InputNumber
                  min={1024}
                  max={65535}
                  value={inputPort}
                  onChange={(value) => setInputPort(value || 8765)}
                  disabled={isRunning}
                  style={{ width: 100 }}
                />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary">状态:</Text>
                <Badge 
                  status={isRunning ? 'success' : 'default'} 
                  text={isRunning ? '运行中' : '已停止'}
                />
              </span>
              {!isRunning && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartServer}
                  loading={starting}
                >
                  启动服务
                </Button>
              )}
              {isRunning && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStopServer}
                  loading={stopping}
                >
                  停止服务
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* API 地址提示 */}
      <Card 
        style={{ 
          marginBottom: 24, 
          background: isRunning ? '#f6ffed' : '#fff2e8', 
          borderColor: isRunning ? '#b7eb8f' : '#ffbb96' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Badge status={isRunning ? 'success' : 'warning'} />
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {isRunning ? '本地 API 地址' : '服务未启动'}
            </Title>
            {isRunning ? (
              <>
                <Text copyable style={{ fontSize: 16, fontFamily: 'monospace' }}>{serverUrl}/v1/chat/completions</Text>
                <br />
                <Text type="secondary">将您的 LLM 客户端配置为使用此地址即可</Text>
              </>
            ) : (
              <Text type="secondary">请先启动服务，或配置端口后点击「启动服务」</Text>
            )}
          </div>
        </div>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={overallStats?.totalRequests || 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃后端"
              value={backendStats.length}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均首Token延迟"
              value={overallStats?.avgTtft ? overallStats.avgTtft.toFixed(0) : 0}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均输出速度"
              value={overallStats?.avgSpeed ? overallStats.avgSpeed.toFixed(1) : 0}
              suffix="tok/s"
              prefix={<RocketOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Token 使用统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Token 使用统计">
            <Row>
              <Col span={12}>
                <Statistic
                  title="输入 Tokens"
                  value={overallStats?.totalInputTokens || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="输出 Tokens"
                  value={overallStats?.totalOutputTokens || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
            {(overallStats?.totalInputTokens || overallStats?.totalOutputTokens) && (
              <Progress
                percent={
                  ((overallStats?.totalOutputTokens || 0) / 
                    ((overallStats?.totalInputTokens || 0) + (overallStats?.totalOutputTokens || 0))) * 100
                }
                showInfo={false}
                strokeColor="#52c41a"
                trailColor="#1890ff"
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="快速开始">
            <div style={{ lineHeight: 2 }}>
              <p><strong>1. 添加后端：</strong>在「后端管理」中添加您的 LLM API 配置</p>
              <p><strong>2. 配置路由：</strong>在「路由策略」中选择路由模式</p>
              <p><strong>3. 启动服务：</strong>在上方启动本地 API 服务</p>
              <p><strong>4. 使用 API：</strong>将客户端的 API 地址改为上述本地地址</p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 后端状态表格 */}
      <Card title="后端状态">
        {backendStats.length > 0 ? (
          <Table
            columns={columns}
            dataSource={backendStats}
            rowKey="backendId"
            loading={loading}
            pagination={false}
          />
        ) : (
          <Empty description="暂无后端配置，请先添加后端" />
        )}
      </Card>
    </div>
  );
};

export default Dashboard;