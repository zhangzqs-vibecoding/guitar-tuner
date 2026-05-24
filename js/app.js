// 应用主逻辑 - 连接 UI 与音高检测

let currentTuning = 'standard';
let activeStringIndex = 0; // 0-5, 对应 6弦到 1弦
let lastCents = 0;

// ---- DOM 元素 ----
const noteNameEl = document.getElementById('noteName');
const noteCentsEl = document.getElementById('noteCents');
const freqDisplayEl = document.getElementById('freqDisplay');
const needleEl = document.getElementById('needle');
const meterFillEl = document.getElementById('meterFill');
const statusTextEl = document.getElementById('statusText');
const statusDotEl = document.querySelector('.status-dot');
const startBtn = document.getElementById('startBtn');
const tuningSelect = document.getElementById('tuningMode');
const stringSelectorEl = document.getElementById('stringSelector');
const waveformCanvas = document.getElementById('waveform');
const waveformCtx = waveformCanvas.getContext('2d');
const signalBar = document.getElementById('signalBar');

// ---- 波形绘制 ----
function resizeCanvas() {
  const rect = waveformCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  waveformCanvas.width = rect.width * dpr;
  waveformCanvas.height = rect.height * dpr;
  waveformCtx.scale(dpr, dpr);
}

function drawWaveform(buffer, rms) {
  const w = waveformCanvas.getBoundingClientRect().width;
  const h = waveformCanvas.getBoundingClientRect().height;

  waveformCtx.clearRect(0, 0, w, h);

  // 背景
  waveformCtx.fillStyle = '#0d1117';
  waveformCtx.fillRect(0, 0, w, h);

  // 中线
  waveformCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  waveformCtx.lineWidth = 1;
  waveformCtx.beginPath();
  waveformCtx.moveTo(0, h / 2);
  waveformCtx.lineTo(w, h / 2);
  waveformCtx.stroke();

  // 波形
  const step = Math.max(1, Math.floor(buffer.length / w));
  waveformCtx.beginPath();
  waveformCtx.strokeStyle = rms > 0.002 ? '#4cc9f0' : 'rgba(76, 201, 240, 0.3)';
  waveformCtx.lineWidth = 1.5;
  waveformCtx.shadowBlur = rms > 0.002 ? 4 : 0;
  waveformCtx.shadowColor = '#4cc9f0';

  for (let x = 0; x < w; x++) {
    const i = Math.floor(x * step);
    const y = (buffer[i] * h / 2) + h / 2;
    if (x === 0) {
      waveformCtx.moveTo(x, y);
    } else {
      waveformCtx.lineTo(x, y);
    }
  }
  waveformCtx.stroke();
  waveformCtx.shadowBlur = 0;

  // RMS 信号强度条
  const level = Math.min(rms * 200, 100); // rms 0.005 约为满格
  signalBar.style.width = `${level}%`;
  signalBar.classList.remove('active', 'strong');
  if (level > 10) signalBar.classList.add('active');
  if (level > 70) signalBar.classList.add('strong');
}

// ---- 音高检测回调 ----
GuitarTuner.onPitchDetected = (result) => {
  const { buffer, rms, frequency, detectedNote } = result;

  // 始终绘制波形
  drawWaveform(buffer, rms);

  if (frequency > 0 && detectedNote) {
    const tuning = TUNINGS[currentTuning];
    const targetString = tuning.strings[activeStringIndex];

    if (targetString) {
      const cents = getCentsDifference(frequency, targetString.freq);
      lastCents = cents;

      const semitonesFromTarget = 1200 * Math.log2(frequency / targetString.freq);
      const isNearTarget = Math.abs(semitonesFromTarget) < 60;
      const displayNote = isNearTarget ? targetString.note : detectedNote.name;

      updateNoteDisplay(displayNote, cents, isNearTarget);
      updateMeter(cents);
      updateFrequency(frequency);
      updateStringButtons(cents);
    }
  }
};

// ---- 初始化 ----
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  tuningSelect.addEventListener('change', (e) => {
    currentTuning = e.target.value;
    renderStringButtons();
  });

  renderStringButtons();
  updateMeter(0);

  // 空格键切换弦
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
  if (freq) {
    freqDisplayEl.textContent = `频率: ${freq.toFixed(2)} Hz`;
  } else {
    freqDisplayEl.textContent = '频率: -- Hz';
  }
}

function updateStringButtons(cents) {
  const buttons = stringSelectorEl.querySelectorAll('.string-btn');
  buttons.forEach((btn) => btn.classList.remove('in-tune'));

  const absCents = Math.abs(cents);
  if (absCents < 3) {
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

console.log('吉他调音器已就绪 | 按空格键切换琴弦');

init();
