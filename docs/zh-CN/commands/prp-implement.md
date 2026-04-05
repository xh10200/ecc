---
description: 通过严格的验证循环执行实施计划
argument-hint: <path/to/plan.md>
---

> 改编自 Wirasm 的 PRPs-agentic-eng。属于 PRP 工作流系列的一部分。

# PRP 实施

按步骤执行计划文件，并持续做验证。每一次改动后都要立刻校验，不要让错误状态不断累积。

**核心理念**：验证循环可以尽早暴露问题。每改一次，就验一次；一旦出错，立即修复。

**黄金法则**：只要验证失败，就先修好再继续。绝不积累“先放着以后再修”的坏状态。

---

## 阶段 0 — 检测

### 包管理器检测

| 存在文件 | 包管理器 | 运行器 |
|---|---|---|
| `bun.lockb` | bun | `bun run` |
| `pnpm-lock.yaml` | pnpm | `pnpm run` |
| `yarn.lock` | yarn | `yarn` |
| `package-lock.json` | npm | `npm run` |
| `pyproject.toml` 或 `requirements.txt` | uv / pip | `uv run` 或 `python -m` |
| `Cargo.toml` | cargo | `cargo` |
| `go.mod` | go | `go` |

### 验证脚本

检查 `package.json`（或对应配置）里可用的脚本：

```bash
# Node.js 项目示例
cat package.json | grep -A 20 '"scripts"'
```

记录以下命令是否存在：type-check、lint、test、build。

---

## 阶段 1 — 加载

读取计划文件：

```bash
cat "$ARGUMENTS"
```

从计划中提取以下部分：

- **Summary**：要构建什么
- **Patterns to Mirror**：需要遵循的代码模式
- **Files to Change**：要创建或修改哪些文件
- **Step-by-Step Tasks**：实施顺序
- **Validation Commands**：如何验证正确性
- **Acceptance Criteria**：完成标准

如果文件不存在或不是合法计划，输出：

```text
Error: Plan file not found or invalid.
Run /prp-plan <feature-description> to create a plan first.
```

**检查点**：计划已加载，所有关键小节已识别，任务已提取。

---

## 阶段 2 — 准备

### Git 状态

```bash
git branch --show-current
git status --porcelain
```

### 分支决策

| 当前状态 | 动作 |
|---|---|
| 当前就在功能分支 | 继续使用当前分支 |
| 在 main，且工作树干净 | 创建功能分支：`git checkout -b feat/{plan-name}` |
| 在 main，但工作树不干净 | **停止**，先让用户 stash 或 commit |
| 在该功能对应的 git worktree 中 | 继续使用该 worktree |

### 同步远端

```bash
git pull --rebase origin $(git branch --show-current) 2>/dev/null || true
```

**检查点**：位于正确分支，工作树准备就绪，远端已同步。

---

## 阶段 3 — 执行

按顺序逐个处理计划中的任务。

### 单任务循环

针对 **Step-by-Step Tasks** 中的每个任务：

1. **读取 MIRROR 参考**：打开该任务 MIRROR 字段指向的模式来源文件，先理解约定再写代码。
2. **实施**：严格遵循对应模式编写代码，注意应用 GOTCHA，按要求导入 IMPORTS。
3. **立即验证**：每次修改文件后立刻执行：

   ```bash
   # 运行类型检查（按项目实际命令替换）
   [type-check command from Phase 0]
   ```

   如果 type-check 失败，就先修复，再进入下一个文件。

4. **跟踪进度**：记录：

   ```text
   [done] Task N: [task name] — complete
   ```

### 处理偏差

如果实现过程中必须偏离原计划：

- 记录 **改了什么**
- 记录 **为什么改**
- 按修正后的方案继续
- 这些偏差最终要写进报告

**检查点**：所有任务已执行，所有偏差均已记录。

---

## 阶段 4 — 验证

按计划中定义的验证层级逐级执行。每一级未通过前，不进入下一级。

### 第 1 级：静态分析

```bash
# 类型检查：必须零错误
[项目的 type-check 命令]

# Lint：能自动修就先自动修
[项目的 lint 命令]
[项目的 lint-fix 命令]
```

如果自动修复后仍有 lint 错误，手工修好。

### 第 2 级：单元测试

为每个新增函数编写测试（按计划中的测试策略执行）：

```bash
[项目在受影响区域的测试命令]
```

- 每个函数至少应有一个测试
- 覆盖计划里列出的边界场景
- 如果测试失败，优先修实现，而不是直接改测试（除非测试本身有误）

### 第 3 级：构建检查

```bash
[项目的 build 命令]
```

构建必须零错误通过。

### 第 4 级：集成测试（如适用）

```bash
# 启动服务，执行测试，再停止服务
[项目的 dev server 命令] &
SERVER_PID=$!

# 等待服务就绪（按实际端口调整）
SERVER_READY=0
for i in $(seq 1 30); do
  if curl -sf http://localhost:PORT/health >/dev/null 2>&1; then
    SERVER_READY=1
    break
  fi
  sleep 1
done

if [ "$SERVER_READY" -ne 1 ]; then
  kill "$SERVER_PID" 2>/dev/null || true
  echo "ERROR: Server failed to start within 30s" >&2
  exit 1
fi

[integration test command]
TEST_EXIT=$?

kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

exit "$TEST_EXIT"
```

