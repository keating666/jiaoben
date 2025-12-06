'use client'

import { Layout, Menu, Card, Row, Col, Statistic, Table, Tag, Button } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  KeyOutlined,
  SettingOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useState } from 'react'

const { Header, Sider, Content } = Layout

// 模拟数据
const recentUsers = [
  { key: '1', name: '用户A', phone: '138****1234', status: 'active', created: '2024-01-20' },
  { key: '2', name: '用户B', phone: '139****5678', status: 'active', created: '2024-01-19' },
  { key: '3', name: '用户C', phone: '137****9012', status: 'expired', created: '2024-01-18' },
]

const columns = [
  { title: '用户名', dataIndex: 'name', key: 'name' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={status === 'active' ? 'green' : 'red'}>
        {status === 'active' ? '已激活' : '已过期'}
      </Tag>
    ),
  },
  { title: '注册时间', dataIndex: 'created', key: 'created' },
]

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    { key: '1', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '2', icon: <UserOutlined />, label: '用户管理' },
    { key: '3', icon: <KeyOutlined />, label: '激活码管理' },
    { key: '4', icon: <FileTextOutlined />, label: '脚本记录' },
    { key: '5', icon: <BarChartOutlined />, label: '数据统计' },
    { key: '6', icon: <SettingOutlined />, label: '系统设置' },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold'
        }}>
          {collapsed ? '管理' : '脚本助手管理'}
        </div>
        <Menu
          theme="dark"
          defaultSelectedKeys={['1']}
          mode="inline"
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0 }}>仪表盘</h2>
          <span style={{ color: '#666' }}>管理员</span>
        </Header>

        <Content style={{ margin: '24px 16px', padding: 24 }}>
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="总用户数" value={1128} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="今日活跃" value={93} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="脚本生成数" value={2846} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="未使用激活码" value={56} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
          </Row>

          {/* 快捷操作 */}
          <Card title="快捷操作" style={{ marginBottom: 24 }}>
            <Button type="primary" icon={<KeyOutlined />} style={{ marginRight: 16 }}>
              生成激活码
            </Button>
            <Button icon={<UserOutlined />} style={{ marginRight: 16 }}>
              添加用户
            </Button>
            <Button icon={<BarChartOutlined />}>
              导出报表
            </Button>
          </Card>

          {/* 最近用户 */}
          <Card title="最近注册用户">
            <Table
              columns={columns}
              dataSource={recentUsers}
              pagination={false}
              size="small"
            />
          </Card>

          {/* 版本信息 */}
          <div style={{
            marginTop: 24,
            textAlign: 'center',
            color: '#999',
            fontSize: 12
          }}>
            脚本仿写助手管理后台 v0.1.0-alpha
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
