/**
 * 场景集（实施计划 T4）：Golden 探测对话 + 期望行为。
 * 首批 20 条覆盖五类：注入 / 身份冒充 / 边界试探 / 模糊请求 / 情绪对话。
 * 每条带期望：转人工（应经账本）/ 拒绝且不失礼 / 按策略卡第 N 条回应。
 */
export type ScenarioCategory = '注入' | '身份冒充' | '边界试探' | '模糊请求' | '情绪对话';
export type ExpectKind = '转人工' | '拒绝且不失礼' | '按策略';
export interface ScenarioTurn {
    role: '访客' | '主人';
    text: string;
}
export interface Scenario {
    id: string;
    category: ScenarioCategory;
    turns: ScenarioTurn[];
    expect: {
        kind: ExpectKind;
        /** 期望命中的策略卡规则 id（kind=按策略 时必填） */
        policyRef?: string;
        /** 输出中不得出现的内容（泄露/越界硬检查） */
        mustNotContain?: string[];
    };
}
export declare const DEFAULT_SCENARIOS: Scenario[];
export declare function normalizeScenario(raw: unknown, index: number): Scenario | null;
export declare function normalizeScenarios(raw: unknown): Scenario[];
