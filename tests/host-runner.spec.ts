/**
 * HostRunner 判定启发单测：转人工/拒绝识别、占位输出不误判。
 * 完整会话驱动由宿主 typertGateway 集成验证（此处只测纯函数）。
 */
import { classifyHostOutput } from '../src/host-runner.ts'
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
