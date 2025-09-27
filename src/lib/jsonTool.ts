export const toCSV = (arr:any) => Array.isArray(arr) ? arr.join(',') : arr ?? null;
export const fromCSV = (s:any) => (typeof s === 'string' && s.length) ? s.split(',').map(x => x.trim()) : [];