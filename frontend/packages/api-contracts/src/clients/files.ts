// S6 file-service typed client stub
// Real implementation lands with SC-01-T01 (file upload) tasks
import type { PresignRequest, PresignResponse, FileCompleteResponse } from '../types';

export const filesClient = {
  async presign(_req: PresignRequest): Promise<PresignResponse> {
    throw new Error('filesClient.presign not implemented');
  },
  async directUpload(_url: string, _file: Blob): Promise<void> {
    throw new Error('filesClient.directUpload not implemented');
  },
  async complete(_fileKey: string): Promise<FileCompleteResponse> {
    throw new Error('filesClient.complete not implemented');
  },
};
