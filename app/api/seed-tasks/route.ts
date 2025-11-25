import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * API endpoint to seed programming tasks
 * This creates/updates tasks to ensure they exist and are active
 * 
 * Usage: POST /api/seed-tasks
 * 
 * NOTE: This is a simplified version. For full seed with all tasks,
 * run: npm run db:seed with production DATABASE_URL
 */
export async function POST() {
  try {
    logger.info('Starting task seed process...')
    
    // Critical tasks for Go and SQL (most commonly missing)
    const criticalTasks = [
      // Go tasks
      {
        title: 'Find Maximum in Array',
        description: 'Write a function that finds and returns the maximum value in a slice of integers.',
        language: 'go',
        difficulty: 'beginner',
        category: 'algorithms',
        starterCode: 'func findMax(arr []int) int {\n    // Your code here\n    return 0\n}',
        hints: ['Initialize a variable to track the maximum', 'Loop through the slice', 'Compare each element'],
        solution: 'func findMax(arr []int) int {\n    max := arr[0]\n    for i := 1; i < len(arr); i++ {\n        if arr[i] > max {\n            max = arr[i]\n        }\n    }\n    return max\n}',
      },
      {
        title: 'Reverse a String',
        description: 'Write a function that takes a string and returns it reversed.',
        language: 'go',
        difficulty: 'beginner',
        category: 'algorithms',
        starterCode: 'func reverseString(s string) string {\n    // Your code here\n    return ""\n}',
        hints: ['Convert string to rune slice', 'Reverse the slice', 'Convert back to string'],
        solution: 'func reverseString(s string) string {\n    runes := []rune(s)\n    for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {\n        runes[i], runes[j] = runes[j], runes[i]\n    }\n    return string(runes)\n}',
      },
      {
        title: 'Binary Search',
        description: 'Implement binary search to find a target value in a sorted array.',
        language: 'go',
        difficulty: 'intermediate',
        category: 'algorithms',
        starterCode: 'func binarySearch(arr []int, target int) int {\n    // Your code here\n    return -1\n}',
        hints: ['Use two pointers: left and right', 'Calculate the middle index', 'Compare target with middle element'],
        solution: 'func binarySearch(arr []int, target int) int {\n    left, right := 0, len(arr)-1\n    for left <= right {\n        mid := left + (right-left)/2\n        if arr[mid] == target {\n            return mid\n        }\n        if arr[mid] < target {\n            left = mid + 1\n        } else {\n            right = mid - 1\n        }\n    }\n    return -1\n}',
      },
      {
        title: 'Two Sum',
        description: 'Given an array of integers and a target sum, find two numbers that add up to the target.',
        language: 'go',
        difficulty: 'intermediate',
        category: 'algorithms',
        starterCode: 'func twoSum(nums []int, target int) []int {\n    // Your code here\n    return []int{}\n}',
        hints: ['Use a map to store seen numbers', 'For each number, check if complement exists', 'Return indices when complement is found'],
        solution: 'func twoSum(nums []int, target int) []int {\n    m := make(map[int]int)\n    for i, num := range nums {\n        complement := target - num\n        if idx, ok := m[complement]; ok {\n            return []int{idx, i}\n        }\n        m[num] = i\n    }\n    return []int{}\n}',
      },
      {
        title: 'Check Palindrome',
        description: 'Write a function that checks if a string is a palindrome.',
        language: 'go',
        difficulty: 'intermediate',
        category: 'algorithms',
        starterCode: 'func isPalindrome(s string) bool {\n    // Your code here\n    return false\n}',
        hints: ['Remove spaces and convert to lowercase', 'Compare characters from both ends'],
        solution: 'func isPalindrome(s string) bool {\n    cleaned := strings.ToLower(strings.ReplaceAll(s, " ", ""))\n    runes := []rune(cleaned)\n    for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {\n        if runes[i] != runes[j] {\n            return false\n        }\n    }\n    return true\n}',
      },
      {
        title: 'Merge Sorted Arrays',
        description: 'Merge two sorted arrays into one sorted array without using built-in sort methods.',
        language: 'go',
        difficulty: 'advanced',
        category: 'algorithms',
        starterCode: 'func mergeSortedArrays(arr1, arr2 []int) []int {\n    // Your code here\n    return []int{}\n}',
        hints: ['Use two pointers, one for each array', 'Compare elements and add smaller one to result', 'Handle remaining elements after one array is exhausted'],
        solution: 'func mergeSortedArrays(arr1, arr2 []int) []int {\n    result := make([]int, 0, len(arr1)+len(arr2))\n    i, j := 0, 0\n    for i < len(arr1) && j < len(arr2) {\n        if arr1[i] < arr2[j] {\n            result = append(result, arr1[i])\n            i++\n        } else {\n            result = append(result, arr2[j])\n            j++\n        }\n    }\n    result = append(result, arr1[i:]...)\n    result = append(result, arr2[j:]...)\n    return result\n}',
      },
      {
        title: 'Count Vowels',
        description: 'Write a function that counts the number of vowels (a, e, i, o, u) in a given string.',
        language: 'go',
        difficulty: 'beginner',
        category: 'algorithms',
        starterCode: 'func countVowels(s string) int {\n    // Your code here\n    return 0\n}',
        hints: ['Convert string to lowercase for case-insensitive matching', 'Loop through each character', 'Check if character is a vowel'],
        solution: 'func countVowels(s string) int {\n    vowels := "aeiou"\n    count := 0\n    for _, char := range strings.ToLower(s) {\n        if strings.ContainsRune(vowels, char) {\n            count++\n        }\n    }\n    return count\n}',
      },
      // SQL tasks
      {
        title: 'Find Maximum Value',
        description: 'Write a SQL query to find the maximum value in a column.',
        language: 'sql',
        difficulty: 'beginner',
        category: 'algorithms',
        starterCode: 'SELECT -- Your code here\nFROM table_name;',
        hints: ['Use MAX() aggregate function', 'Specify the column name'],
        solution: 'SELECT MAX(column_name) FROM table_name;',
      },
      {
        title: 'Count Records',
        description: 'Write a SQL query to count the number of records in a table.',
        language: 'sql',
        difficulty: 'beginner',
        category: 'algorithms',
        starterCode: 'SELECT -- Your code here\nFROM table_name;',
        hints: ['Use COUNT() aggregate function', 'Use * to count all rows'],
        solution: 'SELECT COUNT(*) FROM table_name;',
      },
      {
        title: 'Filter Records',
        description: 'Write a SQL query to select records where a column value is greater than a threshold.',
        language: 'sql',
        difficulty: 'intermediate',
        category: 'algorithms',
        starterCode: 'SELECT * FROM table_name\n-- Your code here;',
        hints: ['Use WHERE clause', 'Use comparison operator >'],
        solution: 'SELECT * FROM table_name WHERE column_name > 100;',
      },
      {
        title: 'Join Tables',
        description: 'Write a SQL query to join two tables on a common column.',
        language: 'sql',
        difficulty: 'intermediate',
        category: 'algorithms',
        starterCode: 'SELECT * FROM table1\n-- Your code here\n-- Your code here;',
        hints: ['Use JOIN keyword', 'Specify ON condition with matching columns'],
        solution: 'SELECT * FROM table1 JOIN table2 ON table1.id = table2.id;',
      },
      {
        title: 'Group and Aggregate',
        description: 'Write a SQL query to group records by a column and calculate the average of another column.',
        language: 'sql',
        difficulty: 'advanced',
        category: 'algorithms',
        starterCode: 'SELECT -- Your code here\nFROM table_name\n-- Your code here;',
        hints: ['Use GROUP BY clause', 'Use AVG() aggregate function'],
        solution: 'SELECT category, AVG(price) FROM table_name GROUP BY category;',
      },
      {
        title: 'Subquery',
        description: 'Write a SQL query using a subquery to find records with values above the average.',
        language: 'sql',
        difficulty: 'advanced',
        category: 'algorithms',
        starterCode: 'SELECT * FROM table_name\nWHERE column_name -- Your code here;',
        hints: ['Use WHERE clause with comparison', 'Use subquery with AVG()'],
        solution: 'SELECT * FROM table_name WHERE column_name > (SELECT AVG(column_name) FROM table_name);',
      },
    ]
    
    let created = 0
    let updated = 0
    
    // Seed critical tasks
    for (const task of criticalTasks) {
      const taskId = `task-${task.language}-${task.title.toLowerCase().replace(/\s/g, '-')}`
      try {
        const existing = await db.programmingTask.findUnique({
          where: { id: taskId }
        })
        
        if (existing) {
          // Update existing task to ensure it's active
          await db.programmingTask.update({
            where: { id: taskId },
            data: {
              isActive: true,
              title: task.title,
              description: task.description,
              language: task.language,
              difficulty: task.difficulty,
              category: task.category,
              starterCode: task.starterCode,
              hints: task.hints,
              solution: task.solution,
            }
          })
          updated++
        } else {
          // Create new task
          await db.programmingTask.create({
            data: {
              id: taskId,
              title: task.title,
              description: task.description,
              language: task.language,
              difficulty: task.difficulty,
              category: task.category,
              starterCode: task.starterCode,
              hints: task.hints,
              solution: task.solution,
              isActive: true,
            }
          })
          created++
        }
      } catch (error) {
        logger.error(`Error seeding task ${taskId}`, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Also activate all existing tasks
    const activationResult = await db.programmingTask.updateMany({
      where: { isActive: false },
      data: { isActive: true }
    })
    
    // Verify tasks
    const taskCount = await db.programmingTask.count({
      where: { isActive: true }
    })
    
    const tasksByLanguage = await db.programmingTask.groupBy({
      by: ['language'],
      where: { isActive: true },
      _count: true
    })
    
    const languageCounts = tasksByLanguage.reduce((acc, item) => {
      acc[item.language] = item._count
      return acc
    }, {} as Record<string, number>)
    
    logger.info('Task seed completed', undefined, {
      created,
      updated,
      activated: activationResult.count,
      totalTasks: taskCount,
      languageCounts
    })
    
    return NextResponse.json({
      success: true,
      message: `Tasks seeded: ${created} created, ${updated} updated, ${activationResult.count} activated. Total active: ${taskCount}`,
      created,
      updated,
      activated: activationResult.count,
      totalTasks: taskCount,
      tasksByLanguage: languageCounts,
      note: 'For full seed with ALL tasks (114 total), run: npm run db:seed with production DATABASE_URL'
    })
  } catch (error) {
    logger.error('Error seeding tasks', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
