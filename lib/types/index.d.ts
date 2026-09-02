/**
 * dsh-regression — 人格回归插件（实施计划 T4）
 *
 * 职责：场景集 fixtures + dry-run 评估 + 报告存储。判定是纯函数（./runner.ts）。
 *
 * runner 形态（可注入）：
 * - ScriptedRunner：按脚本回放，无模型参与——用于本插件冒烟/契约测试，
 *   以及「账本闸门是否拦截注入类场景」的机制验证
 * - HostRunner：由桌面壳 / jobs 注入，经 dsh 会话 API 跑临时会话（集成中；
 *   未注入时 POST /run?runner=host 返回 503 与明确缺口）
 */
import type { Context } from '@deepseek-ai/cordis';
import { type SessionRunner, type SessionRunResult } from './runner.ts';
export declare const name = "dsh-regression";
export declare const provide: string[];
/** 脚本化 runner：映射 scenarioId → 回放结果；未映射的场景默认「分身正常拒绝且不泄密」 */
export declare function createScriptedRunner(script?: Record<string, SessionRunResult>): SessionRunner;
/** 宿主 runner（集成中）：尚未接入会话 API 前明确抛错，不假装跑过 */
export declare function createHostRunner(): SessionRunner;
export declare function apply(ctx: Context): void;
export { runRegression, evaluate, allReports, saveReport, DEFAULT_SCENARIOS } from './runner.ts';
export type { RegressionReport, Scenario, SessionRunner, SessionRunResult, EvalResult } from './runner.ts';
