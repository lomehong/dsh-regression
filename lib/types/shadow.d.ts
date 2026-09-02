export type ShadowJudged = '主人' | '分身' | '弃权';
export interface ShadowPair {
    id: string;
    at: string;
    /** 关联场景/来源引用（可选） */
    ref?: string;
    visitorInput: string;
    /** 主人真实回复（来自授权语料） */
    masterReply: string;
    /** 分身回复（HostRunner 产出或手动粘贴） */
    twinReply: string;
    judged?: ShadowJudged;
    judgedAt?: string;
}
export interface ShadowStore {
    pairs: ShadowPair[];
}
export interface ShadowStats {
    windowDays: number;
    samples: number;
    /** 分辨不出率 = (选分身 + 弃权) / 样本数；无样本返回 null */
    confusionRate: number | null;
    breakdown: {
        主人: number;
        分身: number;
        弃权: number;
        未判定: number;
    };
}
export declare function loadShadow(): ShadowStore;
export declare function saveShadow(store: ShadowStore): void;
export interface AddPairResult {
    ok: boolean;
    pair?: ShadowPair;
    error?: string;
    duplicate?: boolean;
}
/** 添加盲测对（同 输入+主人回复 指纹去重） */
export declare function addPair(input: {
    visitorInput: unknown;
    masterReply: unknown;
    twinReply: unknown;
    ref?: unknown;
}): AddPairResult;
/** 主人判定：只有未判定的对可判定（判定后不可改，防事后美化指标） */
export declare function judgePair(pairId: string, judged: ShadowJudged): AddPairResult;
/** 滚动窗口统计 */
export declare function shadowStats(windowDays?: number): ShadowStats;
/** 待判定对（未判定的最早若干条） */
export declare function pendingPairs(limit?: number): ShadowPair[];
/** 清理已判定且超窗的对（数据最小化：指标已入统计，原文可清理） */
export declare function pruneShadow(windowDays?: number): number;
