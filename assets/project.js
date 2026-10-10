(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const projects = window.PORTFOLIO.projects.filter(project => !project.placeholder);
  const categories = window.PORTFOLIO.categories || [];
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const revision = window.PORTFOLIO.revision;
  const pageLink = (page, values = {}) => page + '?' + new URLSearchParams({...values, v: revision});
  const index = projects.findIndex(project => project.id === id);
  const main = document.querySelector('#project');
  if (index < 0) {
    document.title = '未找到作品 — IhsushI';
    main.innerHTML = `<div class="error-page"><p class="eyeline">PROJECT NOT FOUND</p><h1>这个作品还不在作品集中。</h1><p>可以从目录中选择其他作品。</p><a href="${escape(pageLink('catalog.html'))}">返回作品目录 ↗</a></div>`;
    document.body.dataset.ready = 'true';
    return;
  }
  const p = projects[index];
  const memberships = p.collections || [];
  const requestedCategory = params.get('category');
  const returnCategory = memberships.includes(requestedCategory) && categories.some(category => category.id === requestedCategory) ? requestedCategory : '';
  const collectionId = returnCategory || memberships[0];
  const collection = categories.find(category => category.id === collectionId);
  const related = projects.filter(project => (project.collections || []).includes(collectionId));
  const next = related.length > 1 ? related[(related.findIndex(project => project.id === p.id) + 1) % related.length] : null;
  const catalogLink = pageLink('catalog.html', collection ? {category: collection.id} : {});
  const returnLink = pageLink('index.html', {return: p.id, ...(returnCategory ? {category: returnCategory} : {})});
  document.querySelectorAll('.page-header a[href^="index.html"]').forEach(back => { back.href = returnLink; });
  document.querySelectorAll('.page-header a[href^="catalog.html"]').forEach(link => { link.href = catalogLink; });
  const nextProject = next ? `<a class="next-project" href="${escape(pageLink('project.html', {id: next.id, ...(returnCategory ? {category: returnCategory} : {})}))}"><span>${escape(collection?.label || '同类')} / 下一个作品</span><strong>${escape(next.chinese)} ↗</strong><small>${escape(next.title)}</small></a>` : `<a class="next-project" href="${escape(catalogLink)}"><span>${escape(collection?.label || '作品')} / 作品目录</span><strong>返回${escape(collection?.label || '作品')}目录 ↗</strong><small>更多作品，陆续更新</small></a>`;
  const number = String(index + 1).padStart(2, '0');
  const imageProject = p.mediaType === 'image';
  const interactiveProject = p.mediaType === 'interactive';
  const curatedProject = p.presentation === 'curated' || ['animal-sculpture', 'bodies-of-informatics', 'voice-republic', 'ommateum', 'dodgeball'].includes(p.id);
  const legacyBoards = Array.isArray(p.boards) ? p.boards.filter(board => board && board.src) : [];
  const sections = Array.isArray(p.sections) ? p.sections.map(section => ({
    title: section?.title || '作品图片',
    description: section?.description || '',
    layout: ['single', 'gallery', 'comparison'].includes(section?.layout) ? section.layout : 'single',
    boards: Array.isArray(section?.boards) ? section.boards.filter(board => board && board.src) : []
  })).filter(section => section.boards.length) : [];
  const boards = [...legacyBoards, ...sections.flatMap(section => section.boards)];
  const video = p.video && p.video.src ? p.video : null;
  const safeHttps = href => {
    try { const url = new URL(href); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  };
  const playableHref = safeHttps(p.playable?.href);
  const playable = playableHref ? `<section class="project-playable" aria-label="作品试玩"><a class="playable-button" href="${escape(playableHref)}" target="_blank" rel="noopener noreferrer">${escape(p.playable.label || '打开试玩')} <span aria-hidden="true">↗</span></a>${p.playable.note ? `<p>${escape(p.playable.note)}</p>` : ''}</section>` : '';
  const poster = video?.poster || p.hero?.src || p.cover || '';
  const external = p.externalVideo?.href ? `<a href="${escape(p.externalVideo.href)}" target="_blank" rel="noopener noreferrer">${escape(p.externalVideo.label || '观看演示视频')} ↗</a>` : '';
  const media = video ? `
    <div class="project-player" data-media-state="loading">
      <video id="project-video" controls playsinline preload="metadata"${poster ? ` poster="${escape(poster)}"` : ''} src="${escape(video.src)}" aria-label="${escape(p.chinese)}：${escape(video.label || '关卡演示视频')}">你的浏览器暂不支持视频播放，请通过下方链接打开视频。</video>
      <div class="video-error" id="video-error" role="status" hidden><p>这个视频暂时无法在页面中播放。</p><a href="${escape(video.src)}" target="_blank" rel="noopener">打开视频文件 ↗</a></div>
    </div>
    <div class="video-caption"><span>${escape(video.label || '关卡演示')}<span class="video-duration" id="video-duration">${video.durationLabel ? ' / ' + escape(video.durationLabel) : ''}</span></span><a href="${escape(video.src)}" target="_blank" rel="noopener">打开视频文件 ↗</a></div>` : `
    <div class="project-player media-pending">${poster ? `<img src="${escape(poster)}" alt="${escape(p.chinese)}作品画面" fetchpriority="high" decoding="async">` : ''}</div>
    <div class="video-caption"><span>${escape(p.videoNote || '演示视频待补充。')}</span>${external}</div>`;
  document.title = p.chinese + ' — IhsushI';
  main.style.setProperty('--cover', p.color || '#263448');
  main.style.setProperty('--foil', p.foil || '#d9c4a0');
  main.classList.toggle('image-project', imageProject);
  main.classList.toggle('interactive-project', interactiveProject);
  main.classList.toggle('has-video', !!video);
  main.classList.toggle('curated-project', curatedProject);
  const intro = `<section class="film-intro" aria-labelledby="intro-title"><div class="film-description"><h2 id="intro-title">作品简介</h2><p>${escape(p.summary)}</p>${p.creditNote ? `<p class="project-credit">${escape(p.creditNote)}</p>` : ''}${!imageProject && video && external ? `<p class="alternate-video">${external}</p>` : ''}</div><dl class="project-meta">${(p.meta || []).slice(0, 4).map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>`;
  const renderBoard = (board, boardIndex) => {
    const label = board.label || (curatedProject ? '作品图片' : `图版 ${boardIndex + 1}`);
    const dimensions = Number.isFinite(board.width) && board.width > 0 && Number.isFinite(board.height) && board.height > 0 ? ` width="${Math.round(board.width)}" height="${Math.round(board.height)}"` : '';
    const naturalWidth = Number.isFinite(board.width) && board.width > 0 ? board.width : 1120;
    const ratio = board.width > 0 && board.height > 0 ? board.width / board.height : 1.5;
    const displayWidth = Math.round(Math.min(naturalWidth, ratio < 1.1 ? 820 : 1120));
    const presentation = curatedProject ? ` ${boardIndex === 0 ? 'board--lead' : 'board--study'}` : '';
    const boardStyle = curatedProject ? ` style="--media-width:${displayWidth}px"` : '';
    const leadImage = boardIndex === 0 && !video;
    const zoomHint = curatedProject ? '' : '<span class="board-zoom-hint" aria-hidden="true">放大查看 ↗</span>';
    const caption = curatedProject ? escape(label) : `${String(boardIndex + 1).padStart(2, '0')} / ${escape(label)}`;
    return `<figure class="project-board${presentation}"${boardStyle}><button class="board-open" type="button" data-board-index="${boardIndex}" aria-label="放大图版：${escape(label)}"><img src="${escape(board.src)}" alt="${escape(board.alt || `${p.chinese}：${label}`)}"${dimensions} loading="${leadImage ? 'eager' : 'lazy'}"${leadImage ? ' fetchpriority="high"' : ''} decoding="async"><span class="board-image-error" hidden>图版暂时无法显示，点击尝试打开完整图片。</span>${zoomHint}</button><figcaption><span>${caption}</span>${board.printedPages ? `<span>原作品集第 ${escape(board.printedPages)} 页</span>` : ''}${curatedProject ? '<span class="board-caption-action" aria-hidden="true">点击放大 ↗</span>' : ''}</figcaption></figure>`;
  };
  const imageMedia = legacyBoards.length || (imageProject && !sections.length) ? `<section class="project-boards" aria-label="${escape(p.chinese)}完整图版"><div class="boards-heading"><h2>作品图版</h2><p>保留原版排布，点击图版可放大细读。</p></div>${legacyBoards.length ? legacyBoards.map(renderBoard).join('') : '<p class="boards-empty">图版正在整理。</p>'}</section>` : '';
  let sectionOffset = legacyBoards.length;
  const pairedImages = {
    'animal-sculpture': [['side.webp', 'back.webp']],
    'bodies-of-informatics': [['on-site-table-tray.webp', 'on-site-table-display.webp'], ['early-plan.webp', 'early-axon.webp']],
    'voice-republic': [['scheme-stage.webp', 'scheme-facade.webp'], ['scheme-stage.webp', 'scheme-bar-seating.webp'], ['built-bar-front.webp', 'built-bar-glass.webp'], ['built-facade-day.webp', 'built-facade-night.webp']],
    'dodgeball': [['tall-corridor.webp', 'courtyard-combat.webp']]
  };
  const renderCuratedRows = (sectionBoards, start) => {
    const pairs = pairedImages[p.id] || [];
    const rows = [];
    for (let boardIndex = 0; boardIndex < sectionBoards.length; boardIndex++) {
      const board = sectionBoards[boardIndex];
      const nextBoard = sectionBoards[boardIndex + 1];
      const fileName = String(board.src).split('/').pop();
      const nextName = String(nextBoard?.src || '').split('/').pop();
      const pair = nextBoard && pairs.some(pair => pair.includes(fileName) && pair.includes(nextName));
      rows.push(`<div class="media-row${pair ? ' media-row--pair' : ''}">${renderBoard(board, start + boardIndex)}${pair ? renderBoard(nextBoard, start + boardIndex + 1) : ''}</div>`);
      if (pair) boardIndex++;
    }
    return rows.join('');
  };
  const sectionMedia = sections.map((section, sectionIndex) => {
    const start = sectionOffset;
    sectionOffset += section.boards.length;
    const renderedBoards = curatedProject ? renderCuratedRows(section.boards, start) : section.boards.map((board, boardIndex) => renderBoard(board, start + boardIndex)).join('');
    return `<section class="project-media-section" aria-labelledby="project-section-${sectionIndex}"><div class="media-section-heading"><h2 id="project-section-${sectionIndex}">${escape(section.title)}</h2>${section.description ? `<p>${escape(section.description)}</p>` : ''}</div><div class="section-boards section-boards--${curatedProject ? 'curated' : section.layout}">${renderedBoards}</div></section>`;
  }).join('');
  const lightbox = boards.length ? `<dialog class="board-lightbox" id="board-lightbox" aria-labelledby="board-lightbox-title"><div class="board-lightbox-panel"><header class="board-lightbox-header"><div><p id="board-lightbox-title"></p><span>完整图版 · 可切换原尺寸细读</span></div><div class="board-lightbox-actions"><button type="button" id="board-size-toggle" aria-pressed="false" disabled>原尺寸细读</button><a id="board-full-link" target="_blank" rel="noopener noreferrer">打开图片 ↗</a><button type="button" id="board-lightbox-close" autofocus aria-label="关闭放大图版">关闭 <span aria-hidden="true">×</span></button></div></header><div class="board-lightbox-view" id="board-lightbox-view" tabindex="0" aria-label="放大图版，可滚动阅读"><p class="board-lightbox-status" id="board-lightbox-status" role="status">正在加载图版…</p><img id="board-lightbox-image" alt="" hidden></div></div></dialog>` : '';
  const leadMedia = video || (!imageProject && !interactiveProject) ? `<section class="project-film" aria-label="${escape(p.chinese)}视频演示">${media}</section>` : '';
  main.innerHTML = `
    <div class="film-heading"><div><p class="eyeline">${escape(collection?.label || '作品')} / ${number} / ${String(projects.length).padStart(2, '0')}</p><h1 class="page-title work-title">${escape(p.chinese)}</h1><p class="subtitle english-title">${escape(p.title)}</p></div><a class="project-index-link" href="${escape(catalogLink)}">${escape(collection?.label || '作品')}目录 ↗</a></div>
    ${leadMedia}${intro}${playable}${imageMedia}${sectionMedia}
    ${nextProject}${lightbox}`;
  if (boards.length) {
    const dialog = document.querySelector('#board-lightbox');
    const lightboxImage = document.querySelector('#board-lightbox-image');
    const lightboxTitle = document.querySelector('#board-lightbox-title');
    const lightboxView = document.querySelector('#board-lightbox-view');
    const lightboxStatus = document.querySelector('#board-lightbox-status');
    const sizeToggle = document.querySelector('#board-size-toggle');
    const fullLink = document.querySelector('#board-full-link');
    let opener = null;
    const setActualSize = actual => {
      dialog.dataset.size = actual ? 'actual' : 'fit';
      sizeToggle.setAttribute('aria-pressed', String(actual));
      sizeToggle.textContent = actual ? '适应窗口' : '原尺寸细读';
      lightboxView.scrollTo(0, 0);
    };
    const reportLightboxLoaded = () => {
      lightboxImage.hidden = false;
      lightboxStatus.hidden = true;
      sizeToggle.disabled = false;
    };
    const reportLightboxError = () => {
      lightboxImage.hidden = true;
      lightboxStatus.textContent = '完整图版暂时无法显示，请使用“打开图片”重试。';
      lightboxStatus.hidden = false;
      sizeToggle.disabled = true;
    };
    lightboxImage.addEventListener('load', reportLightboxLoaded);
    lightboxImage.addEventListener('error', reportLightboxError);
    document.querySelectorAll('.board-open').forEach(button => {
      const board = boards[Number(button.dataset.boardIndex)];
      const thumbnail = button.querySelector('img');
      const thumbnailError = button.querySelector('.board-image-error');
      const reportThumbnailError = () => {
        thumbnail.hidden = true;
        thumbnailError.hidden = false;
      };
      thumbnail.addEventListener('error', reportThumbnailError);
      if (thumbnail.complete && !thumbnail.naturalWidth) reportThumbnailError();
      button.addEventListener('click', () => {
        opener = button;
        lightboxTitle.textContent = `${p.chinese} / ${board.label || (curatedProject ? '作品图片' : `图版 ${Number(button.dataset.boardIndex) + 1}`)}`;
        lightboxImage.alt = board.alt || lightboxTitle.textContent;
        lightboxImage.hidden = true;
        lightboxStatus.textContent = '正在加载图版…';
        lightboxStatus.hidden = false;
        sizeToggle.disabled = true;
        fullLink.href = board.fullSrc || board.src;
        setActualSize(false);
        document.documentElement.classList.add('board-dialog-open');
        dialog.showModal();
        lightboxImage.src = board.fullSrc || board.src;
        if (lightboxImage.complete) {
          if (lightboxImage.naturalWidth) reportLightboxLoaded();
          else reportLightboxError();
        }
      });
    });
    sizeToggle.addEventListener('click', () => setActualSize(dialog.dataset.size !== 'actual'));
    document.querySelector('#board-lightbox-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('board-dialog-open');
      if (opener?.isConnected) opener.focus({preventScroll: true});
    });
  }
  if (video) {
    const player = document.querySelector('#project-video');
    const frame = player.closest('.project-player');
    const error = document.querySelector('#video-error');
    const reportError = () => { frame.dataset.mediaState = 'error'; error.hidden = false; };
    player.addEventListener('error', reportError);
    player.addEventListener('loadedmetadata', () => {
      frame.dataset.mediaState = 'ready';
      error.hidden = true;
      if (!video.durationLabel && Number.isFinite(player.duration)) {
        const seconds = Math.floor(player.duration);
        document.querySelector('#video-duration').textContent = ' / ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
      }
    });
    if (player.error) reportError();
  }
  document.body.dataset.ready = 'true';
})();
