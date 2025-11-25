import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

async function main() {
  console.log('Checking tasks in database...\n')
  
  const totalTasks = await prisma.programmingTask.count({
    where: { isActive: true }
  })
  
  console.log(`Total active tasks: ${totalTasks}\n`)
  
  const tasksByLanguage = await prisma.programmingTask.groupBy({
    by: ['language'],
    where: { isActive: true },
    _count: true,
    orderBy: { language: 'asc' }
  })
  
  console.log('Tasks by language:')
  for (const item of tasksByLanguage) {
    console.log(`  ${item.language}: ${item._count} tasks`)
  }
  
  // Check specific languages
  const goTasks = await prisma.programmingTask.count({
    where: { language: 'go', isActive: true }
  })
  
  const sqlTasks = await prisma.programmingTask.count({
    where: { language: 'sql', isActive: true }
  })
  
  console.log(`\nGo tasks: ${goTasks}`)
  console.log(`SQL tasks: ${sqlTasks}`)
  
  if (goTasks === 0) {
    console.log('\n⚠️  WARNING: No Go tasks found!')
  }
  if (sqlTasks === 0) {
    console.log('\n⚠️  WARNING: No SQL tasks found!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

