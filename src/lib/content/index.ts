import about from '../../data/content/about.json';
import categories from '../../data/content/categories.json';
import contact from '../../data/content/contact.json';
import site from '../../data/content/site.json';
import type { AboutProfile, Category, ContactSettings, SiteSettings, Work } from './types';

const workFiles = import.meta.glob<Work>('../../data/content/works/**/*.json', {
  eager: true,
  import: 'default',
});

const allWorks = Object.values(workFiles);

export function getSiteSettings(): SiteSettings {
  return site as SiteSettings;
}

export function getAboutProfile(): AboutProfile {
  return about as AboutProfile;
}

export function getContactSettings(): ContactSettings {
  return contact as ContactSettings;
}

export function getCategories(): Category[] {
  return categories
    .toSorted((a, b) => a.order - b.order)
    .map((category) => ({
      ...category,
      works: allWorks
        .filter((work) => work.category === category.slug)
        .sort((a, b) => a.order - b.order),
    })) as Category[];
}

