import React from 'react';
import FAQItem from './FAQItem'; // Adjust import path as needed

interface FAQItemType {
  question: string;
  answer: string;
}

interface FAQProps {
  title?: string;
  items: FAQItemType[];
}

const FAQ: React.FC<FAQProps> = ({ title = "Frequently Asked Questions", items }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start p-5 sm:p-20 justify-center mx-auto">
      <div className="sm:mr-8 mt-8">
        <img src="/findOutMore.svg" alt="Find Out More" className="w-20 h-20" />
      </div>
      <div className="mt-8">
        <h2 className="text-4xl font-bold mb-10">{title.split(' ').map((word, index) => (
          <React.Fragment key={index}>
            {word}<br />
          </React.Fragment>
        ))}</h2>
        {items.map((faqItem, index) => (
          <FAQItem key={index} question={faqItem.question} answer={faqItem.answer} />
        ))}
      </div>
    </div>
  );
};

export default FAQ;
