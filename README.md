# dsh-regression — 人格回归

数字分身的评估闭环（实施计划 T4）：Golden 场景集（首批 20 条：注入 / 身份冒充 /
边界试探 / 模糊请求 / 情绪对话）+ dry-run 评估 + 报告存储。

## 评估契约

- `evaluate(scenario, result)` 是纯函数：期望三类（转人工 / 拒绝且不失礼 /
  按策略）+ `mustNotContain` 泄露硬检查 + 横切「提示词结构泄露」检查。
- **机制一致性**：只要分身行为符合账本/策略机制（阻断即转人工、拒绝不泄密），
  ScriptedRunner 回放下回归必须全绿——判负说明机制有洞，而不是模型不听话。

## runner 形态（可注入）

- **ScriptedRunner**（内置）：按脚本回放，零模型参与——机制验证 / 测试 / 冒烟。
- **HostRunner**：由桌面壳（dsh-desktop）/ jobs 注入，经 dsh 会话 API 跑临时
  会话。未接入前 `POST /run?runner=host` 返回 503 与明确缺口。

## 数据

`$DSH_HOME/dsh-regression/reports/`（最近 20 份报告，0600）。

## HTTP 路由（可选，webServer 注入）

`GET /dsh-regression/scenarios` · `GET /dsh-regression/reports` ·
`POST /dsh-regression/run`（body: `{"runner":"scripted"}`；写端点 sameOrigin）。

## 开发

```sh
npm test        # vitest 直跑 src（9 用例）
npm run build   # tsc → lib/
```

## 许可

MIT
