import { localFetch } from "@/lib/local/api";

export async function fetcher<T>(url: string): Promise<T> {
  const res = await localFetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
