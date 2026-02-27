// content.js – FactGuard Content Script (Facebook, Bild.de, Nius.de)

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  let sidebarVisible = true;
  let currentAnalysis = null;
  let observedPosts = new WeakSet();
  let analysisQueue = [];
  let isAnalyzing = false;

  // ── Site Detection ─────────────────────────────────────────────────────
  const SITE = location.hostname.includes('facebook.com') ? 'facebook' : 'news';

  // ── Init ───────────────────────────────────────────────────────────────
  // All provider config fields
  const CONFIG_KEYS = ['provider','apiKey','anthropicModel','ollamaUrl','ollamaModel','openaiUrl','openaiKey','openaiModel','sidebarVisible'];
  let providerConfig = { provider: 'anthropic' };

  chrome.storage.sync.get(CONFIG_KEYS, (data) => {
    providerConfig  = buildProviderConfig(data);
    sidebarVisible  = data.sidebarVisible !== false;
    injectSidebar();
    if (sidebarVisible) showSidebar();
    if (SITE === 'news') {
      startBildObserver();
    } else {
      startPostObserver();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    // Refresh all config on any change
    chrome.storage.sync.get(CONFIG_KEYS, (data) => {
      providerConfig = buildProviderConfig(data);
      sidebarVisible = data.sidebarVisible !== false;
      sidebarVisible ? showSidebar() : hideSidebar();
      // Refresh "no API key" warning if visible
      const warn = document.querySelector('#fg-idle-state .fg-warning');
      if (warn) warn.style.display = isConfigured(providerConfig) ? 'none' : 'block';
    });
  });

  function buildProviderConfig(data) {
    return {
      provider:       data.provider       || 'anthropic',
      apiKey:         data.apiKey         || '',
      anthropicModel: data.anthropicModel || '',
      ollamaUrl:      data.ollamaUrl      || 'http://localhost:11434',
      ollamaModel:    data.ollamaModel    || '',
      openaiUrl:      data.openaiUrl      || 'https://api.openai.com/v1',
      openaiKey:      data.openaiKey      || '',
      openaiModel:    data.openaiModel    || '',
    };
  }

  function isConfigured(cfg) {
    if (cfg.provider === 'anthropic') return !!cfg.apiKey;
    if (cfg.provider === 'ollama')    return !!cfg.ollamaModel;
    if (cfg.provider === 'openai')    return !!cfg.openaiModel;
    return false;
  }

  function providerLabel(cfg) {
    return {
      anthropic: 'Anthropic Claude',
      ollama:    `Ollama (${cfg.ollamaModel || '–'})`,
      openai:    `OpenAI-kompatibel (${cfg.openaiModel || '–'})`,
    }[cfg.provider] || cfg.provider;
  }

  // ── Sidebar Injection ──────────────────────────────────────────────────
  function injectSidebar() {
    if (document.getElementById('factguard-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'factguard-sidebar';
    sidebar.innerHTML = `
      <div id="fg-header">
        <div id="fg-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span>FactGuard</span>
        </div>
        <div id="fg-header-actions">
          <button id="fg-minimize" title="Sidebar minimieren">−</button>
        </div>
      </div>

      <div id="fg-body">
        <div id="fg-idle-state">
          <div class="fg-idle-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <p class="fg-idle-title">Bereit zur Analyse</p>
          <p class="fg-idle-sub">Klicke auf den <strong>„Prüfen"</strong>-Button<br>unter einem ${SITE === 'facebook' ? 'Facebook-Post' : 'Artikel'},<br>um ihn zu analysieren.</p>
          ${isConfigured(providerConfig) ? '' : '<div class="fg-warning">⚠️ Kein Provider konfiguriert.<br><a href="#" id="fg-open-settings">Einstellungen öffnen →</a></div>'}
        </div>

        <div id="fg-loading-state" style="display:none">
          <div class="fg-spinner-wrap">
            <div class="fg-spinner"></div>
          </div>
          <p class="fg-loading-text">Analysiere Post…</p>
          <p class="fg-loading-sub">Fakten werden geprüft</p>
        </div>

        <div id="fg-result-state" style="display:none">
          <div id="fg-verdict-banner">
            <div id="fg-verdict-icon"></div>
            <div id="fg-verdict-text"></div>
            <div id="fg-confidence-bar-wrap">
              <div id="fg-confidence-label"></div>
              <div id="fg-confidence-bar"><div id="fg-confidence-fill"></div></div>
            </div>
          </div>

          <div class="fg-section">
            <div class="fg-section-title">Zusammenfassung</div>
            <div id="fg-summary" class="fg-section-content"></div>
          </div>

          <div class="fg-section">
            <div class="fg-section-title">Analyse</div>
            <div id="fg-details" class="fg-section-content"></div>
          </div>

          <div id="fg-claims-section" class="fg-section" style="display:none">
            <div class="fg-section-title">Einzelne Behauptungen</div>
            <div id="fg-claims-list"></div>
          </div>

          <div class="fg-section">
            <div class="fg-section-title">Relevante Quellen</div>
            <div id="fg-sources" class="fg-section-content fg-sources-text"></div>
          </div>

          <div id="fg-category-wrap" class="fg-section">
            <span class="fg-category-badge" id="fg-category"></span>
          </div>

          <button id="fg-new-check" class="fg-btn-secondary">Neuen Post prüfen</button>
        </div>

        <div id="fg-error-state" style="display:none">
          <div class="fg-error-icon">⚠️</div>
          <p id="fg-error-msg" class="fg-error-text"></p>
          <button id="fg-retry-btn" class="fg-btn-secondary">Erneut versuchen</button>
        </div>
      </div>

      <div id="fg-tab" title="FactGuard öffnen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
    `;

    document.body.appendChild(sidebar);
    bindSidebarEvents(sidebar);
  }

  function bindSidebarEvents(sidebar) {
    sidebar.querySelector('#fg-minimize').addEventListener('click', () => {
      hideSidebar();
      chrome.storage.sync.set({ sidebarVisible: false });
    });

    sidebar.querySelector('#fg-tab').addEventListener('click', () => {
      showSidebar();
      chrome.storage.sync.set({ sidebarVisible: true });
    });

    const openSettings = sidebar.querySelector('#fg-open-settings');
    if (openSettings) {
      openSettings.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
      });
    }

    sidebar.querySelector('#fg-new-check').addEventListener('click', () => {
      showState('idle');
    });

    sidebar.querySelector('#fg-retry-btn').addEventListener('click', () => {
      if (analysisQueue.length) {
        processQueue();
      }
    });
  }

  function showSidebar() {
    const sidebar = document.getElementById('factguard-sidebar');
    if (sidebar) {
      sidebar.classList.add('fg-visible');
      sidebar.classList.remove('fg-hidden');
      document.body.style.marginRight = '320px';
    }
  }

  function hideSidebar() {
    const sidebar = document.getElementById('factguard-sidebar');
    if (sidebar) {
      sidebar.classList.remove('fg-visible');
      sidebar.classList.add('fg-hidden');
      document.body.style.marginRight = '';
    }
  }

  function showState(state) {
    ['idle', 'loading', 'result', 'error'].forEach(s => {
      const el = document.getElementById(`fg-${s}-state`);
      if (el) el.style.display = s === state ? 'flex' : 'none';
    });
  }

  // ── Post Observer ──────────────────────────────────────────────────────
  function startPostObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectCheckButtons, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Initial scans – content loads progressively
    setTimeout(injectCheckButtons, 1500);
    setTimeout(injectCheckButtons, 4000);
  }

  function injectCheckButtons() {
    // Find all top-level feed articles. Nested articles (comment sections)
    // are excluded by checking that no parent is also role="article".
    document.querySelectorAll('[role="article"]').forEach(article => {
      if (observedPosts.has(article)) return;
      if (article.parentElement?.closest('[role="article"]')) return; // skip nested

      const text = extractPostText(article);
      if (!text || text.length < 30) return;

      observedPosts.add(article);
      injectButton(article, text);
    });
  }

  function extractPostText(article) {
    // Try selectors from most to least specific; return the longest match
    const candidates = [
      '[data-ad-rendering-role="story_message"]',
      '[data-ad-preview="message"]',
      '[data-testid="post_message"]',
      'div[dir="auto"]',
    ];

    let best = '';
    for (const sel of candidates) {
      article.querySelectorAll(sel).forEach(el => {
        const t = el.innerText.trim();
        if (t.length > best.length) best = t;
      });
      if (best.length > 30) break; // good enough
    }
    return best;
  }

  function injectButton(article, postText) {
    // Find the action bar (Like / Comment / Share row)
    const actionBar =
      article.querySelector('[role="toolbar"]') ||
      article.querySelector('[aria-label*="Reaktion"]')?.closest('div') ||
      article.querySelector('[aria-label*="Like"]')?.closest('div') ||
      article.querySelector('[aria-label*="Gefällt"]')?.closest('div') ||
      article.querySelector('div[style*="border-top"]');

    const btnWrap = document.createElement('div');
    btnWrap.className = 'fg-check-button-wrap';
    btnWrap.innerHTML = `
      <button class="fg-check-btn" title="Mit FactGuard prüfen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        FactGuard prüfen
      </button>
    `;

    if (actionBar) {
      actionBar.parentNode.insertBefore(btnWrap, actionBar.nextSibling);
    } else {
      article.appendChild(btnWrap);
    }

    btnWrap.querySelector('.fg-check-btn').addEventListener('click', () => {
      queueAnalysis(postText);
    });
  }

  // ── Analysis ───────────────────────────────────────────────────────────
  function queueAnalysis(text) {
    if (!isConfigured(providerConfig)) {
      showState('error');
      document.getElementById('fg-error-msg').textContent =
        'Kein KI-Provider konfiguriert. Bitte in den Einstellungen einrichten.';
      showSidebar();
      chrome.storage.sync.set({ sidebarVisible: true });
      return;
    }

    analysisQueue = [text];
    showSidebar();
    chrome.storage.sync.set({ sidebarVisible: true });
    processQueue();
  }

  function processQueue() {
    if (!analysisQueue.length || isAnalyzing) return;
    isAnalyzing = true;
    const text = analysisQueue.shift();

    // Show which provider is active
    const loadingText = document.querySelector('.fg-loading-sub');
    if (loadingText) loadingText.textContent = providerLabel(providerConfig);
    showState('loading');

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_POST', text, config: providerConfig },
      (response) => {
        isAnalyzing = false;
        if (chrome.runtime.lastError) {
          showError('Verbindungsfehler: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response.success) {
          displayResult(response.data);
        } else {
          showError(response.error || 'Unbekannter Fehler');
        }
      }
    );
  }

  function showError(msg) {
    showState('error');
    document.getElementById('fg-error-msg').textContent = msg;
  }

  function displayResult(data) {
    showState('result');

    const verdictConfig = {
      'WAHR': { label: 'Wahr', color: '#22c55e', icon: '✓', cls: 'fg-verdict-true' },
      'TEILWEISE_WAHR': { label: 'Teilweise wahr', color: '#f59e0b', icon: '~', cls: 'fg-verdict-partial' },
      'FALSCH': { label: 'Falsch', color: '#ef4444', icon: '✗', cls: 'fg-verdict-false' },
      'IRREFÜHREND': { label: 'Irreführend', color: '#f97316', icon: '!', cls: 'fg-verdict-misleading' },
      'UNBEKANNT': { label: 'Unbekannt', color: '#6b7280', icon: '?', cls: 'fg-verdict-unknown' },
    };

    const v = verdictConfig[data.verdict] || verdictConfig['UNBEKANNT'];
    const banner = document.getElementById('fg-verdict-banner');
    banner.className = `fg-verdict-banner ${v.cls}`;

    document.getElementById('fg-verdict-icon').textContent = v.icon;
    document.getElementById('fg-verdict-text').textContent = v.label;

    const conf = data.confidence || 0;
    document.getElementById('fg-confidence-label').textContent = `Konfidenz: ${conf}%`;
    document.getElementById('fg-confidence-fill').style.width = `${conf}%`;
    document.getElementById('fg-confidence-fill').style.background = v.color;

    document.getElementById('fg-summary').textContent = data.summary || '–';
    document.getElementById('fg-details').textContent = data.details || '–';
    document.getElementById('fg-sources').textContent = data.sources_hint || '–';
    document.getElementById('fg-category').textContent = data.category || 'Allgemein';

    // Claims
    const claimsSection = document.getElementById('fg-claims-section');
    const claimsList = document.getElementById('fg-claims-list');
    claimsList.innerHTML = '';

    if (data.claims && data.claims.length > 0) {
      claimsSection.style.display = 'block';
      data.claims.forEach(c => {
        const claimEl = document.createElement('div');
        claimEl.className = 'fg-claim-item';
        const claimV = { 'WAHR': '✓', 'FALSCH': '✗', 'FRAGWÜRDIG': '~' };
        const claimC = { 'WAHR': 'fg-claim-true', 'FALSCH': 'fg-claim-false', 'FRAGWÜRDIG': 'fg-claim-partial' };
        claimEl.innerHTML = `
          <div class="fg-claim-header ${claimC[c.verdict] || ''}">
            <span class="fg-claim-icon">${claimV[c.verdict] || '?'}</span>
            <span class="fg-claim-text">${escapeHTML(c.claim)}</span>
          </div>
          <div class="fg-claim-explanation">${escapeHTML(c.explanation)}</div>
        `;
        claimsList.appendChild(claimEl);
      });
    } else {
      claimsSection.style.display = 'none';
    }
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  // ── Bild.de Integration ────────────────────────────────────────────────
  function startBildObserver() {
    injectBildButtons();

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectBildButtons, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function injectBildButtons() {
    // Artikel-Teaser auf Übersichtsseiten und einzelne Artikel
    const containers = [
      ...document.querySelectorAll('article'),
      ...document.querySelectorAll('[class*="article"][class*="body"]'),
      ...document.querySelectorAll('[class*="ArticleBody"]'),
    ];

    // Deduplizieren
    const seen = new Set();
    containers.forEach(el => {
      const article = el.tagName === 'ARTICLE' ? el : el.closest('article') || el;
      if (seen.has(article) || observedPosts.has(article)) return;
      seen.add(article);

      const text = extractBildText(article);
      if (!text || text.length < 40) return;

      observedPosts.add(article);
      injectBildButton(article, text);
    });
  }

  function extractBildText(article) {
    const headlineEl =
      article.querySelector('h1') ||
      article.querySelector('h2') ||
      article.querySelector('[class*="headline"]') ||
      article.querySelector('[class*="Headline"]') ||
      article.querySelector('[class*="title"]');

    const headline = headlineEl?.innerText?.trim() || '';

    // Fließtext: alle p-Tags, die nicht Navigation/Footer sind
    const paragraphs = [...article.querySelectorAll('p')]
      .map(p => p.innerText.trim())
      .filter(t => t.length > 30)
      .slice(0, 8)
      .join(' ');

    return [headline, paragraphs].filter(Boolean).join('\n\n').substring(0, 3000);
  }

  function injectBildButton(article, text) {
    const btnWrap = document.createElement('div');
    btnWrap.className = 'fg-check-button-wrap fg-bild-wrap';
    btnWrap.innerHTML = `
      <button class="fg-check-btn fg-bild-btn" title="Mit FactGuard prüfen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        FactGuard prüfen
      </button>
    `;

    // Button nach der Überschrift einfügen, sonst am Anfang des Artikels
    const headline = article.querySelector('h1, h2, [class*="headline"], [class*="Headline"]');
    if (headline) {
      headline.insertAdjacentElement('afterend', btnWrap);
    } else {
      article.prepend(btnWrap);
    }

    btnWrap.querySelector('.fg-check-btn').addEventListener('click', () => {
      queueAnalysis(text);
    });
  }

})();
