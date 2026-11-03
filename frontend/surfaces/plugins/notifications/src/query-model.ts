import type { NotificationCategory } from '@clouddrive/plugin-framework/notifications';
export type InboxQuery = {
  q: string;
  category: 'all' | NotificationCategory;
  read: 'all' | 'read' | 'unread';
  page: number;
};
export const defaultInboxQuery: InboxQuery = { q: '', category: 'all', read: 'all', page: 1 };
