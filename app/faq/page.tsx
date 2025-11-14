'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqData: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I get started with Programming Helper AI?',
    answer: 'Getting started is easy! Simply sign up for an account, complete the onboarding process, and take the pre-assessment to help us understand your programming level. Then you can start chatting with the AI assistant right away. The system will guide you through selecting your preferred programming languages and setting up your profile.'
  },
  {
    category: 'Getting Started',
    question: 'Do I need to create an account to use the service?',
    answer: 'Yes, you need to create an account to use Programming Helper AI. This allows us to save your progress, track your learning journey, and provide personalized assistance. Your account is free and takes just a few minutes to set up.'
  },
  {
    category: 'Getting Started',
    question: 'What is the pre-assessment and why should I take it?',
    answer: 'The pre-assessment is a quick evaluation that helps us understand your current programming knowledge level. It allows the AI to provide more accurate and personalized responses tailored to your skill level. The assessment is optional but highly recommended for the best experience.'
  },

  // Chat & AI Assistant
  {
    category: 'Chat & AI Assistant',
    question: 'How does the AI programming assistant work?',
    answer: 'Our AI assistant uses advanced language models to understand your programming questions and provide helpful responses. You can ask about code syntax, debugging, algorithms, best practices, or any programming-related topic. The assistant adapts to your skill level and preferred programming languages.'
  },
  {
    category: 'Chat & AI Assistant',
    question: 'What types of questions can I ask?',
    answer: 'You can ask a wide variety of programming questions, including: code explanations, debugging help, algorithm design, syntax questions, best practices, code reviews, learning new concepts, and more. The assistant can help with multiple programming languages that you\'ve selected in your profile.'
  },
  {
    category: 'Chat & AI Assistant',
    question: 'How do I start a new chat session?',
    answer: 'To start a new chat session, simply go to the Chat page and begin typing your question. The system will automatically create a new session for you. You can also view and manage your previous chat sessions in the sidebar.'
  },
  {
    category: 'Chat & AI Assistant',
    question: 'Can I save my chat conversations?',
    answer: 'Yes! All your chat conversations are automatically saved. You can access them anytime from the chat sidebar, where you\'ll see a list of all your previous sessions. Each session is saved with a title based on your first message.'
  },
  {
    category: 'Chat & AI Assistant',
    question: 'How accurate are the AI responses?',
    answer: 'Our AI assistant is trained on a vast amount of programming knowledge and provides accurate responses. However, we always recommend reviewing and testing any code suggestions before using them in production. The assistant is designed to help you learn and understand, not replace your judgment.'
  },

  // Programming Languages
  {
    category: 'Programming Languages',
    question: 'How do I select my preferred programming languages?',
    answer: 'You can select your preferred programming languages in the Chat page using the Language Selector component. Choose multiple languages you want to work with, and set one as your primary language. The AI will prioritize these languages when providing assistance.'
  },
  {
    category: 'Programming Languages',
    question: 'Can I change my primary language later?',
    answer: 'Yes, you can change your primary language at any time. Simply go to the Chat page, use the Language Selector, and click "Set as Primary" on any language you want to make primary. The change takes effect immediately.'
  },
  {
    category: 'Programming Languages',
    question: 'Which programming languages are supported?',
    answer: 'Programming Helper AI supports a wide range of popular programming languages including Python, JavaScript, TypeScript, Java, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, and more. You can select any combination of languages that you want to work with.'
  },
  {
    category: 'Programming Languages',
    question: 'How does language selection affect the AI responses?',
    answer: 'When you select specific languages, the AI assistant will tailor its responses to those languages. It will use appropriate syntax, suggest language-specific best practices, and provide examples in your preferred languages. Your primary language gets the highest priority.'
  },

  // Tasks & Practice
  {
    category: 'Tasks & Practice',
    question: 'What are programming tasks?',
    answer: 'Programming tasks are coding challenges designed to help you practice and improve your skills. Each task includes a description, difficulty level, and may include starter code and hints. Tasks are categorized by language, difficulty, and topic (algorithms, data structures, syntax, etc.).'
  },
  {
    category: 'Tasks & Practice',
    question: 'How do I complete a task?',
    answer: 'To complete a task, go to the Tasks page, select a task that interests you, and click "Start Task". You can work on the task in the chat with the AI assistant, and when you\'re done, click "Mark Complete" to record your progress.'
  },
  {
    category: 'Tasks & Practice',
    question: 'Do tasks affect my statistics?',
    answer: 'Yes! Completing tasks contributes to your overall statistics. Each completed task increases your "Tasks Completed" count and updates your language-specific progress. This helps track your learning journey and is required for post-assessment eligibility.'
  },
  {
    category: 'Tasks & Practice',
    question: 'Can I retry a task if I make a mistake?',
    answer: 'Yes, you can attempt tasks multiple times. The system tracks your attempts, and you can mark a task as complete when you\'re satisfied with your solution. There\'s no limit on how many times you can work on a task.'
  },

  // Statistics & Progress
  {
    category: 'Statistics & Progress',
    question: 'What statistics are tracked?',
    answer: 'The system tracks various statistics including: questions asked, average response time, tasks completed, days active, language-specific progress (questions asked and tasks completed per language), and your improvement score based on pre and post-assessments.'
  },
  {
    category: 'Statistics & Progress',
    question: 'How do I view my progress?',
    answer: 'You can view your progress on the Statistics page (/stats). This page shows your overall statistics, language-specific progress, assessment results, and eligibility for the post-assessment. The Progress Dashboard provides a comprehensive view of your learning journey.'
  },
  {
    category: 'Statistics & Progress',
    question: 'What is the improvement score?',
    answer: 'The improvement score is calculated by comparing your pre-assessment and post-assessment results. It shows how much you\'ve improved since you started using Programming Helper AI. A higher score indicates greater improvement in your programming knowledge.'
  },
  {
    category: 'Statistics & Progress',
    question: 'How is language progress calculated?',
    answer: 'Language progress is tracked separately for each programming language you use. It includes the number of questions you\'ve asked about that language and the number of tasks you\'ve completed in that language. Only languages you\'ve explicitly selected are shown in your statistics.'
  },

  // Assessments
  {
    category: 'Assessments',
    question: 'What is the difference between pre and post-assessment?',
    answer: 'The pre-assessment is taken when you first start using the service to establish your baseline knowledge. The post-assessment is taken after you\'ve been active for a while (meeting certain criteria) to measure your improvement. Both help personalize your learning experience.'
  },
  {
    category: 'Assessments',
    question: 'When can I take the post-assessment?',
    answer: 'You can take the post-assessment once you meet the eligibility requirements: being active for at least 7 days, asking at least 20 questions, and completing at least 5 tasks. Check your Statistics page to see your progress toward eligibility.'
  },
  {
    category: 'Assessments',
    question: 'What happens if I don\'t meet the post-assessment requirements?',
    answer: 'If you don\'t meet the requirements yet, you can see your progress on the Statistics page. The system shows you exactly how many days active, questions asked, and tasks completed you need to become eligible. Keep using the service to unlock the post-assessment!'
  },
  {
    category: 'Assessments',
    question: 'Can I retake assessments?',
    answer: 'Currently, each assessment can only be taken once. The pre-assessment establishes your baseline, and the post-assessment measures your improvement. This ensures accurate tracking of your learning progress over time.'
  },

  // Technical & Troubleshooting
  {
    category: 'Technical & Troubleshooting',
    question: 'The page is not loading or responding. What should I do?',
    answer: 'Try refreshing the page first. If the problem persists, check your internet connection, clear your browser cache, or try using a different browser. If issues continue, please contact us through the Contact Us page with details about the problem.'
  },
  {
    category: 'Technical & Troubleshooting',
    question: 'My statistics are not updating. Is this normal?',
    answer: 'Statistics typically update in real-time, but there may be a slight delay. If your statistics haven\'t updated after several minutes, try refreshing the page. If the issue persists, please contact support.'
  },
  {
    category: 'Technical & Troubleshooting',
    question: 'Can I use Programming Helper AI on mobile devices?',
    answer: 'Yes! Programming Helper AI is responsive and works on mobile devices, tablets, and desktops. The interface adapts to your screen size for the best experience on any device.'
  },
  {
    category: 'Technical & Troubleshooting',
    question: 'What browsers are supported?',
    answer: 'Programming Helper AI works best on modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version of your browser for the best experience and security.'
  },

  // Privacy & Security
  {
    category: 'Privacy & Security',
    question: 'Is my code and data secure?',
    answer: 'Yes, we take security and privacy seriously. Your code and conversations are stored securely, and we follow industry best practices for data protection. For more details, please review our Privacy Policy page.'
  },
  {
    category: 'Privacy & Security',
    question: 'Is my personal information shared with third parties?',
    answer: 'No, we do not share your personal information with third parties. Your data is used only to provide and improve the service. For complete details, please see our Privacy Policy.'
  },
  {
    category: 'Privacy & Security',
    question: 'Can I delete my account and data?',
    answer: 'Yes, you can request account deletion at any time by contacting us through the Contact Us page. We will process your request and delete your data in accordance with our Privacy Policy.'
  },

  // Account & Billing
  {
    category: 'Account & Billing',
    question: 'Is Programming Helper AI free to use?',
    answer: 'Yes, Programming Helper AI is currently free to use. You can create an account, use all features, and access the AI assistant without any cost. We may introduce premium features in the future, but the core functionality will remain free.'
  },
  {
    category: 'Account & Billing',
    question: 'How do I update my profile information?',
    answer: 'You can update your profile information, including your experience level, learning goals, and confidence level, through the profile modal that appears when you first use the chat or by accessing it through your account settings.'
  },
  {
    category: 'Account & Billing',
    question: 'I forgot my password. How do I reset it?',
    answer: 'If you\'re using Clerk authentication, you can reset your password through the sign-in page. Click "Forgot password" and follow the instructions sent to your email address.'
  },

  // General
  {
    category: 'General',
    question: 'How can I provide feedback or report a bug?',
    answer: 'We welcome your feedback! You can contact us through the Contact Us page. Select "Feedback" or "Report a Bug" as the subject, and we\'ll get back to you as soon as possible. Your input helps us improve the service!'
  },
  {
    category: 'General',
    question: 'Where can I find the Terms of Service and Privacy Policy?',
    answer: 'You can find our Terms of Service and Privacy Policy in the footer of every page, or by visiting /terms and /privacy directly. These documents outline how we handle your data and the terms of using our service.'
  },
  {
    category: 'General',
    question: 'How quickly will I receive a response when I contact support?',
    answer: 'We typically respond to support inquiries within 24-48 hours. For urgent issues, please clearly mark them as urgent in your message, and we\'ll prioritize your request.'
  }
]

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  
  const categories = ['All', ...Array.from(new Set(faqData.map(item => item.category)))]
  
  const filteredFAQs = selectedCategory === 'All' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory)
  
  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <MinimalBackground />

      <div className="relative pt-20 pb-16 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Find answers to common questions about Programming Helper AI. 
              Can't find what you're looking for? <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline transition-colors">Contact us</Link>.
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-8 flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="space-y-4">
            {filteredFAQs.map((item, index) => {
              const globalIndex = faqData.findIndex(faq => faq === item)
              const isOpen = openItems.has(globalIndex)
              
              return (
                <div
                  key={globalIndex}
                  className="glass rounded-xl border border-white/10 overflow-hidden transition-all duration-200 hover:border-white/20"
                >
                  <button
                    onClick={() => toggleItem(globalIndex)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-semibold text-blue-400/70 uppercase tracking-wide">
                          {item.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {item.question}
                      </h3>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <svg
                        className={`w-5 h-5 text-white/60 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>
                  
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-6 pb-4">
                      <p className="text-white/80 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Still have questions */}
          <div className="mt-12 glass rounded-2xl p-8 border border-white/10 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Still have questions?
            </h2>
            <p className="text-white/70 mb-6">
              Can't find the answer you're looking for? Please get in touch with our friendly team.
            </p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

