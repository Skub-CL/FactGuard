// popup.js

document.addEventListener('DOMContentLoaded', () => {

  // ── Elements ──────────────────────────────────────────────────────────
  const statusDot      = document.getElementById('status-dot');
  const statusText     = document.getElementById('status-text');
  const sidebarToggle  = document.getElementById('sidebar-toggle');
  const saveBtn        = document.getElementById('save-btn');
  const saveStatus     = document.getElementById('save-status');

  let activeProvider = 'anthropic';

  // ── Load saved settings ────────────────────────────────────────────────
  chrome.storage.sync.get([
    'provider',
    'apiKey', 'anthropicModel',
    'ollamaUrl', 'ollamaModel',
    'openaiUrl', 'openaiKey', 'openaiModel',
    'sidebarVisible'
  ], (data) => {
    activeProvider = data.provider || 'anthropic';
    activateTab(activeProvider);

    if (data.apiKey)          document.getElementById('anthropic-key').value   = data.apiKey;
    if (data.anthropicModel)  document.getElementById('anthropic-model').value = data.anthropicModel;
    if (data.ollamaUrl)       document.getElementById('ollama-url').value      = data.ollamaUrl;
    if (data.ollamaModel)     document.getElementById('ollama-model').value    = data.ollamaModel;
    if (data.openaiUrl)       document.getElementById('openai-url').value      = data.openaiUrl;
    if (data.openaiKey)       document.getElementById('openai-key').value      = data.openaiKey;
    if (data.openaiModel)     document.getElementById('openai-model').value    = data.openaiModel;

    sidebarToggle.checked = data.sidebarVisible !== false;
    updateStatus(data);
  });

  // ── Provider tab switching ─────────────────────────────────────────────
  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeProvider = tab.dataset.provider;
      activateTab(activeProvider);
    });
  });

  function activateTab(provider) {
    document.querySelectorAll('.provider-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.provider === provider);
    });
    document.querySelectorAll('.provider-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${provider}`);
    });
  }

  // ── Preset buttons ────────────────────────────────────────────────────
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.value = btn.dataset.value;
    });
  });

  // ── Test connection ────────────────────────────────────────────────────
  function testConnection(provider) {
    const btn        = document.getElementById(`test-${provider}`);
    const resultBox  = document.getElementById(`test-result-${provider}`);

    btn.disabled = true;
    btn.textContent = '⏳ Teste…';
    resultBox.style.display = 'none';

    const config = buildConfig(provider);

    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', config }, (response) => {
      btn.disabled = false;
      btn.textContent = '🔌 Verbindung testen';
      resultBox.style.display = 'block';

      if (response?.success) {
        resultBox.className = 'test-result ok';
        resultBox.textContent = response.data.message;
        statusDot.className = 'status-dot active';
        statusText.textContent = `${providerLabel(provider)} · Verbunden`;
      } else {
        resultBox.className = 'test-result err';
        resultBox.textContent = '✗ ' + (response?.error || 'Verbindung fehlgeschlagen');
      }
    });
  }

  document.getElementById('test-anthropic').addEventListener('click', () => testConnection('anthropic'));
  document.getElementById('test-ollama').addEventListener('click', () => testConnection('ollama'));
  document.getElementById('test-openai').addEventListener('click', () => testConnection('openai'));

  // ── Save ───────────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    const settings = {
      provider: activeProvider,
      apiKey:         document.getElementById('anthropic-key').value.trim(),
      anthropicModel: document.getElementById('anthropic-model').value.trim(),
      ollamaUrl:      document.getElementById('ollama-url').value.trim(),
      ollamaModel:    document.getElementById('ollama-model').value.trim(),
      openaiUrl:      document.getElementById('openai-url').value.trim(),
      openaiKey:      document.getElementById('openai-key').value.trim(),
      openaiModel:    document.getElementById('openai-model').value.trim(),
      sidebarVisible: sidebarToggle.checked,
    };

    chrome.storage.sync.set(settings, () => {
      updateStatus(settings);
      saveStatus.style.display = 'block';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 2500);

      // Propagate sidebar toggle to active supported tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const supportedSites = ['facebook.com', 'bild.de', 'nius.de'];
        if (tabs[0]?.url && supportedSites.some(s => tabs[0].url.includes(s))) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'TOGGLE_SIDEBAR',
            visible: settings.sidebarVisible
          });
        }
      });
    });
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  function buildConfig(provider) {
    return {
      provider,
      apiKey:         document.getElementById('anthropic-key').value.trim(),
      anthropicModel: document.getElementById('anthropic-model').value.trim(),
      ollamaUrl:      document.getElementById('ollama-url').value.trim(),
      ollamaModel:    document.getElementById('ollama-model').value.trim(),
      openaiUrl:      document.getElementById('openai-url').value.trim(),
      openaiKey:      document.getElementById('openai-key').value.trim(),
      openaiModel:    document.getElementById('openai-model').value.trim(),
    };
  }

  function providerLabel(p) {
    return { anthropic: 'Anthropic Claude', ollama: 'Ollama (lokal)', openai: 'OpenAI-kompatibel' }[p] || p;
  }

  function updateStatus(data) {
    const p = data.provider || 'anthropic';
    let ready = false;

    if (p === 'anthropic' && data.apiKey)     ready = true;
    if (p === 'ollama'    && data.ollamaModel) ready = true;
    if (p === 'openai'    && data.openaiModel) ready = true;

    statusDot.className = 'status-dot' + (ready ? ' active' : '');
    statusText.textContent = ready
      ? `${providerLabel(p)} · bereit`
      : `${providerLabel(p)} · nicht konfiguriert`;
  }
});
