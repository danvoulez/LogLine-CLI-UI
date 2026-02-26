import { AppSettings } from '@/types/ublx';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true' || true;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Basic mock router
    if (path === '/healthz') return { status: 'healthy' } as any;
    if (path === '/v1/models') return { data: ['gpt-4', 'claude-3', 'gemini-pro'] } as any;
    
    throw new Error(`Mock not implemented for ${path}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}
