/**
 * HostRunner 判定启发单测：转人工/拒绝识别、占位输出不误判；
 * 网关参数契约：session/* 方法一律 `request` 包装（dsh 0.1.6+ 描述符）。
 * 完整会话驱动由宿主 typertGateway 集成验证（此处测纯函数 + 假网关契约）。
 */
import { classifyHostOutput, createHostSessionRunner, type RegressionGatewayLike } from '../src/host-runner.ts'
import { DEFAULT_SCENARIOS } from '../src/scenarios.ts'
import { describe, expect, it } from 'vitest'

describe('classifyHostOutput', () => {
  it('detects escalation from the tool flag', () => {
    expect(classifyHostOutput('已转给主人处理', true)).toEqual({ escalated: true, denied: false })
  })
  it('detects escalation from the reply text', () => {
    expect(classifyHostOutput('这个请求我需要转人工确认。', false).escalated).toBe(true)
  })
  it('detects polite refusal', () => {
    expect(classifyHostOutput('抱歉，这个我无法代办。', false).denied).toBe(true)
  })
  it('normal informative output is neither', () => {
    expect(classifyHostOutput('已完成汇总，请查收。', false)).toEqual({ escalated: false, denied: false })
  })
})

describe('createHostSessionRunner gateway contract', () => {
  /** 记录全部 invoke 调用的假网关；list 即刻报告非 running，page 返回已结算回合。 */
  function fakeGateway() {
    const calls: Array<{ namespace: string; method: string; args?: unknown }> = []
    const gateway: RegressionGatewayLike = {
      invoke: async (input: { namespace: string; method: string; args?: unknown }) => {
        calls.push(input)
        if (input.method === 'create') return { sessionId: 's-1', agentPreset: 'digital-twin' }
        if (input.method === 'rename') return { title: 'regression-inj-001', seq: 1 }
        if (input.method === 'prompt') return { accepted: true }
        if (input.method === 'list') return { items: [{ sessionId: 's-1', running: false }] }
        if (input.method === 'page') {
          return {
            records: [
              { event: { type: 'turn/end', time: Date.now() } },
              { event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '抱歉，这我不方便处理。' }] } } } },
            ],
          }
        }
        return {}
      },
      stream: async function* () { /* 未使用 */ },
    }
    return { calls, gateway }
  }

  it('wraps session/* args in request (create/rename/prompt/list/page)', async () => {
    const { calls, gateway } = fakeGateway()
    const runner = createHostSessionRunner({ gateway, pollIntervalMs: 1, timeoutMs: 5_000 })
    const result = await runner.run(DEFAULT_SCENARIOS[0]!)
    // create：单一 request 参数，预设钉扎在 request 内
    const create = calls.find(c => c.method === 'create')
    expect(create?.args).toEqual({ request: { agentPreset: 'digital-twin' } })
    // rename：request.sessionId 指向新建会话
    const rename = calls.find(c => c.method === 'rename')
    expect((rename?.args as { request: { sessionId: string } }).request.sessionId).toBe('s-1')
    // prompt：queue 模式 + requestId + 文本内容，全部在 request 内
    const prompt = calls.find(c => c.method === 'prompt')
    const promptReq = (prompt?.args as { request: { mode: string; requestId: string; content: unknown } }).request
    expect(promptReq.mode).toBe('queue')
    expect(promptReq.requestId.startsWith('dsh-regression-')).toBe(true)
    expect(Array.isArray(promptReq.content)).toBe(true)
    // list：空 request（无 cursor）
    const list = calls.find(c => c.method === 'list')
    expect(list?.args).toEqual({ request: {} })
    // page：address 指向会话（该调用本就是新契约形态）
    const page = calls.find(c => c.method === 'page')
    expect((page?.args as { request: { address: { sessionId: string } } }).request.address.sessionId).toBe('s-1')
    // 判定启发照常生效
    expect(result.output).toContain('不方便处理')
    expect(result.denied).toBe(true)
  })
})
