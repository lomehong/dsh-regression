/**
 * dsh-regression — 人格回归插件（实施计划 T4）
 *
 * 职责：场景集 fixtures + dry-run 评估 + 报告存储。判定是纯函数（./runner.ts）。
 *
 * runner 形态（可注入）：
 * - ScriptedRunner：按脚本回放，无模型参与——用于本插件冒烟/契约测试，
 *   以及「账本闸门是否拦截注入类场景」的机制验证
 * - HostRunner：由桌面壳 / jobs 注入，经 dsh 会话 API 跑临时会话（集成中；
 *   未注入时 POST /run?runner=host 返回 503 与明确缺口）
 */
import type { Context } from '@deepseek-ai/cordis'
import { allReports, runRegression, saveReport, DEFAULT_SCENARIOS, type RegressionReport, type Scenario, type SessionRunner, type SessionRunResult } from './runner.ts'
import { normalizeScenarios } from './scenarios.ts'

export const name = 'dsh-regression'
export const provide = ['dsh-regression']

/** 脚本化 runner：映射 scenarioId → 回放结果；未映射的场景默认「分身正常拒绝且不泄密」 */
export function createScriptedRunner(script: Record<string, SessionRunResult> = {}): SessionRunner {
  return {
    async run(scenario: Scenario): Promise<SessionRunResult> {
      const hit = script[scenario.id]
      if (hit !== undefined) return hit
      const escalated = scenario.expect.kind === '转人工'
      return {
        output: escalated ? '该事项需要我主人确认，我已转达，会尽快给您答复。' : '抱歉，这我不方便处理。',
        escalated,
        denied: scenario.expect.kind === '拒绝且不失礼',
        policyIdsHit: scenario.expect.policyRef !== undefined ? [scenario.expect.policyRef] : [],
      }
    },
  }
}

/** 宿主 runner（集成中）：尚未接入会话 API 前明确抛错，不假装跑过 */
export function createHostRunner(): SessionRunner {
  return {
    async run(): Promise<SessionRunResult> {
      throw new Error('HostRunner 尚未接入 dsh 会话 API（桌面壳 / jobs 集成进行中）；当前可用 runner=scripted')
    },
  }
}

interface RequestLike {
  method?: string
  headers: Record<string, string | string[] | undefined>
  on(event: string, cb: (chunk: Buffer) => void): void
  resume(): void
  destroy(): void
}
interface ResponseLike {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}
interface WebServerLike {
  register(route: { kind: 'exact'; path: string; handler: (req: RequestLike, res: ResponseLike) => void | Promise<void> }): () => void
  effect?(fn: () => () => void): void
}

function readJsonBody(req: RequestLike): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', c => {
      size += c.length
      if (size > 64 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        const all = Buffer.concat(chunks).toString('utf8')
        resolve(all ? JSON.parse(all) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sameOrigin(req: RequestLike): boolean {
  const origin = req.headers.origin
  if (origin === undefined) return true
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  try {
    return new URL(String(origin)).host === host
  } catch {
    return false
  }
}

function respondJson(res: ResponseLike, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}

export function apply(ctx: Context): void {
  const c = ctx as unknown as {
    logger?: { info?: (...a: unknown[]) => void; warn?: (...a: unknown[]) => void }
    provide?: (name: string, value: unknown) => void
    inject?: (deps: string[], fn: (wctx: unknown) => void) => void
  }
  try {
    c.logger?.info?.('[dsh-regression] 人格回归插件已加载')
  } catch {
    // 忽略
  }

  const service = {
    /** 跑回归：runnerKind = scripted（默认，机制验证）| host（集成中） */
    run: async (runnerKind: 'scripted' | 'host', customScenarios?: unknown): Promise<RegressionReport> => {
      let runner: SessionRunner
      if (runnerKind === 'host') runner = createHostRunner()
      else runner = createScriptedRunner()
      const report = await runRegression(
        customScenarios === undefined ? { runner } : { runner, scenarios: normalizeScenarios(customScenarios) },
      )
      saveReport(report)
      return report
    },
    createScriptedRunner,
    createHostRunner,
    reports: allReports,
    scenarios: DEFAULT_SCENARIOS,
  }
  try {
    c.provide?.('dsh-regression', service)
  } catch (e) {
    try {
      c.logger?.warn?.('[dsh-regression] provide 失败:', e instanceof Error ? e.message : String(e))
    } catch {
      // 忽略
    }
  }

  try {
    c.inject?.(['webServer'], (wctx: unknown) => {
      const web = (wctx as { get?: (n: string) => unknown }).get?.('webServer') as WebServerLike | undefined
      if (web === undefined || typeof web.register !== 'function') return
      const disposers: Array<() => void> = []

      disposers.push(
        web.register({
          kind: 'exact',
          path: '/dsh-regression/scenarios',
          handler: (_req, res) => {
            respondJson(res, 200, { ok: true, scenarios: DEFAULT_SCENARIOS })
          },
        }),
      )
      disposers.push(
        web.register({
          kind: 'exact',
          path: '/dsh-regression/reports',
          handler: (_req, res) => {
            respondJson(res, 200, { ok: true, reports: allReports() })
          },
        }),
      )
      disposers.push(
        web.register({
          kind: 'exact',
          path: '/dsh-regression/run',
          handler: async (req, res) => {
            if (req.method !== 'POST' || !sameOrigin(req)) {
              respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' })
              return
            }
            try {
              const body = (await readJsonBody(req)) as { runner?: string; scenarios?: unknown }
              const kind = body.runner === 'host' ? ('host' as const) : ('scripted' as const)
              if (kind === 'host') {
                respondJson(res, 503, { ok: false, error: 'HostRunner 尚未接入 dsh 会话 API（桌面壳 / jobs 集成进行中）；当前可用 runner=scripted' })
                return
              }
              const report = await service.run('scripted', body.scenarios)
              respondJson(res, 200, { ok: true, report })
            } catch (e) {
              respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
            }
          },
        }),
      )

      if (typeof web.effect === 'function') {
        web.effect(() => () => {
          for (const d of disposers) d()
        })
      }
      c.logger?.info?.('[dsh-regression] 路由已注册 (/dsh-regression/*)')
    })
  } catch (e) {
    try {
      c.logger?.warn?.('[dsh-regression] webServer 注入失败:', e instanceof Error ? e.message : String(e))
    } catch {
      // 忽略
    }
  }
}

export { runRegression, evaluate, allReports, saveReport, DEFAULT_SCENARIOS } from './runner.ts'
export type { RegressionReport, Scenario, SessionRunner, SessionRunResult, EvalResult } from './runner.ts'
