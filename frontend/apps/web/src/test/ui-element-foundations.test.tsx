import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { Card, CardContent, CardFooter, CardHeader } from '@clouddrive/ui-adapter/card';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { Avatar, UserIdentity } from '@clouddrive/ui-adapter/identity';
import { BreadcrumbTrail, PaginationControl } from '@clouddrive/ui-adapter/navigation';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('Identity、Navigation 与 Surface Foundations', () => {
  it('Avatar fallback、presence 与 UserIdentity 保留独立语义', () => {
    render(
      <UserIdentity
        avatarSize="lg"
        description="Product owner"
        name="Rin Chen"
        presence={{ label: '在线', tone: 'success' }}
      />,
    );

    expect(screen.getByLabelText('Rin Chen')).toHaveTextContent('RC');
    expect(screen.getByRole('img', { name: '在线' })).toBeVisible();
    expect(screen.getByText('Product owner')).toBeVisible();
  });

  it('Breadcrumb 当前项和 Pagination 边界可被辅助技术识别', () => {
    const onPageChange = vi.fn();
    render(
      <>
        <BreadcrumbTrail
          label="页面层级"
          items={[
            { id: 'root', label: '工作台', href: '/' },
            { id: 'current', label: '记录列表' },
          ]}
        />
        <PaginationControl
          getPageLabel={(page) => `第 ${page} 页`}
          label="记录分页"
          nextLabel="下一页"
          onPageChange={onPageChange}
          page={5}
          previousLabel="上一页"
          totalPages={12}
        />
      </>,
    );

    expect(screen.getByText('记录列表')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: '记录分页' })).toBeVisible();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '第 6 页' }));
    expect(onPageChange).toHaveBeenCalledWith(6);
  });

  it('Busy、Card anatomy 与 DescriptionList 各自拥有稳定结构', () => {
    render(
      <>
        <BusyIndicator label="正在同步" showLabel />
        <Card aria-label="发布摘要">
          <CardHeader title="发布摘要" description="最后检查" />
          <CardContent>
            <DescriptionList
              columns={2}
              label="发布信息"
              items={[
                { id: 'owner', term: '负责人', description: 'Rin' },
                { id: 'region', term: '区域', description: null },
              ]}
            />
          </CardContent>
          <CardFooter>已就绪</CardFooter>
        </Card>
      </>,
    );

    expect(screen.getByRole('status', { name: '正在同步' })).toBeVisible();
    expect(screen.getByRole('region', { name: '发布摘要' })).toBeVisible();
    expect(screen.getByText('负责人')).toBeVisible();
    expect(screen.getByText('—')).toBeVisible();
  });

  it('Avatar 仍可独立使用而不强制携带业务身份结构', () => {
    render(<Avatar name="Mei" />);
    expect(screen.getByLabelText('Mei')).toHaveTextContent('ME');
  });
});
