'use client'

import { useState, useRef, memo } from 'react'

interface ViteStyleCardProps {
  title: string
  description: string
  icon: React.ReactNode
  gradient: string
  codeExample?: string
  features?: string[]
  className?: string
}

const ViteStyleCard = memo(function ViteStyleCard({ 
  title, 
  description, 
  icon, 
  gradient, 
  codeExample,
  features,
  className = '' 
}: ViteStyleCardProps) {
  const [, setIsHovered] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
  }

  return (
    <div
      ref={cardRef}
      className={`relative group cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Main card */}
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10">
        
        {/* Animated gradient overlay */}
        <div 
          className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${gradient}`}
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.1) 0%, transparent 50%)`
          }}
        />
        
        {/* Icon with unique programming effect */}
        <div className="relative mb-6">
          <div className={`inline-flex items-center justify-center p-4 rounded-2xl shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${gradient}`}>
            {icon}
          </div>
          
          {/* Unique programming particles effect */}
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 animate-pulse" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="absolute top-1/2 -right-3 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-600 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Title with typing effect */}
        <h3 className="text-xl font-bold text-white mb-4 group-hover:text-green-400 transition-colors duration-300">
          {title}
        </h3>

        {/* Description */}
        <p className="text-white/70 leading-relaxed mb-6 group-hover:text-white/90 transition-colors duration-300">
          {description}
        </p>

        {/* Code example with syntax highlighting */}
        {codeExample && (
          <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm border border-slate-700/50 group-hover:border-green-500/30 transition-colors duration-300">
            <div className="text-green-400">{codeExample}</div>
          </div>
        )}

        {/* Features list with animated bullets */}
        {features && (
          <div className="mt-6 space-y-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3 group-hover:translate-x-2 transition-transform duration-300" style={{ transitionDelay: `${index * 100}ms` }}>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors duration-300">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Unique programming-themed border effect */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-gradient-to-r group-hover:from-green-400/30 group-hover:via-blue-400/30 group-hover:to-purple-400/30 transition-all duration-500" />
        
        {/* Animated corner accents */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-green-400/0 group-hover:border-green-400/50 rounded-tr-2xl transition-all duration-500" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400/0 group-hover:border-blue-400/50 rounded-bl-2xl transition-all duration-500" />
        
        {/* Floating code symbols on hover */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute top-4 right-4 text-green-400/0 group-hover:text-green-400/30 text-xs font-mono transition-all duration-500">
            {'</>'}
          </div>
          <div className="absolute bottom-4 left-4 text-blue-400/0 group-hover:text-blue-400/30 text-xs font-mono transition-all duration-700" style={{ transitionDelay: '0.2s' }}>
            {'{}'}
          </div>
          <div className="absolute top-1/2 right-6 text-purple-400/0 group-hover:text-purple-400/30 text-xs font-mono transition-all duration-600" style={{ transitionDelay: '0.4s' }}>
            {'[]'}
          </div>
        </div>
      </div>

      {/* Unique glow effect */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl -z-10`} />
    </div>
  )
})

export default ViteStyleCard
