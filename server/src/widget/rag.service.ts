import { Injectable } from '@nestjs/common';

export interface RagSource {
  title: string;
  url: string;
}

export interface RagContext {
  text: string;
  sources: RagSource[];
}

@Injectable()
export class RagService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async retrieve(_query: string, _siteId: string): Promise<RagContext> {
    return { text: '', sources: [] };
  }
}
