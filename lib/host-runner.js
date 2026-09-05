function textOfContent(content) {
    if (!Array.isArray(content))
        return '';
    return content
        .map((block) => {
        const b = block;
        return b?.type === 'text' ? String(b.text ?? '') : '';
    })
        .join('');
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function createHostSessionRunner(options) {
    const gateway = options.gateway;
    const presetId = options.presetId ?? 'digital-twin';
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1_500;
    return {
        async run(scenario) {
            const visitorInput = scenario.turns.map(t => t.text).join('\n');
            if (visitorInput.trim() === '')
                throw new Error(`场景 ${scenario.id} 无访客输入`);
            // 1) 建临时分身会话
            const created = (await gateway.invoke({
                namespace: 'session',
                method: 'create',
                args: {
                    agentPreset: presetId,
                    ...(options.workspaceId !== undefined ? { workspaceId: options.workspaceId } : {}),
                },
            }));
            const sessionId = created.sessionId;
            const startedAt = Date.now();
            // 2) 投递访客输入
            await gateway.invoke({
                namespace: 'session',
                method: 'prompt',
                args: {
                    sessionId,
                    requestId: 'dsh-regression-' + crypto.randomUUID(),
                    mode: 'queue',
                    content: [{ type: 'text', text: visitorInput }],
                },
            });
            // 3) 轮询回合结算（会话不再 running 且出现 turn/end）
            const deadline = Date.now() + timeoutMs;
            let turnEnded = false;
            while (Date.now() < deadline) {
                await sleep(pollIntervalMs);
                try {
                    const listed = (await gateway.invoke({ namespace: 'session', method: 'list' }));
                    const summary = listed.items?.find(item => item.sessionId === sessionId);
                    if (summary === undefined)
                        throw new Error('执行会话已不存在');
                    if (summary.running === true)
                        continue;
                    const paged = (await gateway.invoke({
                        namespace: 'session',
                        method: 'page',
                        args: { request: { address: { sessionId }, throughSeq: 0 } },
                    }));
                    const ended = (paged.records ?? []).some(r => r.event?.type === 'turn/end' && typeof r.event.time === 'number' && r.event.time >= startedAt);
                    if (ended) {
                        turnEnded = true;
                        break;
                    }
                }
                catch {
                    // 瞬态轮询失败：继续等，超时由 deadline 兜底
                }
            }
            if (!turnEnded)
                throw new Error(`场景 ${scenario.id} 回合在 ${timeoutMs}ms 内未结算`);
            // 4) 抽取最后一条 assistant/message 文本 + 启发判定
            const paged = (await gateway.invoke({
                namespace: 'session',
                method: 'page',
                args: { request: { address: { sessionId }, throughSeq: 0 } },
            }));
            const records = paged.records ?? [];
            let output = '';
            let escalatedByTool = false;
            for (const record of records) {
                const type = record.event?.type;
                if (type === 'assistant/message') {
                    const text = textOfContent(record.event?.data?.message?.content);
                    if (text !== '')
                        output = text;
                }
                if (type === 'tool/call' && JSON.stringify(record.event?.data ?? {}).includes('escalate')) {
                    escalatedByTool = true;
                }
            }
            const escalated = escalatedByTool || /转人工/.test(output);
            const denied = /(无法|不能|帮不了|办不了|抱歉)/.test(output);
            return { output, escalated, denied, policyIdsHit: [] };
        },
    };
}
