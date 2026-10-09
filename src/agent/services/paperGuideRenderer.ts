import katex from "katex";
import type {
  GuideEvidenceCitation,
  GuidePoint,
  GuideVisual,
  PaperGuide,
} from "./paperLearning";

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[char];
  });
}

function explanation(value: string): string {
  const math = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let output = "";
  let offset = 0;
  for (const match of value.matchAll(math)) {
    output += escape(value.slice(offset, match.index));
    output += katex.renderToString(match[1] ?? match[2], {
      output: "mathml",
      displayMode: match[2] !== undefined,
      throwOnError: true,
      trust: false,
      maxExpand: 100,
    });
    offset = match.index + match[0].length;
  }
  return output + escape(value.slice(offset));
}

function diagram(visual: GuideVisual, id: string): string {
  const positions = new Map(
    visual.nodes.map((node, index) => [node.id, index]),
  );
  const height = visual.nodes.length * 100 + 30;
  const nodes = visual.nodes
    .map(
      (node, index) =>
        `<g><title>${escape(node.label.text)}</title><rect x="20" y="${index * 100 + 20}" width="420" height="60" rx="8"/><text x="35" y="${index * 100 + 45}">${index + 1}. ${escape(node.id)}</text><text x="35" y="${index * 100 + 68}" style="font-size:12px">${escape(Array.from(node.label.text).slice(0, 36).join(""))}</text></g>`,
    )
    .join("");
  const edges = visual.edges
    .map((edge, index) => {
      const from = positions.get(edge.from)! * 100 + 50;
      const to = positions.get(edge.to)! * 100 + 50;
      const lane = 475 + index * 10;
      return `<path d="M440 ${from} H${lane} V${to} H440" marker-end="url(#${id})"><title>${escape(`${edge.from} → ${edge.to}: ${edge.label.text}`)}</title></path>`;
    })
    .join("");
  return `<svg viewBox="0 0 740 ${height}" role="img" aria-label="${escape(visual.title)}"><defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path class="arrow" d="M0 0 L8 4 L0 8 Z"/></marker></defs>${nodes}${edges}</svg>`;
}

const SCRIPT = `
function revealEvidence(hash = location.hash) {
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  let element = target;
  while (element) {
    if (element.tagName === 'DETAILS') element.open = true;
    element = element.parentElement;
  }
  target.scrollIntoView();
}
window.addEventListener('hashchange', () => revealEvidence());
document.addEventListener('click', event => {
  const link = event.target instanceof Element
    ? event.target.closest('a[href^="#evidence-"]')
    : null;
  if (link) revealEvidence(link.getAttribute('href'));
});
revealEvidence();
`;

