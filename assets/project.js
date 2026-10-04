(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const projects = window.PORTFOLIO.projects.filter(project => !project.placeholder);
  const id = new URLSearchParams(location.search).get('id');
  const index = projects.findIndex(project => project.id === id);
  const main = document.querySelector('#project');
  if (index < 0) {
    document.title = '未找到作品 — IhsushI';
    main.innerHTML = '<div class="error-page"><p class="eyeline">PROJECT NOT FOUND</p><h1>这个作品还不在作品集中。</h1><p>可以从目录中选择其他作品。</p><a href="catalog.html?v=20261005-release-2">返回作品目录 ↗</a></div>';
    document.body.dataset.ready = 'true';
    return;
  }
  const p = projects[index], next = projects[(index + 1) % projects.length];
  document.querySelectorAll('.page-header a[href^="index.html"]').forEach(back => { back.href = 'index.html?return=' + encodeURIComponent(p.id)+'&v='+encodeURIComponent(window.PORTFOLIO.revision); });
  const number = String(index + 1).padStart(2, '0');
  const video = p.video && p.video.src ? p.video : null;
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
  main.innerHTML = `
    <div class="film-heading"><div><p class="eyeline">${number} / ${String(projects.length).padStart(2, '0')}</p><h1 class="page-title work-title">${escape(p.chinese)}</h1><p class="subtitle english-title">${escape(p.title)}</p></div><a class="project-index-link" href="catalog.html?v=20261005-release-2">全部作品 ↗</a></div>
    <section class="project-film" aria-label="${escape(p.chinese)}视频演示">${media}</section>
    <section class="film-intro" aria-labelledby="intro-title"><div class="film-description"><h2 id="intro-title">作品简介</h2><p>${escape(p.summary)}</p>${video && external ? `<p class="alternate-video">${external}</p>` : ''}</div><dl class="project-meta">${(p.meta || []).slice(0, 4).map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>
    <a class="next-project" href="project.html?id=${encodeURIComponent(next.id)}&v=${encodeURIComponent(window.PORTFOLIO.revision)}"><span>NEXT PROJECT / 下一个作品</span><strong>${escape(next.chinese)} ↗</strong><small>${escape(next.title)}</small></a>`;
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
