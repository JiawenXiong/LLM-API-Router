import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, InputNumber, Space,
  Tag, Popconfirm, message, Tooltip, Badge, Typography, Alert, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LinkOutlined, ApiOutlined, SyncOutlined,
  CheckCircleTwoTone, CloseCircleTwoTone, QuestionCircleOutlined,
  CopyOutlined, DownloadOutlined, UploadOutlined
} from '@ant-design/icons';
import type { Backend, ApiType } from '../../core/types';

const { Text } = Typography;

// 智能补全 Base URL
function normalizeBaseUrl(url: string, apiType: ApiType): string {
  if (!url) return url;
  
  // 移除首尾空格
  url = url.trim();
  
  // 如果没有协议，添加 https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    
    // 移除末尾的 /v1/chat/completions、/chat/completions、/v1/messages、/messages
    pathname = pathname
      .replace(/\/v1\/chat\/completions$/i, '')
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/v1\/messages$/i, '')
      .replace(/\/messages$/i, '')
      .replace(/\/v1$/i, '')
      .replace(/\/+$/, ''); // 移除末尾斜杠
    
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return url;
  }
}

// 连接状态渲染
function ConnectionStatus({ status, lastChecked }: { status?: string; lastChecked?: string }) {
  const timeStr = lastChecked ? new Date(lastChecked).toLocaleString('zh-CN') : '未测试';
  
  if (status === 'valid') {
    return (
      <Tooltip title={`连接正常 - ${timeStr}`}>
        <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 16 }} />
      </Tooltip>
    );
  } else if (status === 'invalid') {
    return (
      <Tooltip title={`连接失败 - ${timeStr}`}>
        <CloseCircleTwoTone twoToneColor="#ff4d4f" style={{ fontSize: 16 }} />
      </Tooltip>
    );
  } else {
    return (
      <Tooltip title="未测试">
        <QuestionCircleOutlined style={{ fontSize: 16, color: '#999' }} />
      </Tooltip>
    );
  }
}

