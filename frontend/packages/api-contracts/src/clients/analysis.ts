// S4 ai-analysis-service typed client stub
// Real implementation lands with SC-01-T02 (P03 Analyzing) tasks
import type { SimilarResponse } from '../types';

export const analysisClient = {
  async getSimilar(_qid: string): Promise<SimilarResponse> {
    throw new Error('analysisClient.getSimilar not implemented');
  },
};
