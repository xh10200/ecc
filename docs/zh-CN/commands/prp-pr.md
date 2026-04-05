---
description: 从当前分支中创建 GitHub PR，自动发现模板、分析变更并推送未提交到远端的提交
argument-hint: [base-branch]（默认：main）
---

# 创建 Pull Request

> 改编自 Wirasm 的 PRPs-agentic-eng。属于 PRP 工作流系列的一部分。

**输入**：`$ARGUMENTS`，可选；可以包含基准分支名和/或标志位（如 `--draft`）。

**解析 `$ARGUMENTS`**：

- 提取可识别的 flag（例如 `--draft`）
- 其余非 flag 文本视为 base branch 名
- 如果没有提供，则默认 base branch 为 `main`

---

## 阶段 1 — 校验

检查前置条件：

```bash
git branch --show-current
git status --short
git log origin/<base>..HEAD --oneline
```

| 检查项 | 条件 | 失败时动作 |
|---|---|---|
| 当前不在基准分支 | 当前分支 ≠ base | 停止：`先切到功能分支再创建 PR。` |
| 工作目录干净 | 没有未提交修改 | 警告：`你还有未提交更改。请先 commit 或 stash。可用 /prp-commit 提交。` |
| 存在领先提交 | `git log origin/<base>..HEAD` 非空 | 停止：`当前分支没有领先 <base> 的提交，无法创建 PR。` |
| 不存在已有 PR | `gh pr list --head <branch> --json number` 为空 | 停止：`PR 已存在：#<number>。请使用 gh pr view <number> --web 打开。` |

所有检查通过后再继续。

---

## 阶段 2 — 发现

### PR 模板

按以下顺序查找 PR 模板：

1. `.github/PULL_REQUEST_TEMPLATE/` 目录
   - 如果存在多个文件，列出来让用户选择；否则优先 `default.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `.github/pull_request_template.md`
4. `docs/pull_request_template.md`

如果找到模板，则读取内容，并按该结构填充 PR 正文。

### 提交分析

```bash
git log origin/<base>..HEAD --format="%h %s" --reverse
```

分析提交以确定：

- **PR 标题**：使用 conventional commit 格式，例如 `feat: ...`、`fix: ...`
  - 如果有多种类型，选占比最高的类型
  - 如果只有一个提交，直接沿用该提交标题
- **变更摘要**：按类型 / 领域对提交分组

### 文件分析

```bash
git diff origin/<base>..HEAD --stat
git diff origin/<base>..HEAD --name-only
```

把变更文件按类型分类：源代码、测试、文档、配置、迁移等。

### PRP 产物

检查是否存在相关 PRP 工件：

- `.claude/PRPs/reports/` — 实施报告
- `.claude/PRPs/plans/` — 执行过的计划
- `.claude/PRPs/prds/` — 关联 PRD

如果存在，就在 PR 正文中引用。

---

## 阶段 3 — 推送

```bash
git push -u origin HEAD
```

如果因分支分叉导致推送失败：

```bash
git fetch origin
git rebase origin/<base>
git push -u origin HEAD
```

如果 rebase 发生冲突，停止并通知用户处理。

---

## 阶段 4 — 创建

### 使用模板时

如果在阶段 2 找到了 PR 模板，就按模板逐段填充。保留模板中的全部小节；对不适用的内容写 `N/A`，不要直接删掉。

### 没有模板时

使用以下默认格式：

```markdown
## Summary

<用 1-2 句话说明这个 PR 做了什么、为什么要做>

## Changes

<按领域分组列出变更点>

## Files Changed

<表格或列表，列出变更文件及变更类型：Added / Modified / Deleted>

## Testing

<说明如何测试；如果还没测，写 "Needs testing">

## Related Issues

<Closes/Fixes/Relates to #N，或写 "None">
```

### 创建 PR

```bash
gh pr create \
  --title "<PR title>" \
  --base <base-branch> \
  --body "<PR body>"
  # 如果从 $ARGUMENTS 中解析到了 --draft，则补上 --draft
```

---

## 阶段 5 — 验证

```bash
gh pr view --json number,url,title,state,baseRefName,headRefName,additions,deletions,changedFiles
gh pr checks --json name,status,conclusion 2>/dev/null || true
```

---

## 阶段 6 — 输出

向用户汇报：

```text
PR #<number>: <title>
URL: <url>
Branch: <head> → <base>
Changes: +<additions> -<deletions> across <changedFiles> files

CI Checks: <status summary or "pending" or "none configured">

Artifacts referenced:
  - <在 PR 正文中引用的任何 PRP 报告 / 计划>

Next steps:
  - gh pr view <number> --web   → 在浏览器中打开
  - /code-review <number>       → 审查这个 PR
  - gh pr merge <number>        → 准备好后合并
```

---

## 边界情况

- **没有安装 `gh` CLI**：停止并提示：
  `GitHub CLI (gh) is required. Install: <https://cli.github.com/>`
- **尚未认证**：停止并提示：
  `Run gh auth login first.`
- **需要强制推送**：如果远端分叉且做过 rebase，使用 `git push --force-with-lease`，绝不要用 `--force`
- **存在多个 PR 模板**：如果 `.github/PULL_REQUEST_TEMPLATE/` 下有多个模板，列出来让用户选择
- **PR 太大（>20 个文件）**：提醒 PR 体量过大，建议按逻辑拆分
