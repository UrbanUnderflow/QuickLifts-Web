// components/Modal/Modal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  primaryButtonText: string;
  secondaryButtonText?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  theme?: 'light' | 'dark';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  primaryButtonText,
  secondaryButtonText,
  onPrimaryAction,
  onSecondaryAction,
  theme = 'dark'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className={`
          relative mx-4 p-6 rounded-2xl shadow-lg 
          ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}
        `}>
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div className="text-center">
            <h3 className={`text-lg font-bold mb-2 
              ${theme === 'dark' ? 'text-white' : 'text-black'}`}
            >
              {title}
            </h3>
            
            {message && (
              <p className={`mb-6 
                ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}`}
              >
                {message}
              </p>
            )}

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onPrimaryAction}
                className="w-full bg-[#E0FE10] text-black px-4 py-2 rounded-full font-medium 
                  hover:bg-[#E0FE10]/90 transition-colors"
              >
                {primaryButtonText}
              </button>

              {secondaryButtonText && (
                <button
                  onClick={onSecondaryAction}
                  className={`w-full px-4 py-2 rounded-full font-medium border 
                    ${theme === 'dark' 
                      ? 'border-zinc-700 text-white hover:bg-zinc-800' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } transition-colors`}
                >
                  {secondaryButtonText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;