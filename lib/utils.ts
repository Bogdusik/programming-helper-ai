/**
 * Format time difference in a human-readable way
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
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Format language name for display
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

