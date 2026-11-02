import type { ProjectRepositoryOptions, SkillSourceFilePreview, SkillSourcePreviewRequest, SkillSource, SkillSourceCreateRequest, SkillSourceDiscovery, SkillSourceDiscoveryRequest, SkillSourceRefreshResult, SkillSourceSelectionRequest, SkillSourceScanUpdate, SkillSourceDiscoveryEvent } from '@paperclipai/shared';
import { api, ApiError, requestResponse } from './client';
const base = () => `/skill-sources`;
export const skillSourcesApi = {
  list: () => api.get<SkillSource[]>(base()),
  repositories: () => api.get<ProjectRepositoryOptions>(`${base()}/repositories`),
  discover: (input: SkillSourceDiscoveryRequest) => api.post<SkillSourceDiscovery>(`${base()}/discover`, input),
  discoverStream: async (input: SkillSourceDiscoveryRequest, onProgress: (event: SkillSourceScanUpdate) => void, signal?: AbortSignal): Promise<SkillSourceDiscovery> => {
    const response = await requestResponse(`${base()}/discover`, {
      method: 'POST', body: JSON.stringify(input), headers: { Accept: 'application/x-ndjson' }, signal,
    });
    if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) throw new Error('Live scan unavailable. Refresh the page and try again.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        signal?.throwIfAborted();
        const { value, done } = await reader.read();
        signal?.throwIfAborted();
        buffer += decoder.decode(value, { stream: !done });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) !== -1) {
          signal?.throwIfAborted();
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line) as SkillSourceDiscoveryEvent;
          if (event.type === 'error') throw new ApiError(event.error, event.status, event);
          if (event.type === 'complete') return event.discovery;
          if (event.type === 'progress' || event.type === 'candidate') onProgress(event);
          else throw new Error('Unexpected repository scan response. Try again.');
        }
        if (done) throw new Error('Repository scan interrupted. Try again.');
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
  preview: (input: SkillSourcePreviewRequest) => api.post<SkillSourceFilePreview>(`${base()}/preview`, input),
  create: (input: SkillSourceCreateRequest) => api.post<SkillSourceRefreshResult>(base(), input),
  select: (id: string, input: SkillSourceSelectionRequest) => api.patch<SkillSourceRefreshResult>(`${base()}/${id}`, input),
  refresh: (id: string) => api.post<SkillSourceRefreshResult>(`${base()}/${id}/refresh`, {}),
  disconnect: (id: string) => api.delete<SkillSource>(`${base()}/${id}`),
};
