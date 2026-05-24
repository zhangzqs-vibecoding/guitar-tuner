// 应用主逻辑 - 连接 UI 与音高检测

let currentTuning = 'standard';
let activeStringIndex = 0;
let lastCents = 0;
let autoMode = false;
let autoCooldown = 0;

// ---- DOM 元素 ----
const $ = (id) => document.getElementById(id);
const noteNameEl = $('noteName');
const noteCentsEl = $('noteCents');
const freqDisplayEl = $('freqDisplay');
const needleEl = $('needle');
const meterFillEl = $('meterFill');
const statusTextEl = $('statusText');
const statusDotEl = document.querySelector('.status-dot');
const startBtn = $('startBtn');
const tuningSelect = $('tuningMode');
const stringSelectorEl = $('stringSelector');
const waveformCanvas = $('waveform');
const waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
const spectrumCanvas = $('spectrum');
const spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;
const signalBar = $('signalBar');
const autoToggle = $('autoToggle');

// ---- 画布尺寸调整 ----
function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;

  if (waveformCtx) {
    const rect = waveformCanvas.getBoundingClientRect();
    waveformCanvas.width = rect.width * dpr;
    waveformCanvas.height = rect.height * dpr;
    waveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (spectrumCtx) {
    const rect = spectrumCanvas.getBoundingClientRect();
    spectrumCanvas.width = rect.width * dpr;
    spectrumCanvas.height = rect.height * dpr;
    spectrumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// ---- 波形绘制 ----
function drawWaveform(buffer, rms) {
  if (!waveformCtx) return;
  const w = waveformCanvas.getBoundingClientRect().width;
  const h = waveformCanvas.getBoundingClientRect().height;

  waveformCtx.clearRect(0, 0, w, h);
  waveformCtx.fillStyle = '#0d1117';
  waveformCtx.fillRect(0, 0, w, h);

  waveformCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  waveformCtx.lineWidth = 1;
  waveformCtx.beginPath();
  waveformCtx.moveTo(0, h / 2);
  waveformCtx.lineTo(w, h / 2);
  waveformCtx.stroke();

  const step = Math.max(1, Math.floor(buffer.length / w));
  waveformCtx.beginPath();
  waveformCtx.strokeStyle = rms > 0.002 ? '#4cc9f0' : 'rgba(76, 201, 240, 0.3)';
  waveformCtx.lineWidth = 1.5;
  waveformCtx.shadowBlur = rms > 0.002 ? 4 : 0;
  waveformCtx.shadowColor = '#4cc9f0';

  for (let x = 0; x < w; x++) {
    const i = Math.floor(x * step);
    const y = (buffer[i] * h / 2) + h / 2;
    if (x === 0) waveformCtx.moveTo(x, y);
    else waveformCtx.lineTo(x, y);
  }
  waveformCtx.stroke();
  waveformCtx.shadowBlur = 0;
}

// ---- 频谱绘制 ----
function drawSpectrum(freqData, rms) {
  if (!spectrumCtx) return;
  const w = spectrumCanvas.getBoundingClientRect().width;
  const h = spectrumCanvas.getBoundingClientRect().height;

  spectrumCtx.clearRect(0, 0, w, h);
  spectrumCtx.fillStyle = '#0d1117';
  spectrumCtx.fillRect(0, 0, w, h);

  // 只绘制 0~2000Hz 范围（约前 93 个 bin，2048 FFT @ 44100Hz）
  const maxBins = Math.min(Math.floor(freqData.length * (2000 / 22050)), freqData.length);
  const barWidth = w / maxBins;
  const active = rms > 0.002;

  for (let i = 0; i < maxBins; i++) {
    const value = freqData[i] / 255;
    const barHeight = value * h;
    const x = i * barWidth;
    const xMid = x + barWidth / 2;

    // 颜色渐变：低频暖色 → 中频亮色 → 高频冷色
    const hue = 200 - (i / maxBins) * 160; // 蓝(200) → 红(40)
    const sat = active ? '80%' : '30%';
    const light = active ? '55%' : '25%';

    spectrumCtx.fillStyle = `hsl(${hue}, ${sat}, ${light})`;
    spectrumCtx.fillRect(x, h - barHeight, Math.max(barWidth - 1, 1), barHeight);
  }

  // 吉他和弦频率标记
  const markFreqs = [82, 110, 147, 196, 247, 330]; // E2 A2 D3 G3 B3 E4
  spectrumCtx.fillStyle = 'rgba(255,255,255,0.15)';
  spectrumCtx.font = '9px monospace';
  markFreqs.forEach((f) => {
    const bin = f / 22050 * freqData.length;
    if (bin < maxBins) {
      const x = bin * barWidth;
      spectrumCtx.fillRect(x, 0, 1, h);
      spectrumCtx.fillText(`${f}Hz`, x + 3, 12);
    }
  });
}

function updateSignalBar(rms) {
  if (!signalBar) return;
  const level = Math.min(rms * 200, 100);
  signalBar.style.width = `${level}%`;
  signalBar.classList.remove('active', 'strong');
  if (level > 10) signalBar.classList.add('active');
  if (level > 70) signalBar.classList.add('strong');
}

// ---- 音高检测回调 ----
GuitarTuner.onPitchDetected = (result) => {
  const { buffer, freqData, rms, frequency, detectedNote } = result;

  drawWaveform(buffer, rms);
  drawSpectrum(freqData, rms);
  updateSignalBar(rms);

  if (frequency > 0 && detectedNote) {
    const tuning = TUNINGS[currentTuning];

    if (autoMode && autoCooldown <= 0) {
      let bestIndex = 0;
      let bestCents = Infinity;
      tuning.strings.forEach((s, i) => {
        const diff = Math.abs(getCentsDifference(frequency, s.freq));
        if (diff < bestCents) {
          bestCents = diff;
          bestIndex = i;
        }
      });

      if (bestCents < 150 && bestIndex !== activeStringIndex) {
        activeStringIndex = bestIndex;
        autoCooldown = 10;
        renderStringButtons();
      }
    }

    if (autoCooldown > 0) autoCooldown--;

    const targetString = tuning.strings[activeStringIndex];
    if (targetString) {
      const cents = getCentsDifference(frequency, targetString.freq);
      lastCents = cents;

      const centsFromTarget = 1200 * Math.log2(frequency / targetString.freq);
      const isNearTarget = Math.abs(centsFromTarget) < 60;
      const displayNote = isNearTarget ? targetString.note : detectedNote.name;

      updateNoteDisplay(displayNote, cents, isNearTarget);
      updateMeter(cents);
      updateFrequency(frequency);
      updateStringButtons(cents);
    }
  }
};

// ---- Auto 模式 ----
function setAutoMode(on) {
  autoMode = on;
  if (autoToggle) {
    if (on) {
      autoToggle.classList.add('active');
      autoToggle.innerHTML = '<span class="auto-icon">⟳</span><span>Auto 开</span>';
    } else {
      autoToggle.classList.remove('active');
      autoToggle.innerHTML = '<span class="auto-icon">⟳</span><span>Auto 关</span>';
    }
  }
}

window.toggleAutoMode = function () {
  setAutoMode(!autoMode);
};

// ---- 初始化 ----
function init() {
  if (autoToggle) {
    setAutoMode(false);
  }

  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  tuningSelect.addEventListener('change', (e) => {
    currentTuning = e.target.value;
    renderStringButtons();
  });

  renderStringButtons();
  updateMeter(0);

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      activeStringIndex = (activeStringIndex + 1) % 6;
      renderStringButtons();
    }
  });
}

