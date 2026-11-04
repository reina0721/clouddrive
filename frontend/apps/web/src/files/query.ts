import { fileFiltersSchema, encodeFileFilters, type FileQuery } from '@clouddrive/surface/files';

/** fileListParameters 显式序列化有类型条件，关键词使用重复参数保留名称中的逗号。 */
export function fileListParameters(query: FileQuery): URLSearchParams {
  const parameters = new URLSearchParams({
    parent: query.parent,
    search: query.search,
    category: query.category,
    trash: String(query.trash),
    sort: query.sort,
    desc: String(query.desc),
    foldersFirst: String(query.foldersFirst ?? false),
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 0),
  });
  const filters = fileFiltersSchema.parse(query.filters ?? {});
  encodeFileFilters(filters);
  for (const key of ['keywords', 'kinds', 'extensions'] as const)
    for (const value of filters[key] ?? []) parameters.append(key, value);
  for (const key of [
    'scope',
    'match',
    'caseSensitive',
    'minBytes',
    'maxBytes',
    'createdFrom',
    'createdTo',
    'modifiedFrom',
    'modifiedTo',
  ] as const) {
    const value = filters[key];
    if (value !== undefined) parameters.set(key, String(value));
  }
  return parameters;
}
