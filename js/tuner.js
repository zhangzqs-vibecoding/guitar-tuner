// 音高检测核心模块 - 改进的自相关算法

const GuitarTuner = {
  audioContext: null,
  analyser: null,
  microphone: null,
  isListening: false,
  animationId: null,
  freqHistory: [],
  onPitchDetected: null,

  async start() {
    if (this.isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.microphone = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0;

      this.microphone.connect(this.analyser);
      this.isListening = true;
      this.freqHistory = [];
      this._loop();
      return true;
    } catch (err) {
      console.error('麦克风访问失败:', err);
      return false;
    }
  },

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.microphone = null;
    this.isListening = false;
  },

  _loop() {
    if (!this.isListening) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    const freq = this._detectPitch(buffer, this.audioContext.sampleRate);

    if (freq > 0) {
      this.freqHistory.push(freq);
      if (this.freqHistory.length > 5) this.freqHistory.shift();

      if (this.freqHistory.length >= 3 && this.onPitchDetected) {
        const sorted = [...this.freqHistory].sort((a, b) => a - b);
        const medianFreq = sorted[Math.floor(sorted.length / 2)];

        const note = getNoteFromFrequency(medianFreq);
        this.onPitchDetected({
          frequency: medianFreq,
          detectedNote: note,
        });
      }
    } else {
      // 信号丢失时逐渐衰减历史
      if (this.freqHistory.length > 0) {
        this.freqHistory.shift();
      }
    }

    this.animationId = requestAnimationFrame(() => this._loop());
  },

  // 改进的自相关音高检测
  _detectPitch(buffer, sampleRate) {
    const n = buffer.length;

    // 1. 去除直流分量
    let sum = 0;
    for (let i = 0; i < n; i++) sum += buffer[i];
    const mean = sum / n;

    // 2. 计算 RMS 判断信号强度
    let rms = 0;
    for (let i = 0; i < n; i++) {
      const v = buffer[i] - mean;
      rms += v * v;
    }
    rms = Math.sqrt(rms / n);
    if (rms < 0.002) return -1;

    // 3. 归一化自相关
    const minLag = Math.floor(sampleRate / 500);   // 最高频率 500Hz
    const maxLag = Math.floor(sampleRate / 55);    // 最低频率 55Hz

    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag++) {
      let num = 0, den1 = 0, den2 = 0;
      const len = n - lag;

      for (let i = 0; i < len; i++) {
        const a = buffer[i] - mean;
        const b = buffer[i + lag] - mean;
        num += a * b;
        den1 += a * a;
        den2 += b * b;
      }

      const corr = num / Math.sqrt(den1 * den2 + 1e-12);

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    if (bestCorr < 0.3 || bestLag <= 0) return -1;

    // 4. 抛物线插值提高精度
    let shift = 0;
    if (bestLag > minLag && bestLag < maxLag) {
      const c0 = this._normCorrAt(buffer, mean, bestLag - 1);
      const c1 = bestCorr;
      const c2 = this._normCorrAt(buffer, mean, bestLag + 1);
      const denom = 2 * (c0 - 2 * c1 + c2);
      if (Math.abs(denom) > 1e-12) {
        shift = (c0 - c2) / denom;
      }
    }

    return sampleRate / (bestLag + shift);
  },

  _normCorrAt(buffer, mean, lag) {
    let num = 0, den1 = 0, den2 = 0;
    const len = buffer.length - lag;
    for (let i = 0; i < len; i++) {
      const a = buffer[i] - mean;
      const b = buffer[i + lag] - mean;
      num += a * b;
      den1 += a * a;
      den2 += b * b;
    }
    return num / Math.sqrt(den1 * den2 + 1e-12);
  },
};
