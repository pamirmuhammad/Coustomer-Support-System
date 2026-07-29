import { useEffect } from 'react';

/**
 * Hook to close modal when Escape key is pressed
 * @param onClose - Function to call when Escape is pressed
 * @param isOpen - Boolean indicating if the modal is open
 */
export function useModalEscape(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, isOpen]);
}
