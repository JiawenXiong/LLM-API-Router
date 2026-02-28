import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Typography, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  ApiOutlined,
  SettingOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Backends from './pages/Backends';
import Routing from './pages/Routing';
import Logs from './pages/Logs';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState<{ isRunning: boolean; port: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 获取服务器状态
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await window.electronAPI.getServerStatus();
        setServerStatus(status);
      } catch (error) {
        console.error('获取服务器状态失败:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: 'backends',
      icon: <ApiOutlined />,
      label: '后端管理',
    },
    {
      key: 'routing',
      icon: <SettingOutlined />,
      label: '路由策略',
    },
    {
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '请求日志',
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'backends':
        return <Backends />;
      case 'routing':
        return <Routing />;
      case 'logs':
        return <Logs />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <ApiOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          {!collapsed && (
            <Title level={5} style={{ margin: '0 0 0 8px', whiteSpace: 'nowrap' }}>
              API 路由器
            </Title>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={(e) => setCurrentPage(e.key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <Title level={4} style={{ margin: 0 }}>
            {menuItems.find(item => item.key === currentPage)?.label}
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {serverStatus && (
              <Tooltip title={`API 地址: http://localhost:${serverStatus.port}`}>
                <Badge 
                  status={serverStatus.isRunning ? 'success' : 'error'} 
                  text={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {serverStatus.isRunning ? (
                        <><CheckCircleOutlined style={{ color: '#52c41a' }} /> 服务运行中</>
                      ) : (
                        <><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 服务已停止</>
                      )}
                    </span>
                  }
                />
              </Tooltip>
            )}
          </div>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
        }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
