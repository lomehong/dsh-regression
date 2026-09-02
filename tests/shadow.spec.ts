/**
 * 影子测试协议契约测试：盲测对去重 / 判定不可改 / 滚动窗口统计 / 数据清理。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let home: string
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'dsh-reg-shadow-')); process.env.DSH_HOME = home })
afterEach(() => { delete process.env.DSH_HOME; rmSync(home, { recursive: true, force: true }) })

async function S() { return import('../src/shadow.ts') }

const base = { visitorInput: '你们什么时候能给方案？', masterReply: '本周五前给您初稿，先确认需求范围。', twinReply: '方案已经在准备了，请稍等。' }

describe('盲测对', () => {
  it('添加成功；同指纹去重', async () => {
    const { addPair } = await S()
    const r1 = addPair(base)
    expect(r1.ok).toBe(true)
    const r2 = addPair(base)
    expect(r2.ok).toBe(false)
    expect(r2.duplicate).toBe(true)
  })
  it('空字段拒绝', async () => {
    const { addPair } = await S()
    expect(addPair({ ...base, twinReply: '' }).ok).toBe(false)
    expect(addPair({ ...base, visitorInput: '' }).ok).toBe(false)
  })
})

describe('判定与统计', () => {
  it('判定后不可更改（防事后美化指标）', async () => {
    const { addPair, judgePair } = await S()
    const p = addPair(base).pair!
    const j1 = judgePair(p.id, '分身')
    expect(j1.ok).toBe(true)
    const j2 = judgePair(p.id, '主人')
    expect(j2.ok).toBe(true) // 幂等成功
    expect(j2.pair?.judged).toBe('分身') // 但结果不变
  })
  it('滚动窗口：分辨不出率 = (选分身+弃权)/已判定数', async () => {
    const { addPair, judgePair, shadowStats } = await S()
    // 4 对：2 判分身（分辨不出）、1 判主人、1 弃权
    for (let i = 0; i < 4; i++) {
      addPair({ ...base, visitorInput: `${base.visitorInput} #${i}` })
    }
    const { pairs } = await import('../src/shadow.ts').then(m => ({ pairs: m.loadShadow().pairs }))
    judgePair(pairs[0]!.id, '分身')
    judgePair(pairs[1]!.id, '分身')
    judgePair(pairs[2]!.id, '主人')
    judgePair(pairs[3]!.id, '弃权')
    const s = shadowStats(30)
    expect(s.samples).toBe(4)
    expect(s.confusionRate).toBe(0.75)
    expect(s.breakdown).toEqual({ 主人: 1, 分身: 2, 弃权: 1, 未判定: 0 })
  })
  it('未判定不计入分母', async () => {
    const { addPair, judgePair, shadowStats } = await S()
    addPair(base)
    addPair({ ...base, visitorInput: '另一条输入' })
    const { pairs } = await import('../src/shadow.ts').then(m => ({ pairs: m.loadShadow().pairs }))
    judgePair(pairs[0]!.id, '主人')
    const s = shadowStats(30)
    expect(s.samples).toBe(1)
    expect(s.confusionRate).toBe(0)
  })
})

describe('数据清理', () => {
  it('新鲜数据 prune 返回 0；未判定对保留在待判定队列', async () => {
    const { addPair, pruneShadow, pendingPairs } = await S()
    addPair(base)
    addPair({ ...base, visitorInput: '第二条输入' })
    expect(pruneShadow(90)).toBe(0)
    expect(pendingPairs(10).length).toBe(2)
  })
})
