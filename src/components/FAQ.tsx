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
  theme = 'light' 
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start p-5 sm:p-20 justify-center mx-auto">
      <div className="sm:mr-8 mt-8">
        <img 
          src={theme === 'dark' ? "/findOutMore-white.svg" : "/findOutMore.svg"} 
          alt="Find Out More" 
          className="w-20 h-20" 
        />
      </div>
      <div className="mt-8">
        <h2 className={`text-4xl font-bold mb-10 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {title.split(' ').map((word, index) => (
            <React.Fragment key={index}>
              {word}<br />
            </React.Fragment>
          ))}
        </h2>
        {items.map((faqItem, index) => (
          <FAQItem 
            key={index} 
            question={faqItem.question} 
            answer={faqItem.answer}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
};

export default FAQ;