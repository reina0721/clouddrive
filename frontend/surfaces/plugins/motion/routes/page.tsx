'use client';

import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { LiveRegion } from '@clouddrive/ui-adapter/accessibility';
import { AsyncRegion, type AsyncRegionPhase } from '@clouddrive/ui-adapter/async-region';
import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import { CircleAlert, Inbox } from 'lucide-react';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';

import { MotionInspector } from '../src/motion-inspector';
import { ViewportReveal } from '@clouddrive/surface-foundation/viewport-reveal';

const asyncPhases: readonly AsyncRegionPhase[] = [
  'initial',
  'ready',
  'refreshing',
  'background',
  'empty',
  'error',
];

export default function MotionPage() {
  const { t } = useFrontendTranslation();
  const [phase, setPhase] = useState<AsyncRegionPhase>('initial');
  return (
    <Page>
      <PageHeader
        description="只验证 Universal Presence、Content Swap、Disclosure 与 Reduced Motion Policy；screen recipe 在 Surface 层单独消费。"
        eyebrow="Universal Motion Foundation"
        title="语义动效与中断安全"
      />
      <Section
        title="Content Swap"
        description="Loading 与 Ready 由状态组件主持，不由万能动画容器猜测。"
      >
        <div className="grid gap-4 p-5">
          <ToggleGroup
            label="Async phase"
            options={asyncPhases.map((item) => ({ id: item, label: item }))}
            selectedIds={[phase]}
            selectionMode="single"
            onSelectionChange={(selected) => {
              const next = selected[0] as AsyncRegionPhase | undefined;
              if (next) setPhase(next);
            }}
          />
          <LiveRegion>当前异步阶段：{phase}</LiveRegion>
          <AsyncRegion
            label="Motion content swap"
            phase={phase}
            loading={
              <div className="grid gap-3" aria-label="Loading motion scenario">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            }
            refreshing={
              <div className="mb-3 flex items-center gap-2 text-sm text-ink-muted">
                <BusyIndicator label="正在刷新内容" />
                <span>保留旧内容并刷新</span>
              </div>
            }
            empty={
              <StateSurface
                compact
                description="当前条件没有结果。"
                icon={<Inbox className="size-5" />}
                state="empty"
                title="暂无内容"
              />
            }
            error={
              <StateSurface
                compact
                description="该 Region 可以独立恢复。"
                icon={<CircleAlert className="size-5" />}
                state="error"
                title="内容加载失败"
              />
            }
          >
            <div className="rounded-panel bg-success-soft p-5 text-sm text-success">
              内容已经就绪；快速切换不会留下退出层。
            </div>
          </AsyncRegion>
        </div>
      </Section>
      <Section
        title="Developer Motion Inspector"
        description="开发期统一覆盖系统策略、Recipe 分类和慢速倍率；production 不渲染。"
      >
        <div className="p-5">
          <MotionInspector />
        </div>
      </Section>
      <Section title="Disclosure" description="展开/收起由可访问 Primitive 持有状态与键盘语义。">
        <div className="p-5">
          <DisclosurePanel
            title="Motion policy"
            description="系统 reduced-motion 偏好会关闭非必要位移。"
          >
            Overlay 继续由 HeroUI 主持 Enter/Exit，页面不得再次包裹动画容器。
          </DisclosurePanel>
        </div>
      </Section>
      <ViewportReveal items>
        <Section title="Viewport Reveal" description={t('motionContent.revealDescription')}>
          <div data-reveal-items className="grid gap-4 p-5 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="rounded-panel border border-border bg-surface-muted p-5">
                <h3 className="font-bold text-ink">{t('motionContent.item', { index })}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  {t('motionContent.itemDescription')}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </ViewportReveal>
    </Page>
  );
}
