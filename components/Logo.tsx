import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  className = '', 
  showText = true 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo Icon */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center shadow-lg border border-slate-700/50">
          <svg 
            width="60%" 
            height="60%" 
            viewBox="0 0 24 24" 
            fill="none" 
            className="text-green-400"
          >
            {/* Left chevron */}
            <path 
              d="M8 6L4 12L8 18" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-green-400"
            />
            {/* Vertical bar */}
            <path 
              d="M12 6V18" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              className="text-green-400"
            />
            {/* Right chevron */}
            <path 
              d="M16 6L20 12L16 18" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-green-400"
            />
          </svg>
        </div>
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-green-400/10 rounded-lg blur-sm -z-10"></div>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-white ${textSizes[size]}`}>
            Programming Helper AI
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
