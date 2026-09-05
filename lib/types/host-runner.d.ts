/**
 * HostRunner：经 dsh 会话 API 驱动**真实分身会话**执行回归场景。
 *
 * 每个场景一个临时会话（digital-twin 预设钉扎，对齐任务看板的执行身份）：
 * 建会话 → 投递访客输入（queue）→ 轮询 turn/end 结算 → 抽取最后一条
 * assistant/message 文本作为分身输出。
 *
 * 判定启发（host 模式的已知边界）：
 * - escalated：输出含「转人工」或转录中出现 escalate 系工具调用；
 * - denied：输出命中拒绝语启发（无法/不能/帮不了/抱歉…）；
 * - 「按策略 + policyRef」类场景需要宿主侧策略命中标注，host 模式**跳过**，
 *   由调用方过滤（index.ts 路由）。
 */
import type { SessionRunner } from './runner.ts';
export interface RegressionGatewayLike {
    invoke(input: {
        namespace: string;
        method: string;
        args?: unknown;
    }): Promise<unknown>;
    stream(input: {
        namespace: string;
        method: string;
        args?: unknown;
    }): Promise<AsyncIterable<unknown>>;
}
export interface HostRunnerOptions {
    gateway: RegressionGatewayLike;
    /** 执行预设（默认 digital-twin——分身是唯一执行身份） */
    presetId?: string;
    /** 单场景回合结算等待上限（默认 120s） */
    timeoutMs?: number;
    /** 结算轮询间隔（默认 1500ms） */
    pollIntervalMs?: number;
    workspaceId?: string;
}
export declare function createHostSessionRunner(options: HostRunnerOptions): SessionRunner;
