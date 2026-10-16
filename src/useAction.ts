import { ref } from 'vue';
import { errorMessage } from './api';

export function useAction() {
  const busy = ref(false);
  const message = ref('');
  const error = ref('');

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    busy.value = true;
    message.value = '';
    error.value = '';
    try {
      return await task();
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      busy.value = false;
    }
  }

  return { busy, message, error, run };
}
