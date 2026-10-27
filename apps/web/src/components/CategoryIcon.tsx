import { Droplets, Flame, Trees, Trash2, Waves, Wind } from 'lucide-react';
import type { CategoryId } from '@eco/shared';

export default function CategoryIcon({ category, size = 18 }: { category: CategoryId; size?: number }) {
  const props = { size, strokeWidth: 2 };
  switch (category) {
    case 'lixo': return <Trash2 {...props} />;
    case 'esgoto': return <Droplets {...props} />;
    case 'queimada': return <Flame {...props} />;
    case 'desmatamento': return <Trees {...props} />;
    case 'agua': return <Waves {...props} />;
    case 'ar': return <Wind {...props} />;
  }
}
