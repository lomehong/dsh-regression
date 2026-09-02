/**
 * 影子测试协议（v2，实施计划 V2-M3b / 设计文档 v2 §6）
 *
 * 盲测对（ShadowPair）：同一访客输入下「主人真实回复」vs「分身回复」，
 * 主人盲选哪句是自己写的。分辨不出率 = 主人选错/弃权的比例（滚动窗口）。
 *
 * 隐私边界：只存盲测对与判定结果（本地，0600）；统计只落指标（比例、样本数）。
 * twinReply 的自动化产生依赖 HostRunner（v1 遗留接口）；当前支持手动提交路径，
 * HostRunner 接入后同一存储与统计不变。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
function shadowPath() {
    return process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
        ? join(process.env.DSH_HOME, 'dsh-regression', 'shadow.json')
        : join(homedir(), '.dsh', 'dsh-regression', 'shadow.json');
}
export function loadShadow() {
    const p = shadowPath();
    if (!existsSync(p))
        return { pairs: [] };
    try {
        const s = JSON.parse(readFileSync(p, 'utf8'));
        return Array.isArray(s.pairs) ? s : { pairs: [] };
    }
    catch {
        try {
            renameSync(p, `${p}.corrupt-${Date.now()}`);
        }
        catch { /* 备份失败 */ }
        return { pairs: [] };
    }
}
export function saveShadow(store) {
    const p = shadowPath();
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, p);
}
function pairFp(visitorInput, masterReply) {
    return createHash('sha256').update(`${visitorInput}\u0000${masterReply}`).digest('hex').slice(0, 16);
}
/** 添加盲测对（同 输入+主人回复 指纹去重） */
export function addPair(input) {
    const visitorInput = String(input.visitorInput ?? '').trim();
    const masterReply = String(input.masterReply ?? '').trim();
    const twinReply = String(input.twinReply ?? '').trim();
    if (visitorInput === '' || masterReply === '' || twinReply === '') {
        return { ok: false, error: 'visitorInput / masterReply / twinReply 均不能为空' };
    }
    const store = loadShadow();
    const fp = pairFp(visitorInput, masterReply);
    if (store.pairs.some(p => pairFp(p.visitorInput, p.masterReply) === fp)) {
        return { ok: false, duplicate: true, error: '同一盲测对已存在' };
    }
    const pair = {
        id: `SP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        ...(input.ref !== undefined && String(input.ref) !== '' ? { ref: String(input.ref).slice(0, 60) } : {}),
        visitorInput: visitorInput.slice(0, 1000),
        masterReply: masterReply.slice(0, 2000),
        twinReply: twinReply.slice(0, 2000),
    };
    store.pairs.push(pair);
    saveShadow(store);
    return { ok: true, pair };
}
/** 主人判定：只有未判定的对可判定（判定后不可改，防事后美化指标） */
export function judgePair(pairId, judged) {
    if (!['主人', '分身', '弃权'].includes(judged))
        return { ok: false, error: '判定必须是 主人/分身/弃权' };
    const store = loadShadow();
    const pair = store.pairs.find(p => p.id === pairId);
    if (pair === undefined)
        return { ok: false, error: '盲测对不存在' };
    if (pair.judged !== undefined)
        return { ok: true, pair, error: '已判定（不可更改）' };
    pair.judged = judged;
    pair.judgedAt = new Date().toISOString();
    saveShadow(store);
    return { ok: true, pair };
}
/** 滚动窗口统计 */
export function shadowStats(windowDays = 30) {
    const store = loadShadow();
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const inWindow = store.pairs.filter(p => new Date(p.at).getTime() >= cutoff);
    const breakdown = { 主人: 0, 分身: 0, 弃权: 0, 未判定: 0 };
    for (const p of inWindow) {
        if (p.judged === undefined)
            breakdown['未判定'] += 1;
        else
            breakdown[p.judged] += 1;
    }
    const samples = inWindow.filter(p => p.judged !== undefined).length;
    const confused = breakdown['分身'] + breakdown['弃权'];
    return {
        windowDays,
        samples,
        confusionRate: samples > 0 ? Number((confused / samples).toFixed(4)) : null,
        breakdown,
    };
}
/** 待判定对（未判定的最早若干条） */
export function pendingPairs(limit = 10) {
    return loadShadow().pairs.filter(p => p.judged === undefined).slice(0, limit);
}
/** 清理已判定且超窗的对（数据最小化：指标已入统计，原文可清理） */
export function pruneShadow(windowDays = 90) {
    const store = loadShadow();
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const before = store.pairs.length;
    store.pairs = store.pairs.filter(p => p.judged === undefined || new Date(p.judgedAt ?? p.at).getTime() >= cutoff);
    if (store.pairs.length !== before)
        saveShadow(store);
    return before - store.pairs.length;
}
