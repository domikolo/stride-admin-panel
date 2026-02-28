import useSWR, { BareFetcher } from 'swr';
import { api } from './api';

export const fetcher: BareFetcher<any> = (path: string) => api.get(path);
export { useSWR };
