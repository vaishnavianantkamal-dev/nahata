export function buildWhereClause(filters: Record<string, any>, tableAlias = ''): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  const prefix = tableAlias ? `"${tableAlias}".` : '"';
  const suffix = tableAlias ? '' : '"';

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const placeholders = value.map(() => `$${paramIndex++}`).join(',');
      conditions.push(`${prefix}${key}${suffix} = ANY(ARRAY[${placeholders}])`);
      params.push(...value);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, val] of Object.entries(value)) {
        if (op === 'gte') {
          conditions.push(`${prefix}${key}${suffix} >= $${paramIndex++}`);
          params.push(val);
        } else if (op === 'lte') {
          conditions.push(`${prefix}${key}${suffix} <= $${paramIndex++}`);
          params.push(val);
        } else if (op === 'contains') {
          conditions.push(`${prefix}${key}${suffix} ILIKE $${paramIndex++}`);
          params.push(`%${val}%`);
        } else if (op === 'startsWith') {
          conditions.push(`${prefix}${key}${suffix} ILIKE $${paramIndex++}`);
          params.push(`${val}%`);
        }
      }
    } else {
      conditions.push(`${prefix}${key}${suffix} = $${paramIndex++}`);
      params.push(value);
    }
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export function buildSelectClause(fields: string[] | Record<string, any>, tableAlias?: string): string {
  if (Array.isArray(fields)) {
    const prefix = tableAlias ? `"${tableAlias}".` : '';
    return fields.map(f => `${prefix}"${f}"`).join(', ');
  }
  return '*';
}

export function buildPagination(page: number = 1, pageSize: number = 20): { limit: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(pageSize, 1000));
  return {
    limit: validSize,
    offset: (validPage - 1) * validSize,
  };
}
