import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store'; // Adjust path if needed
import { hideToast } from '../../redux/toastSlice'; // Adjust path if needed
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

// CSS for toast animation (similar to inactivityCheck.tsx)
const toastAnimation = `
  @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes fadeOutDown { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(20px) scale(0.95); } }
  .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
  .animate-fade-out-down { animation: fadeOutDown 0.3s ease-in forwards; }
`;

const Toast: React.FC = () => {
  const dispatch = useDispatch();
  const { isVisible, message, type, duration } = useSelector((state: RootState) => state.toast);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timeout if a new toast is shown before the old one hides
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isVisible) {
      // Set a timeout to hide the toast after the specified duration
      timeoutRef.current = setTimeout(() => {
        dispatch(hideToast());
      }, duration);
    }

    // Cleanup timeout on component unmount or when isVisible changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, duration, dispatch]);

  if (!isVisible) {
    return null;
  }

  // Determine background color and icon based on type
  let bgColor = 'bg-gray-800';
  let textColor = 'text-white';
  let IconComponent = Info;

  switch (type) {
    case 'success':
      bgColor = 'bg-green-600'; // Or your theme's success color
      IconComponent = CheckCircle;
      break;
    case 'error':
      bgColor = 'bg-red-600'; // Or your theme's error color
      IconComponent = XCircle;
      break;
    case 'warning':
      bgColor = 'bg-yellow-500'; // Or your theme's warning color
      textColor = 'text-black';
      IconComponent = AlertTriangle;
      break;
    case 'info':
    default:
      bgColor = 'bg-blue-600'; // Or your theme's info color
      IconComponent = Info;
      break;
  }

  return (
    <>
      <style>{toastAnimation}</style>
      <div
        className={`fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 p-4 rounded-lg shadow-xl flex items-center gap-3 ${bgColor} ${textColor} animate-fade-in-up`}
        role="alert"
      >
        <IconComponent className="h-6 w-6 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={() => dispatch(hideToast())}
          className="ml-auto -mr-1 -my-1 p-1 rounded-md hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
        </button>
      </div>
    </>
  );
};

export default Toast; 