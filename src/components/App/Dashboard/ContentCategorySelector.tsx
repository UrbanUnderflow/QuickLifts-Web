import React from 'react';
import { X } from 'lucide-react';
import { ContentCategoryType, ContentCategoryInfo } from '../../../api/firebase/workout/types';

interface ContentCategorySelectorProps {
  onClose: () => void;
  onSelectCategory: (category: ContentCategoryType) => void;
}

const ContentCategorySelector: React.FC<ContentCategorySelectorProps> = ({
  onClose,
  onSelectCategory,
}) => {
  const categories = Object.values(ContentCategoryType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <X className="text-white" size={20} />
          </button>
          
          <div className="mt-6 mb-6 max-w-xl mx-0 sm:mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold text-white text-left sm:text-center">
              What do you want to do?
            </h1>
            <p className="mt-2 text-zinc-400 text-base sm:text-lg text-left sm:text-center">
              Choose your workout type
            </p>
          </div>
        </div>

        {/* Category Cards */}
        <div className="flex-1 p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-w-2xl mx-auto w-full">
          {categories.map((categoryKey) => {
            const category = ContentCategoryInfo[categoryKey];
            const isAvailable = category.isAvailable;
            
            return (
              <CategoryCard
                key={categoryKey}
                category={categoryKey}
                displayName={category.displayName}
                description={category.description}
                icon={category.icon}
                color={category.color}
                isAvailable={isAvailable}
                onClick={() => isAvailable && onSelectCategory(categoryKey)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CategoryCardProps {
  category: ContentCategoryType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  isAvailable: boolean;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  displayName,
  description,
  icon,
  color,
  isAvailable,
  onClick,
}) => {
  // Map Material icons to Lucide/custom SVGs
  const renderIcon = () => {
    switch (icon) {
      case 'fitness_center':
        return (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6.5 6.5h-1a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
            <path d="M17.5 6.5h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1" />
            <path d="M6.5 12h11" />
            <path d="M6.5 8v8" />
            <path d="M17.5 8v8" />
            <path d="M4.5 10v4" />
            <path d="M19.5 10v4" />
          </svg>
        );
      case 'directions_run':
        return (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
          </svg>
        );
      case 'self_improvement':
        return (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="6" r="2"/>
            <path d="M21 16v-2c-2.24 0-4.16-.96-5.6-2.68l-1.34-1.6c-.38-.46-.94-.72-1.54-.72h-1.04c-.6 0-1.16.26-1.54.72l-1.34 1.6C7.16 13.04 5.24 14 3 14v2c2.77 0 5.19-1.17 7-3.08V15l-4 3v2h8v-2l-4-3v-2.08c1.81 1.91 4.23 3.08 7 3.08z"/>
          </svg>
        );
      case 'local_fire_department':
        return (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12.9l-2.13 2.09c-.56.56-.87 1.29-.87 2.07C9 18.68 10.35 20 12 20s3-1.32 3-2.94c0-.78-.31-1.52-.87-2.07L12 12.9z"/>
            <path d="M16 6l-.44.55C14.38 8.02 12 7.19 12 5.3V2S4 6 4 13c0 2.92 1.56 5.47 3.89 6.86-.56-.79-.89-1.76-.89-2.8 0-1.32.52-2.56 1.47-3.5L12 10.1l3.53 3.47c.95.93 1.47 2.17 1.47 3.5 0 1.02-.31 1.96-.85 2.75 1.89-1.15 3.29-3.06 3.71-5.3.66-3.55-1.39-6.9-3.86-8.52z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8"/>
          </svg>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={!isAvailable}
      className={`
        relative flex flex-col items-center justify-center p-6 rounded-2xl
        transition-all duration-200 min-h-[160px]
        ${isAvailable 
          ? 'bg-zinc-800/50 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer' 
          : 'bg-zinc-800/30 cursor-not-allowed opacity-50'
        }
      `}
      style={{
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: isAvailable ? `${color}40` : 'transparent',
      }}
    >
      {/* Icon with glow effect */}
      <div 
        className="relative mb-4"
        style={{ color }}
      >
        <div 
          className="absolute inset-0 blur-xl opacity-30"
          style={{ backgroundColor: color }}
        />
        <div className="relative">
          {renderIcon()}
        </div>
      </div>

      {/* Text content */}
      <h3 
        className="text-xl font-bold mb-1"
        style={{ color: isAvailable ? color : '#71717a' }}
      >
        {displayName}
      </h3>
      <p className="text-sm text-zinc-400 text-center">
        {description}
      </p>

      {/* Coming Soon badge */}
      {!isAvailable && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-zinc-700/80 text-xs text-zinc-300">
          Coming Soon
        </div>
      )}
    </button>
  );
};

export default ContentCategorySelector;
