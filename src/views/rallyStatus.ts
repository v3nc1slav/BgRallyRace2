import type { RallyStatus } from '../game';
import { t } from '../i18n';

export function statusLabel(status: RallyStatus) {
  return t(`rally.status.${status}`);
}
