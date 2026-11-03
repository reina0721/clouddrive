/**
 * reference-resources —— 确定性本地参考数据。
 *
 * 仅用于验证 File Route、Navigation inheritance 与 Route Target，
 * 不模拟 API、权限引擎或后端业务正确性（Host 守则：Reference 数据只用于确定性验收）。
 */

export type ReferenceResourceKind = 'sample' | 'guide' | 'template';

export type ReferenceResource = Readonly<{
  id: string;
  fixture?: 'alpha' | 'beta' | 'gamma';
  name: string;
  kind: ReferenceResourceKind;
  status: 'active' | 'draft';
  description: string;
}>;

const resourceDefinitions: readonly ReferenceResource[] = [
  {
    id: 'resource-alpha',
    fixture: 'alpha',
    name: '',
    kind: 'sample',
    status: 'active',
    description: '',
  },
  {
    id: 'resource-beta',
    fixture: 'beta',
    name: '',
    kind: 'guide',
    status: 'active',
    description: '',
  },
  {
    id: 'resource-gamma',
    fixture: 'gamma',
    name: '',
    kind: 'template',
    status: 'draft',
    description: '',
  },
] as const;

export function getReferenceResources(): readonly ReferenceResource[] {
  return resourceDefinitions;
}
