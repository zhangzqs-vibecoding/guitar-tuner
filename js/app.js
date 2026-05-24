// 应用主逻辑 - 连接 UI 与音高检测

let currentTuning = 'standard';
let activeStringIndex = 0; // 0-5, 对应 6弦到 1弦
let lastCents = 0;

// 音高检测回调
GuitarTuner.onPitchDetected = (result) => {
  const { frequency, detectedNote } = result;
  const tuning = TUNINGS[currentTuning];
  const targetString = tuning.strings[activeStringIndex];

  if (detectedNote && targetString) {
    const cents = getCentsDifference(frequency, targetString.freq);
    lastCents = cents;

    // 判断是否接近目标音符（在 ±50 音分内视为匹配）
    const semitonesFromTarget = 1200 * Math.log2(frequency / targetString.freq);
    const isNearTarget = Math.abs(semitonesFromTarget) < 60;
    const displayNote = isNearTarget ? targetString.note : detectedNote.name;

    updateNoteDisplay(displayNote, cents, isNearTarget);
    updateMeter(cents);
    updateFrequency(frequency);
    updateStringButtons(cents);
  }
};

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

// ---- 初始化 ----
function init() {
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
      // 重置显示
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

  // 清除旧状态
  noteNameEl.classList.remove('tuned');
  noteCentsEl.classList.remove('tuned');

  if (isNearTarget && absCents < 3) {
    noteNameEl.classList.add('tuned');
    noteCentsEl.classList.add('tuned');
  }
}

function updateMeter(cents) {
  // 将 cents (-50 ~ +50) 映射到 0% ~ 100%
  let percent = (cents + 50) / 100 * 100;
  percent = Math.max(0, Math.min(100, percent));

  needleEl.style.left = `${percent}%`;

  // meterFill 从中间向左或向右覆盖
  if (percent >= 50) {
    meterFillEl.style.left = '50%';
    meterFillEl.style.width = `${percent - 50}%`;
    meterFillEl.style.transform = 'scaleX(1)';
  } else {
    meterFillEl.style.left = `${percent}%`;
    meterFillEl.style.width = `${50 - percent}%`;
    meterFillEl.style.transform = 'scaleX(1)';
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
  buttons.forEach((btn, i) => {
    btn.classList.remove('in-tune');
  });

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

// 键盘快捷键提示
console.log('吉他调音器已就绪 | 按空格键切换琴弦');

init();
