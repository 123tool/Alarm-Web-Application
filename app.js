/**
 * AuraAlarm - Architecture Core Engine
 * Author: SPY-E & 123Tool
 * Standard: ES6+, Clean Architecture, Production-Ready
 */

// --- 1. MOCK NEWS SERVICE (Scalable Integration Provider) ---
const NewsService = {
    async fetchDailyHeadlines() {
        // Encapsulated simulation of async network API call
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    title: "Global Tech Innovation Summit 2026 Commences",
                    description: "Next-generation software systems and serverless web structures take center stage globally today."
                });
            }, 600);
        });
    }
};

// --- 2. AUDIO CORE CONTROLLER (Web Audio API / HTML5 Audio Wrapper) ---
class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.presetUrl = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"; // Fallback CDN Sound
        this.activeAudio = null;
        this.isPlaying = false;
    }

    initContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    play(sourceType, localBlobUrl = null) {
        this.initContext();
        if (this.isPlaying) this.stop();

        this.activeAudio = new Audio();
        this.activeAudio.src = (sourceType === 'custom' && localBlobUrl) ? localBlobUrl : this.presetUrl;
        this.activeAudio.loop = true;
        
        this.activeAudio.play().catch(err => {
            console.error("Audio playback failure. User interaction required:", err);
        });
        this.isPlaying = true;
    }

    stop() {
        if (this.activeAudio) {
            this.activeAudio.pause();
            this.activeAudio.currentTime = 0;
            this.activeAudio = null;
        }
        this.isPlaying = false;
    }
}

// --- 3. STATE & DATA PERSISTENCE MANAGEMENT ---
class AlarmStateManager {
    constructor() {
        this.storageKey = "aura_alarm_instances";
        this.alarms = this.loadFromStorage();
    }

    loadFromStorage() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.alarms));
    }

    getAlarms() {
        return this.alarms;
    }

    addAlarm(alarmData) {
        const newAlarm = {
            id: 'id_' + Date.now(),
            time: alarmData.time,
            label: alarmData.label || "Alarm Scheduled",
            soundType: alarmData.soundType || "preset",
            localAudioUrl: alarmData.localAudioUrl || null,
            ttsEnabled: alarmData.ttsEnabled || false,
            message: alarmData.message || "",
            newsEnabled: alarmData.newsEnabled || false,
            enabled: true
        };
        this.alarms.push(newAlarm);
        this.saveToStorage();
        return newAlarm;
    }

    updateAlarmStatus(id, isEnabled) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = isEnabled;
            this.saveToStorage();
        }
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        this.saveToStorage();
    }
}

// --- 4. CORE APPLICATION CONTROLLER (Orchestrator) ---
class AppOrchestrator {
    constructor() {
        this.state = new AlarmStateManager();
        this.audio = new AudioEngine();
        this.currentNews = { title: "", description: "" };
        this.activeTriggeredAlarm = null;
        
        this.cacheDOM();
        this.bindEvents();
        this.initClockLoop();
        this.loadSystemData();
    }

    cacheDOM() {
        this.dom = {
            liveTime: document.getElementById('live-time'),
            liveDate: document.getElementById('live-date'),
            btnOpenModal: document.getElementById('btn-open-modal'),
            btnCloseModal: document.getElementById('btn-close-modal'),
            btnCancelModal: document.getElementById('btn-cancel-modal'),
            alarmModal: document.getElementById('alarm-modal'),
            alarmForm: document.getElementById('alarm-form'),
            alarmsContainer: document.getElementById('alarms-container'),
            alarmCount: document.getElementById('alarm-count'),
            
            // Dynamic Form Wrappers
            soundTypeRadio: document.getElementsByName('sound-type'),
            customSoundWrapper: document.getElementById('custom-sound-wrapper'),
            ttsEnableCheckbox: document.getElementById('alarm-tts-enable'),
            ttsOptionsWrapper: document.getElementById('tts-options-wrapper'),
            alarmFile: document.getElementById('alarm-file'),
            
            // News Display
            newsTitle: document.getElementById('news-title'),
            newsDescription: document.getElementById('news-description'),
            
            // Trigger Screen
            triggerScreen: document.getElementById('alarm-trigger-screen'),
            triggerTime: document.getElementById('trigger-time'),
            triggerLabel: document.getElementById('trigger-label'),
            triggerSpeechPreview: document.getElementById('trigger-speech-preview'),
            btnSnooze: document.getElementById('btn-snooze'),
            btnDismiss: document.getElementById('btn-dismiss')
        };
    }

