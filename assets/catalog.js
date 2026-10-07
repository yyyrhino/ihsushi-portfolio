(() => {
  const filters = [...document.querySelectorAll('.catalog-categories a')];
  const cards = [...document.querySelectorAll('.catalog-card')];
  const revision = document.querySelector('meta[name="portfolio-build"]').content;
  const count = document.querySelector('#catalog-count');
  const empty = document.querySelector('#catalog-empty');
  const emptyTitle = document.querySelector('#catalog-empty-title');
  const grid = document.querySelector('#catalog-grid');
  const pageLink = (page, values = {}) => page + '?' + new URLSearchParams({...values, v: revision});

  function showCategory(id) {
    const selected = filters.find(link => link.dataset.category === id) || filters[0];
    const category = selected.dataset.category;
    filters.forEach(link => {
      if (link === selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    let visible = 0;
    cards.forEach(card => {
      card.hidden = !!category && !card.dataset.categories.split(/\s+/).includes(category);
      if (!card.hidden) visible++;
      card.href = pageLink('project.html', {id: card.dataset.projectId, ...(category ? {category} : {})});
    });
    count.textContent = String(visible).padStart(2, '0') + ' WORKS / ' + (category ? selected.textContent : '全部作品');
    grid.hidden = visible === 0;
    empty.hidden = visible !== 0;
    emptyTitle.textContent = selected.textContent + '作品 · 待更新';
    const home = pageLink('index.html', category ? {category} : {});
    document.querySelectorAll('[data-collection-home], #catalog-empty-home').forEach(link => { link.href = home; });
    document.title = category ? selected.textContent + '作品 — IhsushI' : '作品目录 — IhsushI';
  }

  filters.forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.href !== link.href) history.pushState(null, '', link.href);
    showCategory(link.dataset.category);
  }));
  window.addEventListener('popstate', () => showCategory(new URLSearchParams(location.search).get('category') || ''));
  showCategory(new URLSearchParams(location.search).get('category') || '');
})();
