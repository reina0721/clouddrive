import { describe, expect, it } from 'vitest';

import {
  resolveGreetingPeriod,
  resolveRelativeTime,
  WORKSPACE_ACTIVITIES,
  WORKSPACE_PEOPLE_IDS,
  WORKSPACE_PROJECTS,
  WORKSPACE_QUICK_LINKS,
  WORKSPACE_TEAM_COUNT,
  WORKSPACE_TODO_IDS,
  WORKSPACE_TODO_PRIORITIES,
} from './workspace-data';

describe('workspace demo data', () => {
  it('问候时段边界稳定', () => {
    expect(resolveGreetingPeriod(4)).toBe('evening');
    expect(resolveGreetingPeriod(5)).toBe('morning');
    expect(resolveGreetingPeriod(11)).toBe('morning');
    expect(resolveGreetingPeriod(12)).toBe('afternoon');
    expect(resolveGreetingPeriod(17)).toBe('afternoon');
    expect(resolveGreetingPeriod(18)).toBe('evening');
    expect(resolveGreetingPeriod(23)).toBe('evening');
    expect(resolveGreetingPeriod(0)).toBe('evening');
    expect(resolveGreetingPeriod(-3)).toBe('evening');
    expect(resolveGreetingPeriod(99)).toBe('evening');
    expect(resolveGreetingPeriod(Number.NaN)).toBe('morning');
  });

  it('相对时间按分钟/小时/天分档且始终为过去时', () => {
    expect(resolveRelativeTime(0)).toEqual({ value: -1, unit: 'minute' });
    expect(resolveRelativeTime(59)).toEqual({ value: -59, unit: 'minute' });
    expect(resolveRelativeTime(60)).toEqual({ value: -1, unit: 'hour' });
    expect(resolveRelativeTime(1_439)).toEqual({ value: -24, unit: 'hour' });
    expect(resolveRelativeTime(1_440)).toEqual({ value: -1, unit: 'day' });
    const negative = resolveRelativeTime(-30);
    expect(negative.value).toBeLessThan(0);
  });

  it('项目 / 动态 / 待办数量与 id 唯一性符合工作台信息架构', () => {
    expect(WORKSPACE_PROJECTS).toHaveLength(6);
    expect(new Set(WORKSPACE_PROJECTS.map((project) => project.id)).size).toBe(6);
    for (const project of WORKSPACE_PROJECTS) {
      expect(project.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(project.members).toBeGreaterThan(0);
    }

    expect(WORKSPACE_ACTIVITIES).toHaveLength(7);
    for (const activity of WORKSPACE_ACTIVITIES) {
      expect(WORKSPACE_PEOPLE_IDS).toContain(activity.actorId);
      expect(activity.minutesAgo).toBeGreaterThanOrEqual(0);
    }

    expect(WORKSPACE_TODO_IDS).toHaveLength(5);
    expect(new Set(WORKSPACE_TODO_IDS).size).toBe(5);
    for (const id of WORKSPACE_TODO_IDS) {
      expect(['high', 'normal']).toContain(WORKSPACE_TODO_PRIORITIES[id]);
    }
    expect(WORKSPACE_TEAM_COUNT).toBeGreaterThan(0);
  });

  it('快捷导航使用静态可解析的 symbolic routeId', () => {
    expect(WORKSPACE_QUICK_LINKS).toHaveLength(6);
    expect(new Set(WORKSPACE_QUICK_LINKS.map((link) => link.routeId)).size).toBe(6);
    expect(WORKSPACE_QUICK_LINKS.map((link) => link.routeId)).toEqual([
      'users',
      'roles',
      'audit',
      'settings',
      'analytics',
      'workspace',
    ]);
  });
});
