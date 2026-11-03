import { createAppStore } from '@clouddrive/state-foundation';
import { getReferenceResources, type ReferenceResource } from '../data';

type ResourceState = {
  resources: readonly ReferenceResource[];
  save: (resource: ReferenceResource) => void;
};

/** Local demonstration data. A refresh restores fixtures; drafts have separate ownership. */
export const useResourcesStore = createAppStore<ResourceState>((set) => ({
  resources: getReferenceResources(),
  save: (resource) =>
    set((state) => ({
      resources: state.resources.some((item) => item.id === resource.id)
        ? state.resources.map((item) => (item.id === resource.id ? resource : item))
        : [...state.resources, resource],
    })),
}));
