export const CATEGORIES = [
  { id: 'lixo', label: 'Lixo irregular', color: '#d99e3e', icon: 'trash' },
  { id: 'esgoto', label: 'Esgoto', color: '#746ad4', icon: 'droplets' },
  { id: 'queimada', label: 'Queimada', color: '#e5765f', icon: 'flame' },
  { id: 'desmatamento', label: 'Desmatamento', color: '#3e9775', icon: 'trees' },
  { id: 'agua', label: 'Poluição da água', color: '#398cb8', icon: 'waves' },
  { id: 'ar', label: 'Poluição do ar', color: '#7b8594', icon: 'wind' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type VerificationStatus = 'unverified' | 'corroborated' | 'verified';
export type LifecycleStatus = 'active' | 'resolved';
export type VisibilityStatus = 'visible' | 'hidden';

export interface Issue {
  id: string;
  category: CategoryId;
  longitude: number;
  latitude: number;
  description: string | null;
  reportsCount: number;
  createdAt: string;
  lastReportedAt: string;
  verificationStatus: VerificationStatus;
  lifecycleStatus: LifecycleStatus;
  imageUrl: string | null;
  resolvedAt: string | null;
}

export interface IssueGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      id: string;
      category: CategoryId;
      reportsCount: number;
      verificationStatus: VerificationStatus;
      lifecycleStatus: LifecycleStatus;
      lastReportedAt: string;
      resolvedAt: string | null;
    };
  }>;
}

export interface ApiError {
  error: string;
  message: string;
  retryAfter?: number;
}
