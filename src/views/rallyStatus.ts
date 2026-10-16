import type { RallyStatus } from '../game';

export const statusLabels: Record<RallyStatus, string> = {
  open: 'Записване',
  closed: 'Затворено',
  live: 'На живо',
  finished: 'Завършило',
};
