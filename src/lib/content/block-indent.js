export function blockIndentValue(block = {}) {
  const count = Number(block.blockIndent) || 0;
  const size = Number(block.blockIndentSize);
  return size > 0 ? `${count * size}px` : `${count}ic`;
}
