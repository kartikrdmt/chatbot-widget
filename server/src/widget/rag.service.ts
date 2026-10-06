import { Injectable } from '@nestjs/common';

export interface RagSource {
  title: string;
  url: string;
}

export interface RagContext {
  /** Additional context text to prepend to the system prompt. Empty when no docs match. */
  text: string;
  sources: RagSource[];
}

/**
 * Retrieval-augmented generation placeholder.
 *
 * Qdrant integration: replace the body of `retrieve()` with a nearest-neighbour
 * query against the site's vector collection, then format the top-k chunks into
 * `text` and their metadata into `sources`.
 */
@Injectable()
export class RagService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async retrieve(_query: string, _siteId: string): Promise<RagContext> {
    return { text: '', sources: [] };
  }
}