export function renderPaperGuide(
  guide: PaperGuide,
  citations: GuideEvidenceCitation[],
): string {
  const zh = guide.language === "zh";
  const labels = zh
    ? {
        author: "作者主张",
        inference: "解释性推断",
        background: "背景知识",
        analogy: "教学类比",
      }
    : {
        author: "Author claim",
        inference: "Inference",
        background: "Background",
        analogy: "Teaching analogy",
      };
  const citationById = new Map(
    citations.map((entry) => [entry.evidenceId, entry.citation]),
  );
  const point = (p: GuidePoint): string => {
    const refs = p.evidence
      .map((id) => {
        const citation = citationById.get(id);
        if (!citation)
          throw new Error(`Missing native citation for evidence ${id}`);
        return `<a href="#evidence-${escape(citation.id)}">${escape(citation.citationLabel)}</a>`;
      })
      .join(" · ");
    return `<div class="point"><span class="kind">${labels[p.kind]}</span><p>${explanation(p.text)}</p><div class="refs">${refs}</div></div>`;
  };
  const sections = guide.sections
    .map((section, index) => {
      const visual = section.visual;
      const prompt = `/paper-tutor\n${zh ? "请围绕这个目标讲解，一次一个知识点：" : "Teach this goal, one point at a time:"} ${section.learningGoal}\n${guide.source.title}\nitemId=${guide.source.itemId}; contextItemId=${guide.source.contextItemId}\n${section.title}`;
      return `<section id="section-${escape(section.id)}"><h2>${escape(section.title)}</h2>${section.points.map(point).join("")}${visual ? `<h3>${escape(visual.title)}</h3><p>${zh ? "教学重构，并非论文原图。" : "Teaching reconstruction, not an original paper figure."}</p>${diagram(visual, `arrow-${index}`)}<ol>${visual.nodes.map((node) => `<li><strong>${escape(node.id)}</strong>${point(node.label)}</li>`).join("")}</ol><ul>${visual.edges.map((edge) => `<li>${escape(edge.from)} → ${escape(edge.to)}${point(edge.label)}</li>`).join("")}</ul>` : ""}<details><summary>${zh ? "继续学习这个难点" : "Explore this topic with Tutor"}</summary><p>${zh ? "复制到 Paper Pilot Agent 聊天，并选择对应论文。教学不在此网页中运行。" : "Copy into Paper Pilot Agent chat and select the matching paper. Teaching does not run in this page."}</p><textarea readonly aria-label="Tutor prompt">${escape(prompt)}</textarea></details></section>`;
    })
    .join("");
  const seenCitations = new Set<string>();
  const evidence = guide.evidence
    .map((entry) => {
      const citation = citationById.get(entry.id);
      if (!citation)
        throw new Error(`Missing native citation for evidence ${entry.id}`);
      if (seenCitations.has(citation.id)) return "";
      seenCitations.add(citation.id);
      const location =
        citation.sourceSectionLabel || `chunk ${entry.chunkIndex}`;
      return `<details id="evidence-${escape(citation.id)}"><summary>${escape(`${citation.citationLabel} · ${location}`)}</summary><blockquote>${escape(entry.quote)}</blockquote></details>`;
    })
    .join("");
  const payload = JSON.stringify({
    guide,
    quoteCitations: citations.map((entry) => entry.citation),
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${guide.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><title>${escape(guide.title)}</title>
<style>body{font:17px/1.7 system-ui,sans-serif;color:#182b32;background:#faf9f5;margin:0}main{max-width:960px;margin:auto;padding:32px 20px}p,blockquote{white-space:pre-wrap;overflow-wrap:anywhere}.coverage{border-left:4px solid #14695d;background:#eaf1ec;padding:12px 20px}a{color:#14695d}.kind{font-size:12px;border:1px solid #bbc;padding:2px 6px}.refs{font-size:13px}.point{margin:16px 0}details{margin:16px 0}textarea{width:95%;min-height:140px;font:inherit}svg{width:100%;max-height:900px}svg rect{fill:#eaf1ec;stroke:#14695d}svg path{fill:none;stroke:#14695d;stroke-width:2}svg .arrow{fill:#14695d}svg text{font:18px system-ui,sans-serif}math[display="block"]{overflow-x:auto}section{scroll-margin-top:16px}blockquote{border-left:3px solid #bbc;padding-left:16px}pre{white-space:pre-wrap}</style></head>
<body><main><h1>${escape(guide.title)}</h1><div class="coverage"><strong>${zh ? "实际阅读范围" : "Actual reading coverage"}</strong><p>${escape(guide.source.coverage)}</p><p>${escape(guide.source.title)}</p><p>${escape(guide.source.fingerprint || "")}</p><ul>${guide.source.missing.map((gap) => `<li>${escape(gap)}</li>`).join("")}</ul></div><nav>${guide.sections.map((section) => `<a href="#section-${escape(section.id)}">${escape(section.title)}</a>`).join(" · ")}</nav><h2>${zh ? "论文主线" : "Main thread"}</h2>${guide.thread.map(point).join("")}${sections}<details><summary>${zh ? "原文证据" : "Source evidence"}</summary>${evidence}</details><p>${zh ? "摘录匹配不证明推理正确；导览不证明掌握论文或完成复现。" : "Quote matching does not prove reasoning accuracy, mastery, or reproduction."}</p></main><script type="application/json" id="paperpilot-guide">${payload}</script><script>${SCRIPT}</script></body></html>`;
}
