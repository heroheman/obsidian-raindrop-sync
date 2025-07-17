// Utility zum sicheren Anzeigen von {{variable}} als HTML-Entities
export function displayCodeVar(varName: string): string {
  return `<code>&#123;&#123;${varName}&#125;&#125;</code>`;
}
