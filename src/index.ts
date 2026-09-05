/**
 * dsh-regression — 人格回归插件（实施计划 T4）
 *
 * 职责：场景集 fixtures + dry-run 评估 + 报告存储。判定是纯函数（./runner.ts）。
 *
 * runner 形态（可注入）：
 * - ScriptedRunner：按脚本回放，无模型参与——用于本插件冒烟/契约测试，
 *   以及「账本闸门是否拦截注入类场景」的机制验证
 * - HostRunner：经宿主 typertGateway 驱动真实分身会话跑场景（宪章第三阶段
 *   接入；typertGateway 缺席时报错并指引 runner=scripted；「按策略」场景跳过）
 */
import type { Context } from '@deepseek-ai/cordis'
import { allReports, runRegression, saveReport, DEFAULT_SCENARIOS, type RegressionReport, type Scenario, type SessionRunner, type SessionRunResult } from './runner.ts'
import { createHostSessionRunner, type RegressionGatewayLike } from './host-runner.ts'
import { normalizeScenarios } from './scenarios.ts'
import { addPair, judgePair, shadowStats, pendingPairs, type ShadowJudged } from './shadow.ts'

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
    /** 跑回归：runnerKind = scripted（默认，机制验证）| host（真实分身会话）。
     *  host 模式需要宿主 typertGateway（惰性解析，缺席抛错）；
     *  「按策略 + policyRef」场景需宿主侧策略命中标注，host 模式跳过。 */
    run: async (runnerKind: 'scripted' | 'host', customScenarios?: unknown): Promise<RegressionReport & { hostSkippedPolicyScenarios?: number }> => {
      const scenarios = customScenarios === undefined ? undefined : normalizeScenarios(customScenarios)
      if (runnerKind === 'host') {
        const gateway = ((): RegressionGatewayLike | undefined => {
          try {
            return (c as unknown as { get(name: string): unknown }).get('typertGateway') as RegressionGatewayLike | undefined
          } catch {
            return undefined
          }
        })()
        if (gateway === undefined) {
          throw new Error('HostRunner 需要宿主 typertGateway（未检测到）：请确认 dsh 版本 ≥ 0.1.2 或改用 runner=scripted')
        }
        const all = scenarios ?? DEFAULT_SCENARIOS
        const hostScenarios = all.filter(s => s.expect.kind !== '按策略')
        const report = await runRegression(hostScenarios.length > 0 ? { runner: createHostSessionRunner({ gateway }), scenarios: hostScenarios } : { runner: createScriptedRunner() })
        const settled: RegressionReport & { hostSkippedPolicyScenarios?: number } = {
          ...report,
          ...(all.length !== hostScenarios.length ? { hostSkippedPolicyScenarios: all.length - hostScenarios.length } : {}),
        }
        saveReport(settled)
        return settled
      }
      const runner: SessionRunner = createScriptedRunner()
      const report = await runRegression(
        customScenarios === undefined ? { runner } : { runner, scenarios: normalizeScenarios(customScenarios) },
      )
      saveReport(report)
      return report
    },
    createScriptedRunner,
    reports: allReports,
    scenarios: DEFAULT_SCENARIOS,
    /** v2 影子测试：盲测对与统计 */
    shadow: {
      addPair,
      judgePair,
      stats: (windowDays?: number) => shadowStats(windowDays ?? 30),
      pending: (limit?: number) => pendingPairs(limit ?? 10),
    },
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
              const report = await service.run(kind, body.scenarios)
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
      // ── v2 影子测试路由 ──
      disposers.push(web.register({
        kind: 'exact',
        path: '/dsh-regression/shadow/stats',
        handler: (_req, res) => {
          try { respondJson(res, 200, { ok: true, stats: shadowStats(30) }) }
          catch (e) { respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) }) }
        },
      }))
      disposers.push(web.register({
        kind: 'exact',
        path: '/dsh-regression/shadow/pending',
        handler: (_req, res) => {
          try { respondJson(res, 200, { ok: true, pairs: pendingPairs(10) }) }
          catch (e) { respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) }) }
        },
      }))
      disposers.push(web.register({
        kind: 'exact',
        path: '/dsh-regression/shadow/add',
        handler: async (req, res) => {
          if (req.method !== 'POST' || !sameOrigin(req)) { respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' }); return }
          try {
            const body = (await readJsonBody(req)) as { visitorInput?: unknown; masterReply?: unknown; twinReply?: unknown; ref?: unknown }
            const r = addPair({ visitorInput: body.visitorInput, masterReply: body.masterReply, twinReply: body.twinReply, ref: body.ref })
            respondJson(res, r.ok ? 200 : (r.duplicate === true ? 409 : 400), r)
          } catch (e) { respondJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }) }
        },
      }))
      disposers.push(web.register({
        kind: 'exact',
        path: '/dsh-regression/shadow/judge',
        handler: async (req, res) => {
          if (req.method !== 'POST' || !sameOrigin(req)) { respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' }); return }
          try {
            const body = (await readJsonBody(req)) as { pairId?: string; judged?: ShadowJudged }
            const r = judgePair(String(body.pairId ?? ''), body.judged as ShadowJudged)
            respondJson(res, r.ok ? 200 : 400, r)
          } catch (e) { respondJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }) }
        },
      }))

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
