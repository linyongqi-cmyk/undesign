function paragraphTexts(block) {
  if (block?.kind !== 'paragraph') return [];
  return (Array.isArray(block.text) ? block.text : [block.text]).map((text) => String(text || '').trim()).filter(Boolean);
}

function contentBlockTexts(block) {
  if (['componentGroup', 'layoutGroup'].includes(block?.kind)) return [...(block.items || []), ...(block.sideItems || [])].flatMap(contentBlockTexts);
  if (Array.isArray(block?.text)) return block.text;
  return typeof block?.text === 'string' ? [block.text] : [];
}

export function researchArticleLanguage(work = {}) {
  if (work.articleLanguage === 'ja' || work.articleLanguage === 'zh') return work.articleLanguage;
  if (/\bchinese\b|中文/i.test(work.title || '')) return 'zh';
  const text = workBodySections(work).flatMap(contentBlockTexts).join(' ');
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\u3400-\u9fff]/.test(text)) return 'zh';
  return 'ja';
}

export function workBodySections(work = {}) {
  const sections = Array.isArray(work.sections) ? work.sections : [];
  const paragraphs = String(work.description || '').split(/\n+/).map((text) => text.trim()).filter(Boolean);
  const body = [];
  if (paragraphs.length) {
    const legacyCopyAlreadyInSections = sections.some((block) => {
      const texts = paragraphTexts(block);
      return texts.length === paragraphs.length && texts.every((text, index) => text === paragraphs[index]);
    });
    if (!legacyCopyAlreadyInSections) body.push({ kind: 'paragraph', text: paragraphs });
  }
  const hasSpecifications = sections.some((block) => block?.kind === 'specifications');
  if (!hasSpecifications && [work.dimensions, work.material, work.date].some(Boolean)) {
    body.push({ kind: 'specifications', items: [
      { label: 'dimensions', value: work.dimensions || '' },
      { label: 'material', value: work.material || '' },
      { label: 'date', value: work.date || '' },
    ] });
  }
  return [...body, ...sections];
}
