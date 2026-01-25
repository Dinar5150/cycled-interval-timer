const practiceMinutesInput = document.getElementById("practiceMinutes");
const practiceSecondsInput = document.getElementById("practiceSeconds");
const restMinutesInput = document.getElementById("restMinutes");
const restSecondsInput = document.getElementById("restSeconds");

const timerDisplay = document.getElementById("timerDisplay");
const phaseBadge = document.getElementById("phaseBadge");
const cycleInfo = document.getElementById("cycleInfo");
const nextPhase = document.getElementById("nextPhase");
const loopStatus = document.getElementById("loopStatus");
// summary previews removed from UI; keep function as no-op

const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");
const volumeRange = document.getElementById("volumeRange");
const volumeValue = document.getElementById("volumeValue");

let intervalId = null;
let isRunning = false;
let isPaused = false;
let currentPhase = "practice";
let remainingSeconds = 0;
let cycleCount = 1;
let audioContext = null;
let masterGain = null;

const clampNumber = (value, min, max) => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return min;
  }
  return Math.min(Math.max(num, min), max);
};

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getDuration = (phase) => {
  if (phase === "practice") {
    const minutes = clampNumber(practiceMinutesInput.value, 0, 59);
    const seconds = clampNumber(practiceSecondsInput.value, 0, 59);
    return minutes * 60 + seconds;
  }
  const minutes = clampNumber(restMinutesInput.value, 0, 59);
  const seconds = clampNumber(restSecondsInput.value, 0, 59);
  return minutes * 60 + seconds;
};

const updateSummaries = () => {
  // previews removed; nothing to update here
};

const updateDisplay = () => {
  timerDisplay.textContent = formatTime(remainingSeconds);
  const next = currentPhase === "practice" ? "Rest" : "Practice";
  nextPhase.textContent = next;
  phaseBadge.textContent = currentPhase === "practice" ? "Practice" : "Rest";
  phaseBadge.classList.toggle("rest", currentPhase === "rest");
  cycleInfo.textContent = `Cycle ${cycleCount}`;
};

const updateControls = () => {
  playButton.disabled = isRunning && !isPaused;
  pauseButton.disabled = !isRunning;
  stopButton.disabled = !isRunning && !isPaused;
};

const stopTimer = () => {
  clearInterval(intervalId);
  intervalId = null;
  isRunning = false;
  isPaused = false;
  currentPhase = "practice";
  cycleCount = 1;
  remainingSeconds = getDuration("practice");
  loopStatus.textContent = "Stopped";
  updateDisplay();
  updateControls();
};

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
};

const updateVolume = () => {
  const value = clampNumber(volumeRange.value, 0, 100);
  volumeRange.value = value;
  volumeValue.textContent = `${value}%`;
  if (masterGain) {
    masterGain.gain.value = value / 100;
  }
};

const playTone = (frequency, duration, type = "sine") => {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.value = clampNumber(volumeRange.value, 0, 100) / 100;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(masterGain || context.destination);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration);
};

const playPracticeStartSfx = () => {
  playTone(740, 0.18, "triangle");
  setTimeout(() => playTone(980, 0.18, "triangle"), 90);
};

const playRestStartSfx = () => {
  // Play the same two notes as practice but reversed
  playTone(980, 0.18, "triangle");
  setTimeout(() => playTone(740, 0.18, "triangle"), 90);
};

const playPhaseStartSfx = () => {
  if (currentPhase === "practice") {
    playPracticeStartSfx();
  } else {
    playRestStartSfx();
  }
};

const nextPhaseCycle = () => {
  currentPhase = currentPhase === "practice" ? "rest" : "practice";
  if (currentPhase === "practice") {
    cycleCount += 1;
    playPracticeStartSfx();
  } else {
    playRestStartSfx();
  }
  remainingSeconds = getDuration(currentPhase);
  updateDisplay();
};

const tick = () => {
  if (remainingSeconds <= 0) {
    nextPhaseCycle();
    return;
  }
  remainingSeconds -= 1;
  updateDisplay();
};

const startTimer = () => {
  const practiceDuration = getDuration("practice");
  const restDuration = getDuration("rest");
  if (practiceDuration === 0 && restDuration === 0) {
    loopStatus.textContent = "Set a duration";
    return;
  }
  if (!isRunning) {
    if (!isPaused) {
      // fresh start: default to practice phase
      currentPhase = "practice";
      cycleCount = 1;
      remainingSeconds = practiceDuration || 1;
      // Play SFX only when starting fresh (not when resuming from pause)
      playPhaseStartSfx();
    } else {
      // resuming from pause: preserve current phase and remaining time
      remainingSeconds = remainingSeconds || getDuration(currentPhase) || 1;
    }
  }
  clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
  isRunning = true;
  isPaused = false;
  loopStatus.textContent = "Running";
  updateDisplay();
  updateControls();
};

const pauseTimer = () => {
  if (!isRunning) {
    return;
  }
  clearInterval(intervalId);
  intervalId = null;
  isRunning = false;
  isPaused = true;
  loopStatus.textContent = "Paused";
  updateControls();
};

const handleInputChange = (event) => {
  const input = event.target;
  // sanitize: keep digits only
  let raw = String(input.value || "").replace(/\D+/g, "");
  if (raw === "") {
    raw = "0";
  }
  // limit to two digits
  if (raw.length > 2) raw = raw.slice(-2);
  let num = Number(raw);
  if (Number.isNaN(num)) num = 0;
  const max = Number(input.max || 59);
  const min = Number(input.min || 0);
  num = Math.min(Math.max(num, min), max);
  // always display two digits
  input.value = String(num).padStart(2, "0");
  updateSummaries();
  if (!isRunning && !isPaused) {
    remainingSeconds = getDuration(currentPhase);
    updateDisplay();
  }
};

[
  practiceMinutesInput,
  practiceSecondsInput,
  restMinutesInput,
  restSecondsInput,
].forEach((input) => {
  input.addEventListener("change", handleInputChange);
  input.addEventListener("input", handleInputChange);
});

playButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
stopButton.addEventListener("click", stopTimer);
volumeRange.addEventListener("input", updateVolume);
volumeRange.addEventListener("change", updateVolume);

updateSummaries();
remainingSeconds = getDuration("practice");
updateDisplay();
updateControls();
updateVolume();
