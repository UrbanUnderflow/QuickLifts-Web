import React from 'react';
import FAQItem from './FAQItem';

interface FAQItemType {
  question: string;
  answer: string;
}

interface FAQProps {
  title?: string;
  items: FAQItemType[];
  theme?: 'light' | 'dark';
}

const FAQ: React.FC<FAQProps> = ({ 
  title = "Frequently Asked Questions", 
  items,
  theme = 'dark'  // Changed default to dark
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-start p-5 sm:p-20 justify-center mx-auto ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
      <div className="sm:mr-8 mt-8">
        {/* Icon Container with accent color border */}
        <div className={`rounded-full p-6 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
          <img 
            src={isDark ? "/findOutMore-white.svg" : "/findOutMore.svg"} 
            alt="Find Out More" 
            className="w-16 h-16" 
          />
        </div>
      </div>
      <div className="mt-8 max-w-3xl w-full">
        {/* Title with accent color */}
        <span className={`text-sm font-semibold uppercase tracking-wider mb-2 block ${isDark ? 'text-[#E0FE10]' : 'text-orange-500'}`}>
          Support
        </span>
        <h2 className={`text-4xl font-bold mb-10 ${isDark ? 'text-white' : 'text-black'}`}>
          {title.split(' ').map((word, index) => (
            <React.Fragment key={index}>
              {word}
              {index < title.split(' ').length - 1 && <br />}
            </React.Fragment>
          ))}
        </h2>
        
        {/* FAQ Items Container */}
        <div className="space-y-6">
          {items.map((faqItem, index) => (
            <FAQItem 
              key={index} 
              question={faqItem.question} 
              answer={faqItem.answer}
              theme={theme}
              isLast={index === items.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;