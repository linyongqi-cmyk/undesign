// Keep playback policy consistent across standalone and grouped videos.
export function videoEmbedSource(value = '') {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (['youtu.be', 'youtube.com', 'm.youtube.com'].includes(host)) {
      const id = host === 'youtu.be' ? parsed.pathname.split('/').filter(Boolean)[0] : parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}?autoplay=0` : '';
    }
    if (host === 'bilibili.com') {
      const id = parsed.pathname.match(/\/(BV[0-9A-Za-z]+|av\d+)/i)?.[1];
      if (!id) return '';
      const source = new URL('https://player.bilibili.com/player.html');
      source.searchParams.set(id.toLowerCase().startsWith('bv') ? 'bvid' : 'aid', id.toLowerCase().startsWith('bv') ? id : id.slice(2));
      source.searchParams.set('autoplay', '0');
      source.searchParams.set('poster', '1');
      const page = Number(parsed.searchParams.get('p'));
      if (Number.isInteger(page) && page > 0) source.searchParams.set('p', String(page));
      return source.href;
    }
  } catch {}
  return '';
}
