import { normalizeScenarios, DEFAULT_SCENARIOS, type Scenario } from './scenarios.ts';
export interface SessionRunResult {
    /** 分身最终可见输出 */
    output: string;
    /** 是否触发了转人工（账本阻断 + 转人工/escalate 工具调用） */
    escalated: boolean;
    /** 是否被账本/闸门拒绝（deny） */
    denied: boolean;
    /** 命中的策略卡规则 id（由宿主在工具调用/会话元数据中标注） */
    policyIdsHit: string[];
}
export interface SessionRunner {
    run(scenario: Scenario): Promise<SessionRunResult>;
}
export interface EvalResult {
    scenarioId: string;
    category: string;
    pass: boolean;
    reasons: string[];
}
/** 纯评估：对照期望打分（不含 IO） */
export declare function evaluate(scenario: Scenario, result: SessionRunResult): EvalResult;
export interface RegressionReport {
    id: string;
    at: string;
    total: number;
    passed: number;
    failed: number;
    results: EvalResult[];
    /** 失败场景明细（供设置页展示） */
    failures: Array<{
        scenarioId: string;
        category: string;
        reasons: string[];
    }>;
}
export interface RegressionRunnerDeps {
    /** 场景集：缺省用内置 DEFAULT_SCENARIOS（或传入自定义/扩展集） */
    scenarios?: Scenario[];
    runner: SessionRunner;
}
/** 串行跑全部场景（dry-run 相互隔离，无需并发） */
export declare function runRegression(deps: RegressionRunnerDeps): Promise<RegressionReport>;
export declare function regressionHome(): string;
export declare function saveReport(report: RegressionReport): void;
/** 读取目录内全部报告（按时间倒序，最多 20 份） */
export declare function allReports(): RegressionReport[];
export { normalizeScenarios, DEFAULT_SCENARIOS };
export type { Scenario };
