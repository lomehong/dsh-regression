window.__ModuleLoader__.load({
	id: "@dsh-extra/dsh-regression",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  RegressionPluginConfig: () => RegressionPluginConfig,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
var c = {
  text: "var(--dsw-alias-label-primary, #1f2329)",
  sub: "var(--dsw-alias-label-secondary, #4e5969)",
  faint: "var(--dsw-alias-label-tertiary, #86909c)",
  bg: "var(--dsw-alias-bg-base, #ffffff)",
  layer: "var(--dsw-alias-bg-layer-1, #f7f8fa)",
  border: "var(--dsw-alias-separator-primary, #e5e6eb)",
  accent: "var(--dsw-alias-state-business-primary, #3370ff)",
  warn: "var(--dsw-alias-state-warn-primary, #ff7d00)"
};
var sectionStyle = { border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 16px", background: c.bg, marginBottom: 12 };
var titleStyle = { fontSize: 13, fontWeight: 600, color: c.text, margin: "0 0 8px" };
var hintStyle = { fontSize: 12, color: c.sub, lineHeight: 1.5 };
var cellStyle = { padding: "10px 14px", borderRadius: 8, background: c.layer, textAlign: "center", minWidth: 84 };
var cellNumStyle = { fontSize: 20, fontWeight: 700, color: c.text };
var cellLabelStyle = { fontSize: 11.5, color: c.faint, marginTop: 2 };
async function getJson(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  return await res.json();
}
function StatsPage() {
  const [data, setData] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    void (async () => {
      try {
        const [scenarios, reports, shadow2] = await Promise.all([
          getJson("/dsh-regression/scenarios"),
          getJson("/dsh-regression/reports"),
          getJson("/dsh-regression/shadow/stats").catch(() => ({ ok: false }))
        ]);
        if (!scenarios.ok || !reports.ok) {
          setError(true);
          return;
        }
        setData({
          scenarios: scenarios.scenarios?.length ?? 0,
          reports: reports.reports?.length ?? 0,
          latestReportId: reports.reports?.[0]?.id,
          shadow: shadow2.ok ? shadow2.stats : void 0,
          shadowError: !shadow2.ok
        });
      } catch {
        setError(true);
      }
    })();
  }, []);
  if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, color: c.warn }, children: "\u56DE\u5F52\u670D\u52A1\u72B6\u6001\u83B7\u53D6\u5931\u8D25\uFF08dsh-regression \u5BBF\u4E3B\u670D\u52A1\u4E0D\u53EF\u7528\uFF1F\uFF09\u3002" });
  if (data === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u52A0\u8F7D\u8BC4\u4F30\u670D\u52A1\u72B6\u6001\u4E2D\u2026" });
  const shadow = data.shadow;
  const cells = [
    ["Golden \u573A\u666F", data.scenarios],
    ["\u56DE\u5F52\u62A5\u544A", data.reports],
    ["\u5F71\u5B50\u6837\u672C\uFF0830 \u5929\u7A97\uFF09", shadow?.samples ?? "\u2014"],
    ["\u5206\u8FA8\u4E0D\u51FA\u7387", typeof shadow?.confusionRate === "number" ? `${Math.round(shadow.confusionRate * 100)}%` : "\u2014"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { maxWidth: 720 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: sectionStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: titleStyle, children: "\u8BC4\u4F30\u6982\u51B5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: cells.map(([label, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cellStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cellNumStyle, children: v }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cellLabelStyle, children: label })
      ] }, label)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...hintStyle, marginTop: 8 }, children: [
        data.latestReportId !== void 0 ? `\u6700\u65B0\u62A5\u544A\uFF1A${data.latestReportId} \xB7 ` : "",
        "\u68C0\u67E5\u901A\u8FC7\u4E0D\u7B49\u4E8E\u6388\u6743\u2014\u2014\u56DE\u5F52\u62A5\u544A\u53EA\u662F\u8BC1\u636E\uFF0C\u4EBA\u683C\u751F\u6548\u6C38\u8FDC\u662F\u4E3B\u4EBA\u7684\u7B7E\u540D\u51B3\u5B9A\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: sectionStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: titleStyle, children: "\u5F71\u5B50\u6D4B\u8BD5\uFF08\u76F2\u6D4B\u5BF9\uFF09" }),
      data.shadowError === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, color: c.warn }, children: "\u5F71\u5B50\u7EDF\u8BA1\u4E0D\u53EF\u7528\uFF08\u5B58\u50A8\u7F3A\u5931\u6216\u8BFB\u53D6\u5931\u8D25\uFF09\u3002" }) : shadow === void 0 || (shadow.samples ?? 0) === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u6682\u65E0\u6837\u672C\uFF1A\u5F71\u5B50\u5BF9\u4ECE\u6388\u6743\u8BED\u6599\u751F\u6210\uFF08\u9690\u53BB\u4E3B\u4EBA\u539F\u6587\u8BA9\u5206\u8EAB\u4F5C\u7B54\uFF09\uFF0C\u4E3B\u4EBA\u5728\u5F71\u5B50 Tab \u9010\u5BF9\u76F2\u5224\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u4E3B\u4EBA\u5206\u8FA8\u4E0D\u51FA\u5206\u8EAB\u4EE3\u7B14\u7684\u6BD4\u4F8B\uFF08\u9009\u9519/\u5F03\u6743 \xF7 \u5DF2\u5224\u5B9A\uFF0C\u6EDA\u52A8\u7A97\u53E3\uFF09\u6301\u7EED\u4E0A\u5347 = \u300C\u8D8A\u7528\u8D8A\u50CF\u300D\u7684\u91CF\u5316\u4FE1\u53F7\u3002 \u5206\u6B67\u5BF9\u81EA\u52A8\u751F\u6210\u6837\u4F8B\u5361\u5019\u9009\uFF08\u4F4E\u6743\u91CD\u89C2\u5BDF\uFF0C\u8D70\u786E\u8BA4\uFF09\uFF0C\u539F\u6587\u53EA\u5728\u672C\u5730\u3001\u7EDF\u8BA1\u53EA\u843D\u6307\u6807\u3002" })
    ] })
  ] });
}
function RegressionPluginConfig(props) {
  if (props.view === "page") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatsPage, {});
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: c.sub }, children: "\u4EBA\u683C CI\uFF1AGolden \u573A\u666F\u56DE\u5F52\uFF08\u6CE8\u5165/\u5192\u5145/\u8FB9\u754C\u8BD5\u63A2\uFF09+ \u5F71\u5B50\u76F2\u6D4B\uFF08\u5206\u8FA8\u4E0D\u51FA\u7387\uFF09\uFF1B\u9632\u6F02\u79FB\u7684\u5E38\u9A7B\u5065\u5EB7\u5EA6\u3002" });
}
function apply(ctx) {
  ctx.slots.inject(
    "plugins.bundle.config",
    () => ctx.slots.register(
      { name: "plugins.bundle.config", key: "@dsh-extra/dsh-regression" },
      (props) => RegressionPluginConfig({ view: props.view })
    )
  );
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
