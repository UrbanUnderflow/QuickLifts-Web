import React, { useState } from 'react';

type FAQItemProps = {
  question: string;
  answer: string;
  theme?: 'light' | 'dark';
  isLast?: boolean;
};

const FAQItem: React.FC<FAQItemProps> = ({ 
  question, 
  answer,
  theme = 'dark',
  isLast = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMarkup = (htmlContent: string) => {
    return { __html: htmlContent };
  };

  const getThemeClasses = () => {
    if (theme === 'dark') {
      return {
        question: 'text-white hover:text-[#E0FE10]',
        answer: 'text-zinc-400',
        icon: 'text-[#E0FE10]',
        divider: 'border-zinc-800'
      };
    }
    return {
      question: 'text-gray-900 hover:text-orange-500',
      answer: 'text-gray-700',
      icon: 'text-orange-500',
      divider: 'border-gray-200'
    };
  };

  const themeClasses = getThemeClasses();

  return (
    <div className={`${!isLast ? 'border-b' : ''} ${themeClasses.divider}`}>
      <button 
        className="flex justify-between items-start w-full text-left py-6 transition-colors duration-200" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <p className={`text-lg font-medium pr-8 transition-colors duration-200 ${themeClasses.question}`}>
          {question}
        </p>
        <svg 
          className={`w-6 h-6 flex-shrink-0 transform transition-all duration-300 ${isOpen ? 'rotate-180' : ''} ${themeClasses.icon}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div 
          className={`pb-6 pr-8 ${themeClasses.answer}`}
          dangerouslySetInnerHTML={createMarkup(answer)}
        />
      </div>
    </div>
  );
};

export default FAQItem;