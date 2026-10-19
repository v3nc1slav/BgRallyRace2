(() => {
  const root = document.querySelector('.bgr-settings');
  if (!root) {
    return;
  }

  const STORAGE = 'bgr-settings-open';
  const sections = [...root.querySelectorAll('.bgr-section')];
  const search = root.querySelector('[data-role="search"]');
  let restoring = false;

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || '[]');
    } catch {
      return [];
    }
  };

  const save = () => {
    if (restoring || search.value.trim()) {
      return;
    }
    try {
      localStorage.setItem(STORAGE, JSON.stringify(sections.filter((s) => s.open).map((s) => s.dataset.section)));
    } catch {
      return;
    }
  };

  const restore = () => {
    restoring = true;
    const open = load();
    for (const section of sections) {
      section.classList.remove('bgr-hidden');
      section.open = open.includes(section.dataset.section);
      section.querySelectorAll('.bgr-admin-field').forEach((field) => field.classList.remove('bgr-hidden'));
    }
    restoring = false;
  };

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    if (!query) {
      restore();
      return;
    }
    restoring = true;
    for (const section of sections) {
      const sectionMatch = section.dataset.section.toLowerCase().includes(query);
      let hits = 0;
      section.querySelectorAll('.bgr-admin-field').forEach((field) => {
        const match = sectionMatch || field.textContent.toLowerCase().includes(query);
        field.classList.toggle('bgr-hidden', !match);
        hits += match ? 1 : 0;
      });
      section.classList.toggle('bgr-hidden', hits === 0);
      section.open = hits > 0;
    }
    restoring = false;
  };

  const setAll = (open) => {
    search.value = '';
    restore();
    restoring = true;
    sections.forEach((section) => (section.open = open));
    restoring = false;
    save();
  };

  sections.forEach((section) => section.addEventListener('toggle', save));
  search.addEventListener('input', filter);
  root.querySelector('[data-role="expand"]').addEventListener('click', () => setAll(true));
  root.querySelector('[data-role="collapse"]').addEventListener('click', () => setAll(false));
  restore();
})();
