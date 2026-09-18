/**
 * 客户端类型检查环境声明（typecheck:client 用）：
 * react / 宿主 client-runtime 的类型在本包不可解析（外部依赖，esbuild external）——
 * 这里提供**最小但可用**的 hooks/JSX 类型，让 tsc 聚焦检查我们自己的逻辑与数据类型
 *（数据形状/属性访问错误等照样抓）。props 不查，逻辑查。
 */
declare module 'react' {
  export type CSSProperties = Record<string, string | number | undefined>
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useCallback<T extends (...args: readonly never[]) => unknown>(callback: T, deps: readonly unknown[]): T
  export const Fragment: any
}
declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown): unknown
  export function jsxs(type: unknown, props: unknown): unknown
  export const Fragment: any
}
declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(n: unknown): void }
}
declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ClientContext {
    slots: {
      inject(name: string, setup: () => void): void
      register(slot: { name: string; id?: string; order?: number; label?: () => string; key?: string }, component: unknown): void
    }
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // 插件管理页的 bundle 级配置区（client-ui-plugin-manager 契约）
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root' }
  }
}
declare namespace React {
  type CSSProperties = Record<string, string | number | undefined>
  interface ChangeEvent { target: { value: string }; stopPropagation(): void }
}
declare namespace JSX {
  type Element = any
  interface ElementChildrenAttribute { children: unknown }
  interface IntrinsicElements { [elem: string]: any }
  interface ElementAttributesProperty { props: unknown }
}
