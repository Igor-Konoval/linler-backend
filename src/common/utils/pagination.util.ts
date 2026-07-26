import { PageMetaDto } from '../dto/page-meta.dto';

export function buildPageMeta(
  totalItems: number,
  page: number,
  limit: number,
): PageMetaDto {
  const pageCount = limit > 0 ? Math.ceil(totalItems / limit) : 0;

  return {
    totalItems,
    limit,
    page,
    pageCount,
    hasNext: page < pageCount,
    hasPrevious: page > 1,
  };
}
