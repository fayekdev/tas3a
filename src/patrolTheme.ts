import type {CSSProperties} from 'react';
import type {PatrolSymbol} from './domain';
const colors:Record<string,[string,string]>={panthere:['#a875e8','#101014'],gazelle:['#f2ce4b','#2458b5'],lion:['#e75353','#f2ce4b'],renard:['#e75353','#101014'],loup:['#101014','#e75353']};
export function patrolTheme(symbol:PatrolSymbol):CSSProperties {
  const [primary,secondary]=colors[symbol]??['#d8b66a','#213149'];
  return {'--patrol-primary':primary,'--patrol-secondary':secondary,'--patrol-ink':symbol==='loup'?secondary:primary} as CSSProperties;
}
