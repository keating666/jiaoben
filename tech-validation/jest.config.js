module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'scripts/**/*.ts',
    'utils/**/*.ts',
    'interfaces/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',           // 控制台输出
    'text-summary',   // 简洁摘要
    'lcov',          // 用于 Codecov 等服务
    'html',          // HTML 报告
    'json',          // JSON 格式
    'cobertura'      // XML 格式，用于某些 CI 系统
  ],
  // 覆盖率阈值 - 基于当前代码库的实际情况设置可达到的目标
  coverageThreshold: {
    global: {
      branches: 20,     // CI 显示 24.27%，设为 20%
      functions: 30,    // CI 显示 34.84%，设为 30%
      lines: 35,        // CI 显示 40.45%，设为 35%
      statements: 35    // CI 显示 39.56%，设为 35%
    },
    // 核心文件设置特定阈值
    './utils/api-client.ts': {
      branches: 30,     // 当前 32%
      functions: 45,    // 当前 47.82%
      lines: 50,        // 当前 53.44%
      statements: 50    // 当前 55%
    },
    './utils/circuit-breaker.ts': {
      branches: 85,     // 当前 88.88%
      functions: 80,    // 当前 84.61%
      lines: 85,        // 当前 91.3%
      statements: 85    // 当前 89.58%
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  // 配置变换器
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'js', 'json'],
  // 忽略变换的模块
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};