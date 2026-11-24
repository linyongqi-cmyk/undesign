// The browser inserts a block for Enter and a <br> for Shift+Enter.
export function focusParagraphEditor(editor) {
  editor.focus();
  editor.ownerDocument.execCommand('defaultParagraphSeparator', false, 'p');
}

export function pasteEditorText(event) {
  event.preventDefault();
  event.currentTarget.ownerDocument.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
}

export function readEditorParagraphs(editor) {
  const paragraphs = [];
  let inline = [];

  function readLine(nodes) {
    return nodes.map((node, index) => {
      // A trailing break keeps the caret on an empty line in contenteditable.
      if (node.nodeName === 'BR') return index === nodes.length - 1 ? '' : '\n';
      return node.textContent;
    }).join('');
  }

  for (const node of editor.childNodes) {
    if (node.nodeName === 'P' || node.nodeName === 'DIV') {
      if (inline.length) paragraphs.push(readLine(inline));
      inline = [];
      paragraphs.push(readLine([...node.childNodes]));
    } else {
      inline.push(node);
    }
  }
  if (inline.length && (inline.length > 1 || inline[0].nodeName !== 'BR')) {
    paragraphs.push(readLine(inline));
  }
  return paragraphs;
}

export function writeEditorParagraphs(editor, paragraphs) {
  const document = editor.ownerDocument;
  editor.replaceChildren(...(paragraphs.length ? paragraphs : ['']).map((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    if (!text || text.endsWith('\n')) paragraph.append(document.createElement('br'));
    return paragraph;
  }));
}
