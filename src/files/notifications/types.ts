export enum NotificationsFormat {
  json = "json",
  yml = "yml",
  yaml = "yaml"
}

export interface NotificationsPaths {
  /** './folder', [optional] directory to load the notifications from */
  dir?: string;
  /** 'notifications-admin.json', [optional] name of the notifications file */
  notificationsFileName?: string;
}
