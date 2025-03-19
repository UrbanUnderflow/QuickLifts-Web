import React from 'react';

// Define the types for the props
interface SubscriptionCardProps {
  price: string;
  period: string;
  description: string;
  titleColor: string;
  textColor?: string;
  backgroundColor?: string;
  actionText?: string;
  actionBgColor?: string;
  actionTextColor?: string;
  onActionClick?: () => void; // New prop to handle button clicks
}

// Functional Component
const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  price,
  period,
  description,
  titleColor = 'text-black',
  textColor = 'text-black',
  backgroundColor = 'bg-neutral-100',
  actionText,
  actionBgColor = 'bg-neutral-800',
  actionTextColor = 'text-white',
  onActionClick, // Destructured prop
}) => {
  return (
    <div className={`max-w-[400px] h-auto sm:h-[336px] ${backgroundColor} rounded-[27px] p-6 flex flex-col gap-4`}>
      {/* Price */}
      <div className={`${titleColor} text-[64px] sm:text-[90.72px] font-medium font-['Thunder'] leading-[90px] sm:leading-[118.29px]`}>{`${price}/${period}`}</div>

      {/* Plan Description */}
      <div className={`${textColor} w-full text-xl font-medium font-['HK Grotesk']`}>{description}</div>

      {/* Call to Action */}
      <button
        className={`w-full py-[13.65px] ${actionBgColor} rounded-lg flex justify-center items-center`}
        onClick={onActionClick} // Trigger the callback function
      >
        <div className={`${actionTextColor} text-lg font-semibold font-['HK Grotesk']`}>{actionText}</div>
      </button>
    </div>
  );
};

export default SubscriptionCard;
