// 音高检测核心模块 - 使用自相关算法

const GuitarTuner = {
  audioContext: null,
  analyser: null,
  microphone: null,
  isListening: false,
  animationId: null,
  onPitchDetected: null, // 回调：({ freq, note, cents, closestNote }) => {}

  async start() {
    if (this.isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.microphone = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.3;

      this.microphone.connect(this.analyser);
      this.isListening = true;
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

    const bufferLength = this.analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    const freq = this._autocorrelate(dataArray, this.audioContext.sampleRate);

    if (freq > 0 && this.onPitchDetected) {
      const note = getNoteFromFrequency(freq);
      this.onPitchDetected({
        frequency: freq,
        detectedNote: note,
      });
    }

    this.animationId = requestAnimationFrame(() => this._loop());
  },

  // 自相关算法检测基频
  _autocorrelate(buffer, sampleRate) {
    const bufferLength = buffer.length;

    // 计算 RMS 判断信号强度
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / bufferLength);
    if (rms < 0.01) return -1; // 信号太弱

    // 自相关
    const maxSamples = Math.floor(sampleRate / 60);  // 最低检测频率 60Hz
    const minSamples = Math.floor(sampleRate / 500); // 最高检测频率 500Hz
    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = minSamples; offset < Math.min(maxSamples, bufferLength); offset++) {
      let correlation = 0;
      for (let i = 0; i < bufferLength - offset; i++) {
        correlation += buffer[i] * buffer[i + offset];
      }
      correlation /= (bufferLength - offset);

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestCorrelation < 0.01 || bestOffset <= 0) return -1;

    // 使用抛物线插值提高精度
    const offset = bestOffset;
    let shift;
    if (offset > 0 && offset < bufferLength - 1) {
      const s0 = this._correlationAt(buffer, offset - 1);
      const s1 = this._correlationAt(buffer, offset);
      const s2 = this._correlationAt(buffer, offset + 1);
      shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
    } else {
      shift = 0;
    }

    const adjustedOffset = offset + shift;
    return sampleRate / adjustedOffset;
  },

  _correlationAt(buffer, offset) {
    let correlation = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
    return correlation / (buffer.length - offset);
  },
};
