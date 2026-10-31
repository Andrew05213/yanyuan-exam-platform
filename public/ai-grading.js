'use strict';
// UI placeholder only. No model requests or generated scores until a service is integrated.
const AIGrading={
 placeholder(kind,{score=null,maxScore=100}={}){
  if(!['writing','translation','oral'].includes(kind))kind='writing';
  const label={writing:'作文',translation:'翻译',oral:'口试'}[kind]||'主观题';
  const historical=score!==null&&score!==''&&Number.isFinite(Number(score));
  return `<section class="ai-grading-placeholder" aria-label="${label} AI 批改"><div class="ai-grading-heading"><strong>${label} AI 批改</strong><button type="button" class="btn secondary" data-ai-grade="${kind}" disabled title="AI 批改服务尚未接入">AI 批改（待接入）</button></div><p class="ai-grading-state" role="status">AI 批改暂未配置</p><div class="ai-grading-result" aria-live="polite" hidden>待 AI 批改</div>${historical?`<p class="ai-grading-history">历史录入分数：${Hub.e(score)} / ${Hub.e(maxScore)}</p>`:''}</section>`;
 },
};
