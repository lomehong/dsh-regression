import { allReports, runRegression, saveReport, DEFAULT_SCENARIOS } from "./runner.js";
import { createHostSessionRunner } from "./host-runner.js";
import { normalizeScenarios } from "./scenarios.js";
import { addPair, judgePair, shadowStats, pendingPairs } from "./shadow.js";
export const name = 'dsh-regression';
export const provide = ['dsh-regression'];
/** 脚本化 runner：映射 scenarioId → 回放结果；未映射的场景默认「分身正常拒绝且不泄密」 */
export function createScriptedRunner(script = {}) {
    return {
        async run(scenario) {
            const hit = script[scenario.id];
            if (hit !== undefined)
                return hit;
            const escalated = scenario.expect.kind === '转人工';
            return {
                output: escalated ? '该事项需要我主人确认，我已转达，会尽快给您答复。' : '抱歉，这我不方便处理。',
                escalated,
                denied: scenario.expect.kind === '拒绝且不失礼',
                policyIdsHit: scenario.expect.policyRef !== undefined ? [scenario.expect.policyRef] : [],
            };
        },
    };
}
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', c => {
            size += c.length;
            if (size > 64 * 1024) {
                reject(new Error('request body too large'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try {
                const all = Buffer.concat(chunks).toString('utf8');
                resolve(all ? JSON.parse(all) : {});
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
function sameOrigin(req) {
    const origin = req.headers.origin;
    if (origin === undefined)
        return true;
    const host = req.headers.host;
    if (typeof host !== 'string' || host === '')
        return false;
    try {
        return new URL(String(origin)).host === host;
    }
    catch {
        return false;
    }
}
function respondJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
}
export function apply(ctx) {
    const c = ctx;
    try {
        c.logger?.info?.('[dsh-regression] 人格回归插件已加载');
    }
    catch {
        // 忽略
    }
    const service = {
        /** 跑回归：runnerKind = scripted（默认，机制验证）| host（真实分身会话）。
         *  host 模式需要宿主 typertGateway（惰性解析，缺席抛错）；
         *  「按策略 + policyRef」场景需宿主侧策略命中标注，host 模式跳过。 */
        run: async (runnerKind, customScenarios) => {
            const scenarios = customScenarios === undefined ? undefined : normalizeScenarios(customScenarios);
            if (runnerKind === 'host') {
                const gateway = (() => {
                    try {
                        return c.get('typertGateway');
                    }
                    catch {
                        return undefined;
                    }
                })();
                if (gateway === undefined) {
                    throw new Error('HostRunner 需要宿主 typertGateway（未检测到）：请确认 dsh 版本 ≥ 0.1.2 或改用 runner=scripted');
                }
                const all = scenarios ?? DEFAULT_SCENARIOS;
                const hostScenarios = all.filter(s => s.expect.kind !== '按策略');
                const report = await runRegression(hostScenarios.length > 0 ? { runner: createHostSessionRunner({ gateway }), scenarios: hostScenarios } : { runner: createScriptedRunner() });
                const settled = {
                    ...report,
                    ...(all.length !== hostScenarios.length ? { hostSkippedPolicyScenarios: all.length - hostScenarios.length } : {}),
                };
                saveReport(settled);
                return settled;
            }
            const runner = createScriptedRunner();
            const report = await runRegression(customScenarios === undefined ? { runner } : { runner, scenarios: normalizeScenarios(customScenarios) });
            saveReport(report);
            return report;
        },
        createScriptedRunner,
        reports: allReports,
        scenarios: DEFAULT_SCENARIOS,
        /** v2 影子测试：盲测对与统计 */
        shadow: {
            addPair,
            judgePair,
            stats: (windowDays) => shadowStats(windowDays ?? 30),
            pending: (limit) => pendingPairs(limit ?? 10),
        },
    };
    try {
        c.provide?.('dsh-regression', service);
    }
    catch (e) {
        try {
            c.logger?.warn?.('[dsh-regression] provide 失败:', e instanceof Error ? e.message : String(e));
        }
        catch {
            // 忽略
        }
    }
    try {
        c.inject?.(['webServer'], (wctx) => {
            const web = wctx.get?.('webServer');
            if (web === undefined || typeof web.register !== 'function')
                return;
            const disposers = [];
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/scenarios',
                handler: (_req, res) => {
                    respondJson(res, 200, { ok: true, scenarios: DEFAULT_SCENARIOS });
                },
            }));
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/reports',
                handler: (_req, res) => {
                    respondJson(res, 200, { ok: true, reports: allReports() });
                },
            }));
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/run',
                handler: async (req, res) => {
                    if (req.method !== 'POST' || !sameOrigin(req)) {
                        respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' });
                        return;
                    }
                    try {
                        const body = (await readJsonBody(req));
                        const kind = body.runner === 'host' ? 'host' : 'scripted';
                        const report = await service.run(kind, body.scenarios);
                        respondJson(res, 200, { ok: true, report });
                    }
                    catch (e) {
                        respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
                    }
                },
            }));
            if (typeof web.effect === 'function') {
                web.effect(() => () => {
                    for (const d of disposers)
                        d();
                });
            }
            // ── v2 影子测试路由 ──
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/shadow/stats',
                handler: (_req, res) => {
                    try {
                        respondJson(res, 200, { ok: true, stats: shadowStats(30) });
                    }
                    catch (e) {
                        respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
                    }
                },
            }));
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/shadow/pending',
                handler: (_req, res) => {
                    try {
                        respondJson(res, 200, { ok: true, pairs: pendingPairs(10) });
                    }
                    catch (e) {
                        respondJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
                    }
                },
            }));
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/shadow/add',
                handler: async (req, res) => {
                    if (req.method !== 'POST' || !sameOrigin(req)) {
                        respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' });
                        return;
                    }
                    try {
                        const body = (await readJsonBody(req));
                        const r = addPair({ visitorInput: body.visitorInput, masterReply: body.masterReply, twinReply: body.twinReply, ref: body.ref });
                        respondJson(res, r.ok ? 200 : (r.duplicate === true ? 409 : 400), r);
                    }
                    catch (e) {
                        respondJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
                    }
                },
            }));
            disposers.push(web.register({
                kind: 'exact',
                path: '/dsh-regression/shadow/judge',
                handler: async (req, res) => {
                    if (req.method !== 'POST' || !sameOrigin(req)) {
                        respondJson(res, req.method === 'POST' ? 403 : 405, { ok: false, error: 'denied' });
                        return;
                    }
                    try {
                        const body = (await readJsonBody(req));
                        const r = judgePair(String(body.pairId ?? ''), body.judged);
                        respondJson(res, r.ok ? 200 : 400, r);
                    }
                    catch (e) {
                        respondJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
                    }
                },
            }));
            c.logger?.info?.('[dsh-regression] 路由已注册 (/dsh-regression/*)');
        });
    }
    catch (e) {
        try {
            c.logger?.warn?.('[dsh-regression] webServer 注入失败:', e instanceof Error ? e.message : String(e));
        }
        catch {
            // 忽略
        }
    }
}
export { runRegression, evaluate, allReports, saveReport, DEFAULT_SCENARIOS } from "./runner.js";
