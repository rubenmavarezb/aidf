import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveTaskFile } from './files.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { existsSync, mkdirSync, renameSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockRenameSync = vi.mocked(renameSync);

describe('moveTaskFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  describe('happy path', () => {
    it('should move task from pending to completed', () => {
      const taskPath = '/project/.ai/tasks/pending/045-my-task.md';
      const result = moveTaskFile(taskPath, 'completed');

      expect(result).toBe('/project/.ai/tasks/completed/045-my-task.md');
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/project/.ai/tasks/pending/045-my-task.md',
        '/project/.ai/tasks/completed/045-my-task.md'
      );
    });

    it('should move task from pending to blocked', () => {
      const taskPath = '/project/.ai/tasks/pending/045-my-task.md';
      const result = moveTaskFile(taskPath, 'blocked');

      expect(result).toBe('/project/.ai/tasks/blocked/045-my-task.md');
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/project/.ai/tasks/pending/045-my-task.md',
        '/project/.ai/tasks/blocked/045-my-task.md'
      );
    });

    it('should move task from blocked to completed', () => {
      const taskPath = '/project/.ai/tasks/blocked/045-my-task.md';
      const result = moveTaskFile(taskPath, 'completed');

      expect(result).toBe('/project/.ai/tasks/completed/045-my-task.md');
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/project/.ai/tasks/blocked/045-my-task.md',
        '/project/.ai/tasks/completed/045-my-task.md'
      );
    });

    it('should move task from completed to pending', () => {
      const taskPath = '/project/.ai/tasks/completed/045-my-task.md';
      const result = moveTaskFile(taskPath, 'pending');

      expect(result).toBe('/project/.ai/tasks/pending/045-my-task.md');
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/project/.ai/tasks/completed/045-my-task.md',
        '/project/.ai/tasks/pending/045-my-task.md'
      );
    });
  });

  describe('no-op cases', () => {
    it('should not move if already in target folder', () => {
      const taskPath = '/project/.ai/tasks/completed/045-my-task.md';
      const result = moveTaskFile(taskPath, 'completed');

      expect(result).toBe(taskPath);
      expect(mockRenameSync).not.toHaveBeenCalled();
    });

    it('should not move if file is directly in tasks/ (backward compat)', () => {
      const taskPath = '/project/.ai/tasks/045-my-task.md';
      const result = moveTaskFile(taskPath, 'completed');

      expect(result).toBe(taskPath);
      expect(mockRenameSync).not.toHaveBeenCalled();
    });

    it('should not move if file is in an unrecognized subfolder', () => {
      const taskPath = '/project/.ai/tasks/archive/045-my-task.md';
      const result = moveTaskFile(taskPath, 'completed');

      expect(result).toBe(taskPath);
      expect(mockRenameSync).not.toHaveBeenCalled();
    });
  });

  describe('folder creation', () => {
    it('should create target folder if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const taskPath = '/project/.ai/tasks/pending/045-my-task.md';

      moveTaskFile(taskPath, 'completed');

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/project/.ai/tasks/completed',
        { recursive: true }
      );
    });

    it('should not create target folder if it already exists', () => {
      mockExistsSync.mockReturnValue(true);
      const taskPath = '/project/.ai/tasks/pending/045-my-task.md';

      moveTaskFile(taskPath, 'completed');

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });
});
