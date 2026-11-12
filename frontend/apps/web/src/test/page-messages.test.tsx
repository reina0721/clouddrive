import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  createFrontendI18n,
  FrontendI18nProvider,
  FrontendMessages,
  useFrontendTranslation,
} from '@clouddrive/i18n';

const resources = {
  'zh-CN': { translation: { scoped: { title: '页面文案' } } },
  en: { translation: { scoped: { title: 'Page messages' } } },
};
const runtime = () =>
  createFrontendI18n({
    resources: {
      'zh-CN': { translation: { retained: '保留' } },
      en: { translation: { retained: 'Retained' } },
    },
    defaultLocale: 'zh-CN',
    supportedLocales: ['zh-CN', 'en'],
  });

it('页面资源安装后才挂载消费者，切换语言与运行时不闪现原始键', async () => {
  const seen: string[] = [];
  function Consumer() {
    const { t } = useFrontendTranslation();
    const title = t('scoped.title');
    seen.push(title);
    return <h1>{title}</h1>;
  }
  const first = runtime();
  const second = runtime();
  await second.changeLocale('en');
  const view = render(
    <FrontendI18nProvider runtime={first}>
      <FrontendMessages resources={resources} fallback={<p>Loading</p>}>
        <Consumer />
      </FrontendMessages>
    </FrontendI18nProvider>,
  );
  expect(screen.getByText('Loading')).toBeVisible();
  await screen.findByRole('heading', { name: '页面文案' });
  expect(first.translate('retained')).toBe('保留');
  await act(async () => first.changeLocale('en'));
  expect(screen.getByRole('heading', { name: 'Page messages' })).toBeVisible();
  view.rerender(
    <FrontendI18nProvider runtime={second}>
      <FrontendMessages resources={resources} fallback={<p>Loading</p>}>
        <Consumer />
      </FrontendMessages>
    </FrontendI18nProvider>,
  );
  expect(screen.getByText('Loading')).toBeVisible();
  await screen.findByRole('heading', { name: 'Page messages' });
  expect(seen).not.toContain('scoped.title');
  expect(second.translate('retained')).toBe('Retained');
});

it('取消挂载不向运行时注册尚未使用的页面文案', async () => {
  const owner = runtime();
  const view = render(
    <FrontendI18nProvider runtime={owner}>
      <FrontendMessages resources={resources}>
        <p>Ready</p>
      </FrontendMessages>
    </FrontendI18nProvider>,
  );
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(owner.translate('scoped.title')).toBe('scoped.title');
});
