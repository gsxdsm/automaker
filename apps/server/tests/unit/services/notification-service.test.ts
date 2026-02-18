import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '@/services/notification-service.js';
import type { CreateNotificationInput } from '@/services/notification-service.js';
import type { NotificationsFile, Notification } from '@automaker/types';

// Mock secure-fs
vi.mock('@/lib/secure-fs.js', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock @automaker/platform
vi.mock('@automaker/platform', () => ({
  getNotificationsPath: vi.fn(
    (projectPath: string) => `${projectPath}/.automaker/notifications.json`
  ),
  ensureAutomakerDir: vi.fn().mockResolvedValue(undefined),
}));

// Mock @automaker/utils
vi.mock('@automaker/utils', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

import * as secureFs from '@/lib/secure-fs.js';

describe('notification-service.ts', () => {
  let service: NotificationService;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  /**
   * Helper to create a mock notifications file with pre-populated notifications
   */
  function createMockNotificationsFile(notifications: Notification[]): NotificationsFile {
    return {
      version: 1,
      notifications,
    };
  }

  /**
   * Helper to create a mock notification
   */
  function createMockNotification(overrides: Partial<Notification> = {}): Notification {
    return {
      id: 'notif-1',
      type: 'feature_verified',
      title: 'Test Notification',
      message: 'Test message',
      createdAt: '2025-01-15T10:00:00.000Z',
      read: false,
      dismissed: false,
      projectPath: testProjectPath,
      ...overrides,
    };
  }

  /**
   * Helper to simulate readFile returning a notifications file
   */
  function mockReadFileWithNotifications(notifications: Notification[]): void {
    const file = createMockNotificationsFile(notifications);
    vi.mocked(secureFs.readFile).mockResolvedValue(JSON.stringify(file));
  }

  /**
   * Helper to simulate readFile returning an empty notifications file.
   * Uses JSON.stringify to ensure fresh copies are returned on each parse,
   * avoiding mutation of shared DEFAULT_NOTIFICATIONS_FILE constant.
   */
  function mockReadFileEmpty(): void {
    vi.mocked(secureFs.readFile).mockResolvedValue(
      JSON.stringify({ version: 1, notifications: [] })
    );
  }

  /**
   * Helper to simulate readFile throwing ENOENT (file not found)
   */
  function mockReadFileNotFound(): void {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(secureFs.readFile).mockRejectedValue(error);
  }

  describe('getNotifications', () => {
    it('should return empty array when notifications file does not exist', async () => {
      mockReadFileNotFound();

      const notifications = await service.getNotifications(testProjectPath);

      expect(notifications).toEqual([]);
    });

    it('should return non-dismissed notifications sorted by date (newest first)', async () => {
      const older = createMockNotification({
        id: 'notif-1',
        createdAt: '2025-01-10T10:00:00.000Z',
      });
      const newer = createMockNotification({
        id: 'notif-2',
        createdAt: '2025-01-15T10:00:00.000Z',
      });
      mockReadFileWithNotifications([older, newer]);

      const notifications = await service.getNotifications(testProjectPath);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].id).toBe('notif-2'); // Newer first
      expect(notifications[1].id).toBe('notif-1');
    });

    it('should filter out dismissed notifications', async () => {
      const active = createMockNotification({ id: 'notif-1', dismissed: false });
      const dismissed = createMockNotification({ id: 'notif-2', dismissed: true });
      mockReadFileWithNotifications([active, dismissed]);

      const notifications = await service.getNotifications(testProjectPath);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].id).toBe('notif-1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return 0 when no notifications exist', async () => {
      mockReadFileNotFound();

      const count = await service.getUnreadCount(testProjectPath);

      expect(count).toBe(0);
    });

    it('should count only unread, non-dismissed notifications', async () => {
      const unread1 = createMockNotification({ id: 'notif-1', read: false });
      const unread2 = createMockNotification({ id: 'notif-2', read: false });
      const read = createMockNotification({ id: 'notif-3', read: true });
      const dismissed = createMockNotification({ id: 'notif-4', read: false, dismissed: true });
      mockReadFileWithNotifications([unread1, unread2, read, dismissed]);

      const count = await service.getUnreadCount(testProjectPath);

      // dismissed is filtered out by getNotifications, then unread count is 2
      expect(count).toBe(2);
    });
  });

  describe('createNotification', () => {
    it('should create a notification and write it to file', async () => {
      mockReadFileEmpty(); // No existing file

      const input: CreateNotificationInput = {
        type: 'feature_verified',
        title: 'Feature Verified',
        message: 'Feature X has been verified',
        featureId: 'feature-123',
        projectPath: testProjectPath,
      };

      const notification = await service.createNotification(input);

      expect(notification.id).toBe('test-uuid-1234');
      expect(notification.type).toBe('feature_verified');
      expect(notification.title).toBe('Feature Verified');
      expect(notification.message).toBe('Feature X has been verified');
      expect(notification.featureId).toBe('feature-123');
      expect(notification.projectPath).toBe(testProjectPath);
      expect(notification.read).toBe(false);
      expect(notification.dismissed).toBe(false);
      expect(notification.createdAt).toBeDefined();

      // Verify atomic write was called
      expect(secureFs.writeFile).toHaveBeenCalled();
      expect(secureFs.rename).toHaveBeenCalled();
    });

    it('should append to existing notifications', async () => {
      const existing = createMockNotification({ id: 'existing-1' });
      mockReadFileWithNotifications([existing]);

      const input: CreateNotificationInput = {
        type: 'agent_complete',
        title: 'Agent Done',
        message: 'Agent completed work',
        projectPath: testProjectPath,
      };

      await service.createNotification(input);

      // Verify the written file includes both notifications
      const writeCall = vi.mocked(secureFs.writeFile).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string) as NotificationsFile;
      expect(writtenContent.notifications).toHaveLength(2);
      expect(writtenContent.notifications[0].id).toBe('existing-1');
      expect(writtenContent.notifications[1].id).toBe('test-uuid-1234');
    });

    it('should emit notification:created event when event emitter is set', async () => {
      mockReadFileEmpty();

      const mockEmitter = { emit: vi.fn() };
      service.setEventEmitter(mockEmitter as any);

      const input: CreateNotificationInput = {
        type: 'feature_waiting_approval',
        title: 'Needs Approval',
        message: 'Feature needs approval',
        projectPath: testProjectPath,
      };

      const notification = await service.createNotification(input);

      expect(mockEmitter.emit).toHaveBeenCalledWith('notification:created', notification);
    });

    it('should not emit event when no event emitter is set', async () => {
      mockReadFileEmpty();

      const input: CreateNotificationInput = {
        type: 'feature_verified',
        title: 'Test',
        message: 'Test',
        projectPath: testProjectPath,
      };

      // Should not throw even without event emitter
      await expect(service.createNotification(input)).resolves.toBeDefined();
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = createMockNotification({ id: 'notif-1', read: false });
      mockReadFileWithNotifications([notification]);

      const result = await service.markAsRead(testProjectPath, 'notif-1');

      expect(result).not.toBeNull();
      expect(result!.read).toBe(true);
      expect(secureFs.writeFile).toHaveBeenCalled();
    });

    it('should return null for non-existent notification', async () => {
      mockReadFileWithNotifications([]);

      const result = await service.markAsRead(testProjectPath, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('should return 0 when no notifications exist', async () => {
      mockReadFileEmpty();

      const count = await service.markAllAsRead(testProjectPath);

      expect(count).toBe(0);
    });

    it('should mark all non-dismissed, unread notifications as read', async () => {
      const unread1 = createMockNotification({ id: 'notif-1', read: false });
      const unread2 = createMockNotification({ id: 'notif-2', read: false });
      const alreadyRead = createMockNotification({ id: 'notif-3', read: true });
      const dismissed = createMockNotification({ id: 'notif-4', dismissed: true, read: false });
      mockReadFileWithNotifications([unread1, unread2, alreadyRead, dismissed]);

      const count = await service.markAllAsRead(testProjectPath);

      expect(count).toBe(2); // Only unread + non-dismissed
      expect(secureFs.writeFile).toHaveBeenCalled();
    });

    it('should not write file when no notifications need marking', async () => {
      const alreadyRead = createMockNotification({ id: 'notif-1', read: true });
      mockReadFileWithNotifications([alreadyRead]);

      const count = await service.markAllAsRead(testProjectPath);

      expect(count).toBe(0);
      expect(secureFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('dismissNotification', () => {
    it('should dismiss a notification', async () => {
      const notification = createMockNotification({ id: 'notif-1', dismissed: false });
      mockReadFileWithNotifications([notification]);

      const result = await service.dismissNotification(testProjectPath, 'notif-1');

      expect(result).toBe(true);
      expect(secureFs.writeFile).toHaveBeenCalled();
    });

    it('should return false for non-existent notification', async () => {
      mockReadFileWithNotifications([]);

      const result = await service.dismissNotification(testProjectPath, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('dismissAll', () => {
    it('should return 0 when no notifications exist', async () => {
      mockReadFileEmpty();

      const count = await service.dismissAll(testProjectPath);

      expect(count).toBe(0);
    });

    it('should dismiss all non-dismissed notifications', async () => {
      const active1 = createMockNotification({ id: 'notif-1', dismissed: false });
      const active2 = createMockNotification({ id: 'notif-2', dismissed: false });
      const alreadyDismissed = createMockNotification({ id: 'notif-3', dismissed: true });
      mockReadFileWithNotifications([active1, active2, alreadyDismissed]);

      const count = await service.dismissAll(testProjectPath);

      expect(count).toBe(2); // Only non-dismissed
      expect(secureFs.writeFile).toHaveBeenCalled();
    });

    it('should not write file when all notifications already dismissed', async () => {
      const dismissed = createMockNotification({ id: 'notif-1', dismissed: true });
      mockReadFileWithNotifications([dismissed]);

      const count = await service.dismissAll(testProjectPath);

      expect(count).toBe(0);
      expect(secureFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('setEventEmitter', () => {
    it('should set the event emitter for broadcasting events', async () => {
      mockReadFileEmpty();

      const mockEmitter = { emit: vi.fn() };
      service.setEventEmitter(mockEmitter as any);

      const input: CreateNotificationInput = {
        type: 'spec_regeneration_complete',
        title: 'Spec Complete',
        message: 'Spec generation is done',
        projectPath: testProjectPath,
      };

      await service.createNotification(input);

      expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'notification:created',
        expect.objectContaining({
          type: 'spec_regeneration_complete',
          title: 'Spec Complete',
        })
      );
    });
  });
});
