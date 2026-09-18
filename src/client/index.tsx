/**
 * dsh-regression 客户端插件：在「插件」管理页注册本插件的配置区
 * （plugins.bundle.config，key=包名）。summary 一行简介；page 渲染人格 CI 只读速览
 * （Golden 场景数 / 回归报告数 / 影子盲测滚动窗口统计）。
 * 跑回归与影子盲测判定走 /dsh-regression/* 路由（dsh-twin 学习队列/影子 Tab 有入口），此处不做第二操作入口。
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['slots']

interface ShadowStatsDto {
  window?: number
  samples?: number
  confusionRate?: number
}
interface ScenarioLike { id?: string }
interface ReportLike { id?: string }
interface Loaded {
  scenarios: number
  reports: number
  latestReportId?: string
  shadow?: ShadowStatsDto
  shadowError?: boolean
}

const c = {
  text: 'var(--dsw-alias-label-primary, #1f2329)',
  sub: 'var(--dsw-alias-label-secondary, #4e5969)',
  faint: 'var(--dsw-alias-label-tertiary, #86909c)',
  bg: 'var(--dsw-alias-bg-base, #ffffff)',
  layer: 'var(--dsw-alias-bg-layer-1, #f7f8fa)',
  border: 'var(--dsw-alias-separator-primary, #e5e6eb)',
  accent: 'var(--dsw-alias-state-business-primary, #3370ff)',
  warn: 'var(--dsw-alias-state-warn-primary, #ff7d00)',
}

const sectionStyle = { border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px', background: c.bg, marginBottom: 12 }
const titleStyle = { fontSize: 13, fontWeight: 600, color: c.text, margin: '0 0 8px' }
const hintStyle = { fontSize: 12, color: c.sub, lineHeight: 1.5 }
const cellStyle = { padding: '10px 14px', borderRadius: 8, background: c.layer, textAlign: 'center' as const, minWidth: 84 }
const cellNumStyle = { fontSize: 20, fontWeight: 700, color: c.text }
const cellLabelStyle = { fontSize: 11.5, color: c.faint, marginTop: 2 }

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  return (await res.json()) as T
}

/** 只读人格 CI 速览（有状态，由 React 渲染）。 */
function StatsPage(): JSX.Element {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [scenarios, reports, shadow] = await Promise.all([
          getJson<{ ok: boolean; scenarios?: ScenarioLike[] }>('/dsh-regression/scenarios'),
          getJson<{ ok: boolean; reports?: ReportLike[] }>('/dsh-regression/reports'),
          getJson<{ ok: boolean; stats?: ShadowStatsDto }>('/dsh-regression/shadow/stats').catch(() => ({ ok: false }) as { ok: boolean; stats?: ShadowStatsDto }),
        ])
        if (!scenarios.ok || !reports.ok) { setError(true); return }
        setData({
          scenarios: scenarios.scenarios?.length ?? 0,
          reports: reports.reports?.length ?? 0,
          latestReportId: reports.reports?.[0]?.id,
          shadow: shadow.ok ? shadow.stats : undefined,
          shadowError: !shadow.ok,
        })
      } catch {
        setError(true)
      }
    })()
  }, [])

  if (error) return <div style={{ ...hintStyle, color: c.warn }}>回归服务状态获取失败（dsh-regression 宿主服务不可用？）。</div>
  if (data === null) return <div style={hintStyle}>加载评估服务状态中…</div>

  const shadow = data.shadow
  const cells: Array<[string, string | number]> = [
    ['Golden 场景', data.scenarios],
    ['回归报告', data.reports],
    ['影子样本（30 天窗）', shadow?.samples ?? '—'],
    ['分辨不出率', typeof shadow?.confusionRate === 'number' ? `${Math.round(shadow.confusionRate * 100)}%` : '—'],
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={sectionStyle}>
        <div style={titleStyle}>评估概况</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cells.map(([label, v]) => (
            <div key={label} style={cellStyle}>
              <div style={cellNumStyle}>{v}</div>
              <div style={cellLabelStyle}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ ...hintStyle, marginTop: 8 }}>
          {data.latestReportId !== undefined ? `最新报告：${data.latestReportId} · ` : ''}
          检查通过不等于授权——回归报告只是证据，人格生效永远是主人的签名决定。
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={titleStyle}>影子测试（盲测对）</div>
        {data.shadowError === true ? (
          <div style={{ ...hintStyle, color: c.warn }}>影子统计不可用（存储缺失或读取失败）。</div>
        ) : shadow === undefined || (shadow.samples ?? 0) === 0 ? (
          <div style={hintStyle}>暂无样本：影子对从授权语料生成（隐去主人原文让分身作答），主人在影子 Tab 逐对盲判。</div>
        ) : (
          <div style={hintStyle}>
            主人分辨不出分身代笔的比例（选错/弃权 ÷ 已判定，滚动窗口）持续上升 = 「越用越像」的量化信号。
            分歧对自动生成样例卡候选（低权重观察，走确认），原文只在本地、统计只落指标。
          </div>
        )}
      </div>
    </div>
  )
}

/** 插件页配置入口：summary 一行简介（无 hooks）；page 渲染只读速览。 */
export function RegressionPluginConfig(props: { view: 'summary' | 'page' }): JSX.Element {
  if (props.view === 'page') return <StatsPage />
  return (
    <span style={{ fontSize: 12, color: c.sub }}>
      人格 CI：Golden 场景回归（注入/冒充/边界试探）+ 影子盲测（分辨不出率）；防漂移的常驻健康度。
    </span>
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('plugins.bundle.config', () =>
    ctx.slots.register(
      { name: 'plugins.bundle.config', key: '@dsh-extra/dsh-regression' },
      (props: { view: 'summary' | 'page' }) => RegressionPluginConfig({ view: props.view }),
    ),
  )
}