function renderStringButtons() {
  const tuning = TUNINGS[currentTuning];
  stringSelectorEl.innerHTML = '';

  tuning.strings.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'string-btn';
    if (i === activeStringIndex) btn.classList.add('active');

    btn.innerHTML = `
      <span class="note-label">${s.note.replace(/[0-9]/g, '')}</span>
      <span class="string-label">${s.name}</span>
    `;

    btn.addEventListener('click', () => {
      activeStringIndex = i;
      renderStringButtons();
      updateNoteDisplay('--', 0, false);
      updateMeter(0);
      updateFrequency(null);
    });

    stringSelectorEl.appendChild(btn);
  });
}

function updateNoteDisplay(note, cents, isNearTarget) {
  noteNameEl.textContent = note;
  const absCents = Math.abs(cents);
  noteCentsEl.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(1)} ¢`;
  noteNameEl.classList.remove('tuned');
  noteCentsEl.classList.remove('tuned');
  if (isNearTarget && absCents < 3) {
    noteNameEl.classList.add('tuned');
    noteCentsEl.classList.add('tuned');
  }
}

function updateMeter(cents) {
  const absCents = Math.abs(cents);
  const sign = Math.sign(cents);
  let normalized;
  if (absCents <= 30) {
    normalized = (cents / 30) * 0.25;
  } else {
    const extra = Math.min(absCents - 30, 70);
    normalized = sign * (0.25 + (extra / 70) * 0.25);
  }
  let percent = (normalized + 0.5) * 100;
  percent = Math.max(0, Math.min(100, percent));
  needleEl.style.left = `${percent}%`;
  if (percent >= 50) {
    meterFillEl.style.left = '50%';
    meterFillEl.style.width = `${percent - 50}%`;
  } else {
    meterFillEl.style.left = `${percent}%`;
    meterFillEl.style.width = `${50 - percent}%`;
  }
}

function updateFrequency(freq) {
  freqDisplayEl.textContent = freq ? `频率: ${freq.toFixed(2)} Hz` : '频率: -- Hz';
}

function updateStringButtons(cents) {
  const buttons = stringSelectorEl.querySelectorAll('.string-btn');
  buttons.forEach((btn) => btn.classList.remove('in-tune'));
  if (Math.abs(cents) < 3) {
    buttons[activeStringIndex]?.classList.add('in-tune');
  }
}

function updateStatus(listening) {
  if (listening) {
    statusTextEl.textContent = '正在监听...';
    statusDotEl.className = 'status-dot listening';
  } else {
    statusTextEl.textContent = '已停止';
    statusDotEl.className = 'status-dot';
  }
}

function updateStatusError(msg) {
  statusTextEl.textContent = msg;
  statusDotEl.className = 'status-dot error';
}

window.startTuner = async function () {
  if (GuitarTuner.isListening) {
    GuitarTuner.stop();
    startBtn.textContent = '开始调音';
    startBtn.classList.remove('recording');
    updateStatus(false);
    updateNoteDisplay('--', 0, false);
    updateMeter(0);
    updateFrequency(null);
    return;
  }

  startBtn.textContent = '启动中...';
  startBtn.disabled = true;

  const success = await GuitarTuner.start();

  if (success) {
    startBtn.textContent = '停止调音';
    startBtn.classList.add('recording');
    updateStatus(true);
  } else {
    startBtn.textContent = '重试';
    updateStatusError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
  }

  startBtn.disabled = false;
};

console.log('吉他调音器已就绪 | 按空格键切换琴弦 | 点击 Auto 按钮自动识别琴弦');

init();
