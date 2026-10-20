function label(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>('table.bgr-table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
    if (!headers.length) {
      return;
    }
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        const text = headers[index] ?? '';
        if (text && cell.getAttribute('data-label') !== text) {
          cell.setAttribute('data-label', text);
        }
      });
    });
  });
}

export function labelTables(root: HTMLElement) {
  let queued = false;
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        label(root);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  label(root);
  return () => observer.disconnect();
}
