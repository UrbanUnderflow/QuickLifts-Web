import React, { useState } from 'react';

type FAQItemProps = {
  question: string;
  answer: string;
  theme?: 'light' | 'dark';
};

const FAQItem: React.FC<FAQItemProps> = ({ 
  question, 
  answer,
  theme = 'light'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMarkup = (htmlContent: string) => {
    return { __html: htmlContent };
  };

  const getThemeClasses = () => {
    if (theme === 'dark') {
      return {
        question: 'text-white',
        answer: 'text-zinc-400',
        icon: 'text-white',
        divider: 'border-zinc-800'
      };
    }
    return {
      question: 'text-gray-900',
      answer: 'text-gray-700',
      icon: 'text-gray-700',
      divider: 'border-gray-200'
    };
  };

  const themeClasses = getThemeClasses();

  return (
    <div className="mb-8">
      <button 
        className="flex justify-between items-center w-full text-left" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <p className={`text-lg font-semibold ${themeClasses.question}`}>
          {question}
        </p>
        <svg 
          className={`w-6 h-6 transform transition-transform ${isOpen ? 'rotate-180' : ''} ${themeClasses.icon}`} 
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
      <hr className={`my-2 ${themeClasses.divider}`} />
      {isOpen && (
        <div 
          className={`mt-2 ${themeClasses.answer}`}
          dangerouslySetInnerHTML={createMarkup(answer)}
        />
      )}
    </div>
  );
};

export default FAQItem;