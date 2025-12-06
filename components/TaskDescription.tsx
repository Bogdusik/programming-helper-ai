'use client'

interface Example {
  input: string | Record<string, any>
  output: string | any
  explanation?: string
}

interface TaskDescriptionProps {
  title: string
  description: string
  language: string
  difficulty: string
  category: string
  hints?: string[]
  starterCode?: string | null
  examples?: Example[] | null
  constraints?: string[] | null
}

export default function TaskDescription({
  title,
  description,
  language,
  difficulty,
  category,
  hints,
  starterCode,
  examples,
  constraints,
}: TaskDescriptionProps) {
  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'beginner':
        return 'text-green-400 bg-green-400/20'
      case 'intermediate':
        return 'text-yellow-400 bg-yellow-400/20'
      case 'advanced':
        return 'text-red-400 bg-red-400/20'
      default:
        return 'text-blue-400 bg-blue-400/20'
    }
  }

  const formatValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 text-gray-200">
      {/* Title and Tags */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">{title}</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full capitalize">
            {language}
          </span>
          <span className={`px-3 py-1 text-sm rounded-full capitalize ${getDifficultyColor(difficulty)}`}>
            {difficulty}
          </span>
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full capitalize">
            {category}
          </span>
        </div>
      </div>

      {/* Problem Statement */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Problem Statement</h2>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-300">
          {description}
        </div>
      </div>

      {/* Examples */}
      {examples && examples.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Examples</h2>
          <div className="space-y-4">
            {examples.map((example, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-400">Example {index + 1}:</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400 font-medium">Input: </span>
                    <code className="text-green-300 bg-gray-900/50 px-2 py-1 rounded">
                      {formatValue(example.input)}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">Output: </span>
                    <code className="text-blue-300 bg-gray-900/50 px-2 py-1 rounded">
                      {formatValue(example.output)}
                    </code>
                  </div>
                  {example.explanation && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <span className="text-gray-400 font-medium">Explanation: </span>
                      <span className="text-gray-300">{example.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {constraints && constraints.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Constraints</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            {constraints.map((constraint, index) => (
              <li key={index} className="ml-2">
                <code className="text-orange-300">{constraint}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints */}
      {hints && hints.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Hints</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            {hints.map((hint, index) => (
              <li key={index} className="ml-2">{hint}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Starter Code */}
      {starterCode && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Starter Code</h2>
          <pre className="bg-gray-900/70 rounded-lg p-4 overflow-x-auto border border-gray-700">
            <code className="text-sm text-gray-200 font-mono">{starterCode}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

