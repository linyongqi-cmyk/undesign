import type { APIRoute } from 'astro';
import { getCategories } from '../lib/content';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const categories = getCategories();
  const paths = ['', 'about/', 'contact/', ...categories.flatMap(category => {
    const list = `works/${category.slug}/`;
    return [list, ...(category.kind !== 'research' ? category.works.map(work => `${list}${work.slug}/`) : [])];
  })];
  const xml = site ? paths.map(path => {
    const url = new URL(base + path, site).href.replaceAll('&', '&amp;');
    return `<url><loc>${url}</loc></url>`;
  }).join('') : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xml}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