    bindEvents() {
        // Modal State Toggles
        this.dom.btnOpenModal.addEventListener('click', () => this.toggleModal(true));
        this.dom.btnCloseModal.addEventListener('click', () => this.toggleModal(false));
        this.dom.btnCancelModal.addEventListener('click', () => this.toggleModal(false));
        
        // Form Logic & Dependencies
        this.dom.alarmForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        this.dom.soundTypeRadio.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.dom.customSoundWrapper.classList.toggle('hidden', e.target.value !== 'custom');
            });
        });

        this.dom.ttsEnableCheckbox.addEventListener('change', (e) => {
            this.dom.ttsOptionsWrapper.classList.toggle('hidden', !e.target.checked);
        });

        // Alarm Trigger Actions
        this.dom.btnDismiss.addEventListener('click', () => this.dismissTriggeredAlarm());
        this.dom.btnSnooze.addEventListener('click', () => this.snoozeTriggeredAlarm());
    }

    initClockLoop() {
        const updateClock = () => {
            const now = new Date();
            
            // Format Time Structure (HH:MM:SS)
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            this.dom.liveTime.textContent = `${hours}:${minutes}:${seconds}`;

            // Format Calendar Date Structure
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            this.dom.liveDate.textContent = now.toLocaleDateString('en-US', options);

            // Pulse verification check exactly at minute boundary (:00 seconds)
            if (seconds === '00') {
                this.checkAlarmMatch(hours, minutes);
            }
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    async loadSystemData() {
        this.renderAlarmsList();
        try {
            this.currentNews = await NewsService.fetchDailyHeadlines();
            this.dom.newsTitle.textContent = this.currentNews.title;
            this.dom.newsDescription.textContent = this.currentNews.description;
        } catch (error) {
            this.dom.newsTitle.textContent = "Could not synchronize headlines.";
        }
    }

    toggleModal(show) {
        if (show) {
            this.dom.alarmForm.reset();
            this.dom.customSoundWrapper.classList.add('hidden');
            this.dom.ttsOptionsWrapper.classList.add('hidden');
            this.dom.alarmModal.classList.remove('hidden');
        } else {
            this.dom.alarmModal.classList.add('hidden');
        }
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const fileInput = this.dom.alarmFile.files[0];
        const proceedSave = (audioUrl = null) => {
            const formData = {
                time: document.getElementById('alarm-time').value,
                label: document.getElementById('alarm-label').value,
                soundType: document.querySelector('input[name="sound-type"]:checked').value,
                localAudioUrl: audioUrl,
                ttsEnabled: this.dom.ttsEnableCheckbox.checked,
                message: document.getElementById('alarm-message').value,
                newsEnabled: document.getElementById('alarm-news-enable').checked
            };

            this.state.addAlarm(formData);
            this.renderAlarmsList();
            this.toggleModal(false);
        };

        // Convert upload file to runtime object URL safely if chosen
        if (document.querySelector('input[name="sound-type"]:checked').value === 'custom' && fileInput) {
            const reader = new FileReader();
            reader.onload = (event) => proceedSave(event.target.result);
            reader.readAsDataURL(fileInput);
        } else {
            proceedSave();
        }
    }

    renderAlarmsList() {
        const alarms = this.state.getAlarms();
        const activeCount = alarms.filter(a => a.enabled).length;
        this.dom.alarmCount.textContent = `${activeCount} Active`;

        if (alarms.length === 0) {
            this.dom.alarmsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-bell-slash"></i>
                    <p>No alarms scheduled. Create one to get started.</p>
                </div>`;
            return;
        }

        this.dom.alarmsContainer.innerHTML = '';
        alarms.forEach(alarm => {
            const item = document.createElement('div');
            item.className = `alarm-item ${alarm.enabled ? '' : 'disabled-opacity'}`;
            item.innerHTML = `
                <div class="alarm-time-meta">
                    <h3>${alarm.time}</h3>
                    <div class="alarm-label-text">
                        <i class="fa-regular fa-clock"></i> ${alarm.label}
                        ${alarm.ttsEnabled ? '<span class="badge" style="font-size:0.65rem">TTS</span>' : ''}
                    </div>
                </div>
                <div class="alarm-controls">
                    <label class="switch">
                        <input type="checkbox" class="toggle-status" data-id="${alarm.id}" ${alarm.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-delete" data-id="${alarm.id}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            // Append specific node event listners directly to avoid context bleed
            item.querySelector('.toggle-status').addEventListener('change', (e) => {
                this.state.updateAlarmStatus(alarm.id, e.target.checked);
                this.renderAlarmsList();
            });

            item.querySelector('.btn-delete').addEventListener('click', () => {
                this.state.deleteAlarm(alarm.id);
                this.renderAlarmsList();
            });

            this.dom.alarmsContainer.appendChild(item);
        });
    }

    checkAlarmMatch(currentHour, currentMinute) {
        const targetString = `${currentHour}:${currentMinute}`;
        const match = this.state.getAlarms().find(alarm => alarm.enabled && alarm.time === targetString);
        
        if (match) {
            this.executeAlarmTrigger(match);
        }
    }

    executeAlarmTrigger(alarm) {
        this.activeTriggeredAlarm = alarm;
        
        // Update display data metrics
        this.dom.triggerTime.textContent = alarm.time;
        this.dom.triggerLabel.textContent = alarm.label;
        this.dom.triggerScreen.classList.remove('hidden');

        // Play structured audio engine loop
        this.audio.play(alarm.soundType, alarm.localAudioUrl);

        // Execute Speech synthesis queue if configuration is enabled
        if (alarm.ttsEnabled) {
            let voiceScript = alarm.message || "Good morning, this is your custom alarm reminder.";
            if (alarm.newsEnabled && this.currentNews.title) {
                voiceScript += ` Here is your update for today: ${this.currentNews.title}. ${this.currentNews.description}`;
            }
            
            this.dom.triggerSpeechPreview.textContent = `"${voiceScript}"`;
            this.executeTextToSpeech(voiceScript);
        } else {
            this.dom.triggerSpeechPreview.textContent = "Audio standard playback active.";
        }
    }

    executeTextToSpeech(textScript) {
        if ('speechSynthesis' in window) {
            // Cancel lingering voices inside system pipeline
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(textScript);
            utterance.rate = 0.95; // Fluid, premium reading pacing
            utterance.pitch = 1.0;
            
            // Duck audio volume subtly when speech synthesis initiates execution
            utterance.onstart = () => {
                if (this.audio.activeAudio) this.audio.activeAudio.volume = 0.2;
            };
            utterance.onend = () => {
                if (this.audio.activeAudio) this.audio.activeAudio.volume = 1.0;
            };
            
            window.speechSynthesis.speak(utterance);
        }
    }

    dismissTriggeredAlarm() {
        this.audio.stop();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        this.dom.triggerScreen.classList.add('hidden');
        this.activeTriggeredAlarm = null;
    }

    snoozeTriggeredAlarm() {
        if (!this.activeTriggeredAlarm) return;

        this.audio.stop();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        this.dom.triggerScreen.classList.add('hidden');

        // Calculate and create standard modular 5 minute snooze data matrix
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        const snoozeTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        this.state.addAlarm({
            time: snoozeTimeStr,
            label: `Snooze: ${this.activeTriggeredAlarm.label}`,
            soundType: this.activeTriggeredAlarm.soundType,
            localAudioUrl: this.activeTriggeredAlarm.localAudioUrl,
            ttsEnabled: this.activeTriggeredAlarm.ttsEnabled,
            message: this.activeTriggeredAlarm.message,
            newsEnabled: this.activeTriggeredAlarm.newsEnabled
        });

        this.renderAlarmsList();
        this.activeTriggeredAlarm = null;
    }
}

// --- 5. INITIALIZATION ENTRY POINT ---
document.addEventListener('DOMContentLoaded', () => {
    window.AuraAlarmEngine = new AppOrchestrator();
});
