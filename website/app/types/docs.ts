export interface DocsHeading { id: string; text: string; depth: number }
export interface DocsMeta {
  slug: string; label: string; group: string; source: string; path: string;
  title: string; titleId: string; description: string; updated: string; readingMinutes: number;
}
export interface DocsPage extends DocsMeta {
  html: string; raw: string; bytes: number; toc: DocsHeading[];
  previous: Pick<DocsMeta, 'path' | 'label'> | null;
  next: Pick<DocsMeta, 'path' | 'label'> | null;
}
export interface DocsCatalog { pages: DocsMeta[] }
