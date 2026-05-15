// S3 wrongbook-service typed client stub
// Real implementation lands with SC-08 (WrongbookList) tasks
import type { WrongItemVO, WrongItemListParams, WrongItemListResponse, TagUpdatePayload } from '../types';

export const wrongbookClient = {
  async list(_params: WrongItemListParams): Promise<WrongItemListResponse> {
    throw new Error('wrongbookClient.list not implemented');
  },
  async getById(_id: string): Promise<WrongItemVO> {
    throw new Error('wrongbookClient.getById not implemented');
  },
  async updateTags(_id: string, _payload: TagUpdatePayload): Promise<WrongItemVO> {
    throw new Error('wrongbookClient.updateTags not implemented');
  },
};
