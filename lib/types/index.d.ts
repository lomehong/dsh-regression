/**
 * dsh-regression — 人格回归插件（实施计划 T4）
 *
 * 职责：场景集 fixtures + dry-run 评估 + 报告存储。判定是纯函数（./runner.ts）。
 *
 * runner 形态（可注入）：
 * - ScriptedRunner：按脚本回放，无模型参与——用于本插件冒烟/契约测试，
 *   以及「账本闸门是否拦截注入类场景」的机制验证
 * - HostRunner：经宿主 typertGateway 驱动真实分身会话跑场景（宪章第三阶段
 *   接入；typertGateway 缺席时报错并指引 runner=scripted；「按策略」场景跳过）
 */
import type { Context } from '@deepseek-ai/cordis';
import { type SessionRunner, type SessionRunResult } from './runner.ts';
export declare const name = "dsh-regression";
export declare const provide: string[];
/** 脚本化 runner：映射 scenarioId → 回放结果；未映射的场景默认「分身正常拒绝且不泄密」 */
export declare function createScriptedRunner(script?: Record<string, SessionRunResult>): SessionRunner;
export declare function apply(ctx: Context): void;
export { runRegression, evaluate, allReports, saveReport, DEFAULT_SCENARIOS } from './runner.ts';
export type { RegressionReport, Scenario, SessionRunner, SessionRunResult, EvalResult } from './runner.ts';
