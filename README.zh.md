# FixHive

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.zh.md">中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.nl.md">Nederlands</a>
</p>

> OpenCode 社区错误知识共享系统

FixHive 是一个 OpenCode 插件，可在开发会话期间自动捕获错误，从社区知识库查询解决方案，并与其他开发者共享已解决的错误。

## 功能特性

- **自动错误检测**：自动检测工具输出（bash、edit 等）中的错误
- **云端知识库**：使用语义相似度（pgvector）搜索社区解决方案
- **本地缓存**：基于 SQLite 的本地存储，支持离线访问
- **隐私过滤**：自动过滤敏感数据（API 密钥、路径、电子邮件）
- **实时同步**：错误/解决时立即与云端通信

## 安装

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## 快速开始

添加到 OpenCode 配置文件（`opencode.config.ts`）：

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**完成！** FixHive 默认连接到社区知识库。无需设置环境变量。

## 配置（可选）

自定义行为的环境变量：

```bash
# 使用自己的 Supabase 实例而非社区
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# 启用语义搜索（推荐）
OPENAI_API_KEY=sk-...

# 自定义贡献者 ID（未设置时自动生成）
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `FIXHIVE_SUPABASE_URL` | 社区 DB | Supabase 项目 URL |
| `FIXHIVE_SUPABASE_KEY` | 社区 Key | Supabase anon 密钥 |
| `OPENAI_API_KEY` | 无 | 启用语义相似度搜索 |
| `FIXHIVE_CONTRIBUTOR_ID` | 自动生成 | 唯一贡献者 ID |

## 可用命令

| 命令 | 描述 |
|------|------|
| `fixhive_search` | 搜索错误解决方案知识库 |
| `fixhive_resolve` | 将错误标记为已解决并共享解决方案 |
| `fixhive_list` | 列出当前会话中的错误 |
| `fixhive_vote` | 对解决方案投票（赞/踩） |
| `fixhive_stats` | 查看使用统计 |
| `fixhive_helpful` | 报告解决方案有帮助 |
| `fixhive_report` | 举报不当内容 |

### 示例工作流程

1. **发生错误** → FixHive 自动检测并记录
2. **搜索解决方案** → `fixhive_search "Module not found: react"`
3. **应用修复** → 按照社区解决方案操作
4. **共享解决方案** → `fixhive_resolve <error-id> "安装缺失的依赖"`

## 自托管设置（可选）

如果使用默认社区知识库，请跳过此部分。

运行自己的 FixHive 后端：

1. 创建新的 Supabase 项目（免费版可用）
2. 在 SQL 编辑器中运行设置脚本：

```bash
cat scripts/setup-supabase.sql | pbcopy
# 粘贴到 Supabase SQL 编辑器
```

3. 从 Settings > API 获取项目 URL 和 anon key
4. 设置环境变量：

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## 架构

```
FixHive Plugin
├── Error Detection（tool.execute.after 钩子）
├── Privacy Filter（过滤敏感数据）
├── Local Storage（SQLite）
│   ├── error_records
│   └── query_cache
└── Cloud Client（Supabase + pgvector）
    ├── knowledge_entries
    └── usage_logs
```

## 隐私保护

FixHive 自动过滤敏感信息：

- API 密钥（OpenAI、GitHub、AWS、Stripe 等）
- JWT 令牌和 Bearer 令牌
- 电子邮件地址
- 文件路径（替换为 `~` 或 `<PROJECT>`）
- 包含敏感名称的环境变量
- 数据库连接字符串
- IP 地址（localhost 除外）

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 监视模式
npm run dev

# 类型检查
npm run typecheck

# 运行测试
npm test
```

## 许可证

MIT

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request
