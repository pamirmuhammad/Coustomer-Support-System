import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Supported notification severity types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Describes an in-app notification
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

// Shape of the notification context value
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (type: NotificationType, title: string, message: string, options?: { autoClose?: boolean; duration?: number }) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// React context for in-app notification state
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provides notification state (add, remove, clear notifications) to the component tree, with auto-close support
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      options: { autoClose?: boolean; duration?: number } = {}
    ) => {
      const id = Date.now().toString();
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: new Date(),
        autoClose: options.autoClose ?? true,
        duration: options.duration ?? 5000,
      };

      setNotifications((prev) => [notification, ...prev]);

      // Auto-close notification
      if (notification.autoClose) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration);
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to access the NotificationContext – throws if used outside NotificationProvider
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
