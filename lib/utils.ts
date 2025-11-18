/**
 * Format time difference in a human-readable way
 * @param timestamp - Date or timestamp to format
 * @returns Human-readable time string (e.g., "Just now", "5m ago", "2h ago")
 */
export function formatTimeAgo(timestamp: number | Date): string {
  const now = new Date()
  const time = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000)
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

/**
 * Format date in a readable format
 * @param date - Date to format
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

/**
 * Capitalize first letter of a string
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Format language name for display
 * @param lang - Language identifier (e.g., "javascript", "csharp")
 * @returns Formatted language name (e.g., "JavaScript", "C#")
 */
export function formatLanguageName(lang: string): string {
  const langMap: Record<string, string> = {
    csharp: 'C#',
    cpp: 'C++',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  }
  
  return langMap[lang.toLowerCase()] || capitalize(lang)
}

/**
 * Escape HTML to prevent XSS attacks
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

