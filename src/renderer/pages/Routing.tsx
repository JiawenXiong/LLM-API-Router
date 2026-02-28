import React, { useState, useEffect } from 'react';
import {
  Card, Radio, Table, Button, Modal, Form, Input, Select, Tag, Space,
  Typography, message, Alert, Divider
} from 'antd';
import {
  SettingOutlined, ThunderboltOutlined, SwapOutlined,
  SafetyOutlined, PlusOutlined, EditOutlined
} from '@ant-design/icons';
import type { RoutingRule, RoutingStrategy, Backend } from '../../core/types';

const { Title, Text, Paragraph } = Typography;

const strategyInfo: Record<RoutingStrategy, { icon: React.ReactNode; name: string; desc: string }> = {
  fixed: {
    icon: <SettingOutlined />,
    name: '固定模式',
    desc: '始终使用指定的后端服务',
  },
  random: {
    icon: <SwapOutlined />,
    name: '负载均衡',
    desc: '每次请求随机选择一个可用后端',
  },
  failover: {
    icon: <SafetyOutlined />,
    name: '故障切换',
    desc: '按优先级顺序使用，失败时自动切换到下一个',
  },
};

const Routing: React.FC = () => {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [activeRule, setActiveRule] = useState<RoutingRule | null>(null);
  const [backends, setBackends] = useState<Backend[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [form] = Form.useForm();

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, activeData, backendsData] = await Promise.all([
        window.electronAPI.getRoutingRules(),
        window.electronAPI.getActiveRoutingRule(),
        window.electronAPI.getBackends(),
      ]);
      setRules(rulesData as RoutingRule[]);
      setActiveRule(activeData as RoutingRule);
      setBackends(backendsData as Backend[]);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 切换路由策略
  const handleStrategyChange = async (strategy: RoutingStrategy) => {
    if (!activeRule) return;
    
    try {
      await window.electronAPI.updateRoutingRule(activeRule.id, { strategy });
      message.success('路由策略已更新');
      loadData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 设置固定模式的后端
  const handleFixedBackendChange = async (backendId: string) => {
    if (!activeRule) return;
    
    try {
      await window.electronAPI.updateRoutingRule(activeRule.id, { 
        strategy: 'fixed',
        activeBackendId: backendId 
      });
      message.success('已设置固定后端');
      loadData();
    } catch (error) {
      message.error('设置失败');
    }
  };

  // 设置故障切换顺序
  const handleFailoverOrderChange = async (order: string[]) => {
    if (!activeRule) return;
    
    try {
      await window.electronAPI.updateRoutingRule(activeRule.id, { 
        strategy: 'failover',
        backendsOrder: order 
      });
      message.success('故障切换顺序已更新');
      loadData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 激活规则
  const handleActivate = async (ruleId: string) => {
    try {
      await window.electronAPI.setActiveRoutingRule(ruleId);
      message.success('规则已激活');
      loadData();
    } catch (error) {
      message.error('激活失败');
    }
  };

  // 保存规则
  const handleSaveRule = async () => {
    try {
      const values = await form.validateFields();
      if (editingRule) {
        await window.electronAPI.updateRoutingRule(editingRule.id, values);
        message.success('更新成功');
      } else {
        const newRule = await window.electronAPI.createRoutingRule(values);
        // 自动激活新规则
        await window.electronAPI.setActiveRoutingRule((newRule as RoutingRule).id);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 打开编辑弹窗
  const openEditModal = (rule: RoutingRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setModalVisible(true);
  };

  const enabledBackends = backends.filter(b => b.isEnabled);

  return (
    <div>
      {/* 当前策略选择 */}
      <Card title="当前路由策略" style={{ marginBottom: 24 }}>
        {activeRule ? (
          <>
            <Radio.Group
              value={activeRule.strategy}
              onChange={(e) => handleStrategyChange(e.target.value)}
              style={{ marginBottom: 16 }}
            >
              {(Object.keys(strategyInfo) as RoutingStrategy[]).map(key => (
                <Radio.Button key={key} value={key}>
                  {strategyInfo[key].icon} {strategyInfo[key].name}
                </Radio.Button>
              ))}
            </Radio.Group>

            <Paragraph type="secondary">
              {strategyInfo[activeRule.strategy].desc}
            </Paragraph>

            <Divider />

            {/* 固定模式配置 */}
            {activeRule.strategy === 'fixed' && (
              <div>
                <Text strong>选择固定后端：</Text>
                <Select
                  value={activeRule.activeBackendId || undefined}
                  onChange={handleFixedBackendChange}
                  style={{ width: 300, marginLeft: 16 }}
                  placeholder="选择一个后端"
                >
                  {enabledBackends.map(b => (
                    <Select.Option key={b.id} value={b.id}>
                      {b.name} ({b.model})
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}

            {/* 故障切换配置 */}
            {activeRule.strategy === 'failover' && (
              <div>
                <Text strong>设置故障切换顺序（拖拽排序）：</Text>
                <div style={{ marginTop: 16 }}>
                  <Select
                    mode="multiple"
                    value={activeRule.backendsOrder}
                    onChange={handleFailoverOrderChange}
                    style={{ width: '100%' }}
                    placeholder="按优先级选择后端顺序"
                  >
                    {enabledBackends.map(b => (
                      <Select.Option key={b.id} value={b.id}>
                        {b.name} ({b.model}) - 优先级 {b.priority}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  当首选后端失败时，将自动尝试列表中的下一个后端
                </Paragraph>
              </div>
            )}

            {/* 负载均衡提示 */}
            {activeRule.strategy === 'random' && (
              <Alert
                message="负载均衡已启用"
                description="每次请求将随机分配到所有启用的后端，实现负载均衡。"
                type="info"
                showIcon
              />
            )}
          </>
        ) : (
          <Alert
            message="未配置路由规则"
            description="请创建并激活一个路由规则"
            type="warning"
            showIcon
          />
        )}
      </Card>

      {/* 规则列表 */}
      <Card 
        title="路由规则列表"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRule(null);
              form.resetFields();
              form.setFieldsValue({ strategy: 'random', isActive: true });
              setModalVisible(true);
            }}
          >
            新建规则
          </Button>
        }
      >
        <Table
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            {
              title: '规则名称',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '策略',
              dataIndex: 'strategy',
              key: 'strategy',
              render: (strategy: RoutingStrategy) => (
                <Tag color={strategy === 'fixed' ? 'blue' : strategy === 'random' ? 'green' : 'orange'}>
                  {strategyInfo[strategy].name}
                </Tag>
              ),
            },
            {
              title: '状态',
              dataIndex: 'isActive',
              key: 'isActive',
              render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                  {isActive ? '活动' : '未激活'}
                </Tag>
              ),
            },
            {
              title: '操作',
              key: 'action',
              render: (_: unknown, record: RoutingRule) => (
                <Space>
                  <Button 
                    type="link" 
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  >
                    编辑
                  </Button>
                  {!record.isActive && (
                    <Button 
                      type="link" 
                      onClick={() => handleActivate(record.id)}
                    >
                      激活
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑规则弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalVisible}
        onOk={handleSaveRule}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：生产环境规则" />
          </Form.Item>

          <Form.Item
            name="strategy"
            label="路由策略"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="fixed">固定模式</Select.Option>
              <Select.Option value="random">负载均衡</Select.Option>
              <Select.Option value="failover">故障切换</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Routing;
