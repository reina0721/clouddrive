import {
  annotationDetailSchema,
  annotationDocumentSchema,
  annotationBatchResultSchema,
  annotationSummariesResultSchema,
  FilesError,
  type AnnotationsPort,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

/** createAnnotationsPort 复用唯一文件客户端，账号校验与剪贴板职责保留在Host。 */
export function createAnnotationsPort(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
): AnnotationsPort {
  return {
    read: async (id, signal) => {
      assertCurrent();
      const response = await call(
        '/' + encodeURIComponent(id) + '/annotations',
        signal ? { signal } : {},
      );
      assertCurrent();
      return annotationDetailSchema.parse(response);
    },
    summaries: async (ids, visibility, signal) => {
      assertCurrent();
      const query = new URLSearchParams({ visibility });
      for (const id of ids) query.append('ids', id);
      const response = await call(
        '/annotations/summaries?' + query.toString(),
        signal ? { signal } : {},
      );
      assertCurrent();
      const value = annotationSummariesResultSchema.parse(response),
        expected = new Set(ids);
      if (
        value.items.length !== ids.length ||
        expected.size !== ids.length ||
        new Set(value.items.map((item) => item.entryId)).size !== ids.length ||
        value.items.some((item) => !expected.has(item.entryId))
      )
        throw new FilesError('invalid');
      return value;
    },
    replace: async (id, input) => {
      assertCurrent();
      const response = await call('/' + encodeURIComponent(id) + '/annotations', {
        method: 'PUT',
        body: input,
      });
      assertCurrent();
      return annotationDocumentSchema.parse(response);
    },
    changeTags: async (input) => {
      assertCurrent();
      const response = await call('/annotations/tags-batch', { method: 'POST', body: input });
      assertCurrent();
      const value = annotationBatchResultSchema.parse(response);
      const expected = new Set(input.targets.map((target) => target.id));
      if (
        value.items.length !== expected.size ||
        new Set(value.items.map((item) => item.entryId)).size !== expected.size ||
        value.items.some((item) => !expected.has(item.entryId))
      )
        throw new FilesError('invalid');
      return value;
    },
    copyText: async (value) => {
      assertCurrent();
      try {
        await navigator.clipboard.writeText(value);
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
  };
}