const Backends: React.FC = () => {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBackend, setEditingBackend] = useState<Backend | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [form] = Form.useForm();
  
  // 监听 API 类型变化
  const apiType = Form.useWatch('apiType', form);
  const baseUrl = Form.useWatch('baseUrl', form) || '';

  // 加载后端列表
  const loadBackends = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getBackends();
      setBackends(data as Backend[]);
    } catch (error) {
      message.error('加载后端列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackends();
  }, []);

  // 打开新增/编辑弹窗
  const openModal = (backend?: Backend) => {
    setEditingBackend(backend || null);
    if (backend) {
      form.setFieldsValue(backend);
    } else {
      form.resetFields();
      form.setFieldsValue({
        apiType: 'openai',
        isEnabled: true,
        priority: 0,
      });
    }
    setModalVisible(true);
  };

  // 保存后端配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // 标准化 Base URL
      values.baseUrl = normalizeBaseUrl(values.baseUrl, values.apiType);
      
      if (editingBackend) {
        await window.electronAPI.updateBackend(editingBackend.id, values);
        message.success('更新成功');
      } else {
        await window.electronAPI.createBackend(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadBackends();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除后端
  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.deleteBackend(id);
      message.success('删除成功');
      loadBackends();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 基于现有配置复制创建新配置
  const handleDuplicate = (backend: Backend) => {
    setEditingBackend(null); // 不是编辑，是新建
    form.resetFields();
    form.setFieldsValue({
      name: `${backend.name} (副本)`,
      apiType: backend.apiType,
      baseUrl: backend.baseUrl,
      apiKey: backend.apiKey,
      model: backend.model, // 保留模型，用户可以修改
      priority: backend.priority,
      isEnabled: true,
    });
    setModalVisible(true);
  };

  // 测试单个后端连接
  const handleTestSingle = async (backend: Backend) => {
    setTestingIds(prev => new Set(prev).add(backend.id));
    try {
      const result = await window.electronAPI.testBackendConnection(backend);
      const status = result.success ? 'valid' : 'invalid';
      await window.electronAPI.updateBackendStatus(backend.id, status);
      
      if (result.success) {
        message.success(`${backend.name} 连接成功`);
      } else {
        message.error(`${backend.name} 连接失败: ${result.message}`);
      }
      loadBackends();
    } catch (error) {
      message.error('测试失败');
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(backend.id);
        return next;
      });
    }
  };

  // 测试所有后端
  const handleTestAll = async () => {
    const enabledBackends = backends.filter(b => b.isEnabled);
    if (enabledBackends.length === 0) {
      message.warning('没有已启用的后端可测试');
      return;
    }
    
    // 设置所有为测试中
    setTestingIds(new Set(enabledBackends.map(b => b.id)));
    
    const results = await Promise.all(
      enabledBackends.map(async (backend) => {
        try {
          const result = await window.electronAPI.testBackendConnection(backend);
          const status = result.success ? 'valid' : 'invalid';
          await window.electronAPI.updateBackendStatus(backend.id, status);
          return { id: backend.id, success: result.success };
        } catch {
          return { id: backend.id, success: false };
        }
      })
    );
    
    // 清除测试中状态
    setTestingIds(new Set());
    loadBackends();
    
    const successCount = results.filter(r => r.success).length;
    message.success(`测试完成：${successCount}/${enabledBackends.length} 个后端连接正常`);
  };

  // 测试连接（表单内）
  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTestLoading(true);
      const result = await window.electronAPI.testBackendConnection(values);
      if (result.success) {
        message.success('连接成功');
      } else {
        message.error(`连接失败: ${result.message}`);
      }
    } catch (error) {
      message.error('测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 切换启用状态
  const toggleEnabled = async (backend: Backend) => {
    try {
      await window.electronAPI.updateBackend(backend.id, { isEnabled: !backend.isEnabled });
      message.success(backend.isEnabled ? '已禁用' : '已启用');
      loadBackends();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 导出后端配置
  const handleExport = async () => {
    if (backends.length === 0) {
      message.warning('没有后端配置可导出');
      return;
    }
    try {
      const result = await window.electronAPI.exportBackends();
      if (result.success) {
        message.success(result.message);
      } else {
        message.info(result.message);
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 导入后端配置
  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importBackends();
      if (result.success) {
        message.success(result.message);
        loadBackends();
      } else {
        message.info(result.message);
      }
    } catch (error) {
      message.error('导入失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span>
          <ApiOutlined style={{ marginRight: 8 }} />
          {name}
        </span>
      ),
    },
    {
      title: 'API 类型',
      dataIndex: 'apiType',
      key: 'apiType',
      render: (type: ApiType) => (
        <Tag color={type === 'openai' ? 'blue' : 'purple'}>
          {type === 'openai' ? 'OpenAI' : 'Anthropic'}
        </Tag>
      ),
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text code style={{ fontSize: 12 }}>{url}</Text>
        </Tooltip>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (model: string) => <Tag>{model}</Tag>,
    },
    {
      title: '连接状态',
      dataIndex: 'connectionStatus',
      key: 'connectionStatus',
      width: 100,
      render: (status: string, record: Backend) => (
        testingIds.has(record.id) ? (
          <Spin size="small" />
        ) : (
          <ConnectionStatus status={status} lastChecked={record.lastChecked} />
        )
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Badge count={priority} showZero style={{ backgroundColor: '#1890ff' }} />
      ),
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (enabled: boolean, record: Backend) => (
        <Switch
          checked={enabled}
          onChange={() => toggleEnabled(record)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Backend) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={testingIds.has(record.id) ? <SyncOutlined spin /> : <CheckCircleOutlined />}
              onClick={() => handleTestSingle(record)}
              disabled={testingIds.has(record.id)}
            />
          </Tooltip>
          <Tooltip title="复制创建">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record)}
            />
          </Tooltip>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此后端吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">
          配置您的 LLM API 后端，支持 OpenAI 和 Anthropic 格式
        </Typography.Text>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={backends.length === 0}>
            导出配置
          </Button>
          <Button icon={<UploadOutlined />} onClick={handleImport}>
            导入配置
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleTestAll} loading={testingIds.size > 0}>
            测试全部
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            添加后端
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={backends}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingBackend ? '编辑后端' : '添加后端'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={600}
        footer={[
          <Button key="test" onClick={handleTest} loading={testLoading}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSave}>
            保存
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：GPT-4、Claude 3" />
          </Form.Item>

          <Form.Item
            name="apiType"
            label="API 类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="openai">OpenAI 兼容</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label="Base URL"
            rules={[{ required: true, message: '请输入 Base URL' }]}
            extra={
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {apiType === 'openai' 
                    ? '只需填写域名部分，系统会自动添加 /v1/chat/completions' 
                    : '只需填写域名部分，系统会自动添加 /v1/messages'}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  示例：https://api.openai.com 或 https://api.deepseek.com
                </Text>
              </div>
            }
          >
            <Input 
              placeholder="https://api.openai.com" 
              addonBefore={<LinkOutlined />}
              onBlur={(e) => {
                // 用户离开输入框时，标准化 URL 显示
                const normalized = normalizeBaseUrl(e.target.value, apiType);
                if (normalized !== e.target.value && e.target.value) {
                  form.setFieldValue('baseUrl', normalized);
                }
              }}
            />
          </Form.Item>
          
          {baseUrl && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, fontSize: 12 }}
              message={
                <span>
                  完整 API 地址：{normalizeBaseUrl(baseUrl, apiType)}
                  {apiType === 'openai' ? '/v1/chat/completions' : '/v1/messages'}
                </span>
              }
            />
          )}

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Form.Item
            name="model"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：gpt-4、claude-3-opus-20240229" />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            tooltip="数字越小优先级越高，用于故障切换模式"
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="isEnabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Backends;