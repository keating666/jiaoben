'use client'

import { Card, Col, Row, Statistic, Typography, Space, Tag, Divider, ConfigProvider } from 'antd'
import {
  DashboardOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'

const { Title, Paragraph, Text } = Typography

const features = [
  {
    icon: <VideoCameraOutlined style={{ fontSize: 24 }} />,
    title: '视频管理',
    description: '管理和审核用户上传的视频内容',
  },
  {
    icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    title: '脚本管理',
    description: '查看和管理生成的脚本内容',
  },
  {
    icon: <UserOutlined style={{ fontSize: 24 }} />,
    title: '用户管理',
    description: '管理用户账号和权限设置',
  },
  {
    icon: <SettingOutlined style={{ fontSize: 24 }} />,
    title: '系统配置',
    description: 'API 配置和系统参数设置',
  },
]

export default function AdminHome() {
  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" size="small">
                <Space align="center">
                  <DashboardOutlined style={{ fontSize: 32, color: '#1677ff' }} />
                  <Title level={2} style={{ margin: 0 }}>
                    脚本仿写助手 - 管理后台
                  </Title>
                </Space>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  AI 驱动的短视频脚本创作平台管理系统
                </Paragraph>
                <Space>
                  <Tag color="blue">v0.1.0-alpha</Tag>
                  <Tag color="green">管理端</Tag>
                </Space>
              </Space>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="总视频数"
                    value={0}
                    prefix={<VideoCameraOutlined />}
                    suffix="个"
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="生成脚本"
                    value={0}
                    prefix={<FileTextOutlined />}
                    suffix="篇"
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="注册用户"
                    value={0}
                    prefix={<UserOutlined />}
                    suffix="人"
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="API 调用"
                    value={0}
                    prefix={<RocketOutlined />}
                    suffix="次"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="功能模块">
              <Row gutter={[16, 16]}>
                {features.map((feature, index) => (
                  <Col xs={24} sm={12} md={6} key={index}>
                    <Card
                      hoverable
                      style={{ textAlign: 'center', height: '100%' }}
                    >
                      <Space direction="vertical" size="small">
                        <div style={{ color: '#1677ff' }}>{feature.icon}</div>
                        <Text strong>{feature.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {feature.description}
                        </Text>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>

            <Card>
              <Divider orientation="left">系统状态</Divider>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space>
                      <Tag color="success">在线</Tag>
                      <Text>API 服务</Text>
                    </Space>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space>
                      <Tag color="success">正常</Tag>
                      <Text>数据库连接</Text>
                    </Space>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space>
                      <Tag color="processing">待配置</Tag>
                      <Text>AI 服务</Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Card>

            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Text type="secondary">
                脚本仿写助手 &copy; 2025 - 管理后台
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </ConfigProvider>
  )
}
