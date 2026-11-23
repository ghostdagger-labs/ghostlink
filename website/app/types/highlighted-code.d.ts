declare module 'virtual:ghostlink-code' {
  export interface CodeToken { content: string; color?: string }
  export const snippets: Record<'TypeScript' | 'Vue' | 'React' | 'Node', { file: string; tokens: CodeToken[] }>;
  export const installCommands: Record<'Vue' | 'React' | 'TypeScript' | 'server', CodeToken[]>;
}
