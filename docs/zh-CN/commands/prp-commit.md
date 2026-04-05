---
description: 使用自然语言描述要提交的文件范围，并快速生成提交
argument-hint: [目标描述]（留空 = 提交全部变更）
---

# 智能提交

> 改编自 Wirasm 的 PRPs-agentic-eng。属于 PRP 工作流系列的一部分。

**输入**：`$ARGUMENTS`

---

## 阶段 1 — 评估

```bash
git status --short
```

如果输出为空，则停止并提示：
`Nothing to commit.`

向用户展示当前变更摘要：新增、修改、删除、未跟踪文件。

---

## 阶段 2 — 解释输入并暂存

根据 `$ARGUMENTS` 判断应该暂存哪些内容：

| 输入 | 解释 | Git 命令 |
|---|---|---|
| *(空白 / 留空)* | 暂存全部变更 | `git add -A` |
| `staged` | 只使用当前已暂存内容 | *(不执行 git add)* |
| `*.ts` 或 `*.py` 等 | 按 glob 暂存匹配文件 | `git add '*.ts'` |
| `except tests` | 先暂存全部，再取消测试文件 | `git add -A && git reset -- '**/*.test.*' '**/*.spec.*' '**/test_*' 2>/dev/null \|\| true` |
| `only new files` | 只暂存未跟踪文件 | `git ls-files --others --exclude-standard \| grep . && git ls-files --others --exclude-standard \| xargs git add` |
| `the auth changes` | 从 status / diff 中识别与 auth 相关的文件 | `git add <matched files>` |
| 明确文件名 | 暂存这些文件 | `git add <files>` |

对于自然语言输入（例如 “the auth changes”），结合 `git status` 与 `git diff` 来推断相关文件，并向用户说明为什么要暂存这些文件。

```bash
git add <determined files>
```

暂存完成后，验证：

```bash
git diff --cached --stat
```

如果没有任何内容被暂存，则停止并提示：
`No files matched your description.`

---

## 阶段 3 — 提交

生成一条使用祈使语气的单行提交信息：

```text
{type}: {description}
```

类型说明：

- `feat` — 新功能或新能力
- `fix` — Bug 修复
- `refactor` — 不改变行为的代码重组
- `docs` — 文档变更
- `test` — 新增或更新测试
- `chore` — 构建、配置、依赖类变更
- `perf` — 性能优化
- `ci` — CI/CD 相关变更

规则：

- 使用祈使句（例如 “add feature”，不要用 “added feature”）
- 类型前缀之后全部小写
- 结尾不加句号
- 长度不超过 72 个字符
- 描述 **改了什么**，而不是 **怎么改的**

```bash
git commit -m "{type}: {description}"
```

---

## 阶段 4 — 输出

向用户汇报：

```text
Committed: {hash_short}
Message:   {type}: {description}
Files:     {count} file(s) changed

Next steps:
  - git push           → 推送到远端
  - /prp-pr            → 创建 Pull Request
  - /code-review       → 推送前先审查
```

---

## 示例

| 你的输入 | 会发生什么 |
|---|---|
| `/prp-commit` | 暂存全部变更，并自动生成提交信息 |
| `/prp-commit staged` | 只提交当前已暂存内容 |
| `/prp-commit *.ts` | 暂存所有 TypeScript 文件并提交 |
| `/prp-commit except tests` | 暂存全部，但排除测试文件 |
| `/prp-commit the database migration` | 识别数据库迁移相关文件并暂存 |
| `/prp-commit only new files` | 只暂存未跟踪文件 |