### 第 5 级：边界场景测试

逐项执行计划中“Testing Strategy”列出的边界条件检查。

**检查点**：5 个验证层级全部通过，零错误。

---

## 阶段 5 — 报告

### 创建实施报告

```bash
mkdir -p .claude/PRPs/reports
```

将报告写入：
`.claude/PRPs/reports/{plan-name}-report.md`

```markdown
# 实施报告：[功能名称]

## 摘要
[本次实现了什么]

## 预估与实际对比

| 指标 | 计划预估 | 实际情况 |
|---|---|---|
| 复杂度 | [取自计划] | [实际] |
| 信心分 | [取自计划] | [实际] |
| 变更文件数 | [取自计划] | [实际数量] |

## 已完成任务

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 1 | [任务名] | [done] Complete | |
| 2 | [任务名] | [done] Complete | Deviated — [原因] |

## 验证结果

| 级别 | 状态 | 备注 |
|---|---|---|
| 静态分析 | [done] Pass | |
| 单元测试 | [done] Pass | 已写 N 个测试 |
| 构建 | [done] Pass | |
| 集成 | [done] Pass | 或 N/A |
| 边界场景 | [done] Pass | |

## 文件变更

| 文件 | 动作 | 行数 |
|---|---|---|
| `path/to/file` | CREATED | +N |
| `path/to/file` | UPDATED | +N / -M |

## 与计划不一致之处
[列出 WHAT 和 WHY，若无则写 "None"]

## 遇到的问题
[列出问题及解决方式，若无则写 "None"]

## 新增测试

| 测试文件 | 测试数 | 覆盖范围 |
|---|---|---|
| `path/to/test` | N 个测试 | [覆盖区域] |

## 下一步
- [ ] 通过 `/code-review` 做代码审查
- [ ] 通过 `/prp-pr` 创建 PR
```

### 更新 PRD（如适用）

如果本次实现对应某个 PRD 阶段：

1. 把该阶段状态从 `in-progress` 更新为 `complete`
2. 将报告路径添加为引用

### 归档计划

```bash
mkdir -p .claude/PRPs/plans/completed
mv "$ARGUMENTS" .claude/PRPs/plans/completed/
```

**检查点**：报告已创建，PRD 已更新，计划已归档。

---

## 阶段 6 — 输出

向用户汇报：

```text
## Implementation Complete

- **Plan**: [plan file path] → archived to completed/
- **Branch**: [current branch name]
- **Status**: [done] All tasks complete

### Validation Summary

| Check | Status |
|---|---|
| Type Check | [done] |
| Lint | [done] |
| Tests | [done] (N written) |
| Build | [done] |
| Integration | [done] or N/A |

### Files Changed
- [N] files created, [M] files updated

### Deviations
[Summary or "None — implemented exactly as planned"]

### Artifacts
- Report: `.claude/PRPs/reports/{name}-report.md`
- Archived Plan: `.claude/PRPs/plans/completed/{name}.plan.md`

### PRD Progress (if applicable)
| Phase | Status |
|---|---|
| Phase 1 | [done] Complete |
| Phase 2 | [next] |
| ... | ... |

> Next step: Run `/prp-pr` to create a pull request, or `/code-review` to review changes first.
```

---

## 失败处理

### Type Check 失败
1. 仔细阅读报错
2. 修复源文件中的类型问题
3. 重新运行 type-check
4. 只有清零后才能继续

### 测试失败
1. 判断问题在实现还是测试
2. 修复根因（通常是实现问题）
3. 重新运行测试
4. 只有全绿后才能继续

### Lint 失败
1. 先运行自动修复
2. 如果还有错误，手工修
3. 重新运行 lint
4. 只有清零后才能继续

### 构建失败
1. 通常是类型或导入问题，先看报错
2. 修复对应文件
3. 重新运行 build
4. 成功后再继续

### 集成测试失败
1. 检查服务是否正常启动
2. 确认接口 / 路由存在
3. 检查请求格式是否符合预期
4. 修复后重跑

---

## 成功标准

- **TASKS_COMPLETE**：计划中的所有任务都已执行
- **TYPES_PASS**：零类型错误
- **LINT_PASS**：零 lint 错误
- **TESTS_PASS**：所有测试通过，且新增测试已编写
- **BUILD_PASS**：构建成功
- **REPORT_CREATED**：实施报告已保存
- **PLAN_ARCHIVED**：计划已移动到 `completed/`

---

## 下一步

- 运行 `/code-review` 在提交前做审查
- 运行 `/prp-commit` 使用描述性信息提交
- 运行 `/prp-pr` 创建 Pull Request
- 如果 PRD 还有后续阶段，运行 `/prp-plan <next-phase>`
