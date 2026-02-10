import { KAIST_VOICE_CONTEXT, KAIST_CHAT_CONTEXT } from './knowledge_base.js';

const CONFIG = {
    apiKey: 'qmnavu5eu9jIgk0rFLdJKciCuSOjgJTH',
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest'
};

// State
let chatHistory = [KAIST_VOICE_CONTEXT]; // Default to voice context
let isSpeaking = false;
let abortController = null;
const synth = window.speechSynthesis;

// DOM
const micBtn = document.getElementById('main-mic-btn');
const captionText = document.getElementById('assistant-speech');
const mouth = document.getElementById('mouth');
const visualizer = document.getElementById('visualizer');

// --- VOICE RECOGNITION ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;

    recognition.onstart = () => {
        micBtn.classList.add('active');
        stopAI(); // Прерываем бота, если начали говорить
        captionText.textContent = "Слушаю вас...";
        visualizer.classList.add('active');
    };

    recognition.onend = () => {
        micBtn.classList.remove('active');
        visualizer.classList.remove('active');
    };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        processMessage(text);
    };
}

// --- CORE FUNCTIONS ---

async function processMessage(userText) {
    if (!userText) return;

    // Добавляем в историю (для памяти)
    chatHistory.push({ role: "user", content: userText });
    updateChatUI(userText, 'user');

    captionText.textContent = "Думаю...";
    
    abortController = new AbortController();

    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.model,
                messages: chatHistory,
                stream: true
            }),
            signal: abortController.signal
        });

        let fullContent = "";
        let sentenceBuffer = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        captionText.textContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    const json = JSON.parse(line.substring(6));
                    const delta = json.choices[0]?.delta?.content || "";
                    
                    if (delta) {
                        fullContent += delta;
                        sentenceBuffer += delta;
                        captionText.textContent = fullContent;

                        // Озвучиваем по предложениям для плавности
                        if (/[.!?\n]/.test(delta)) {
                            speak(sentenceBuffer);
                            sentenceBuffer = "";
                        }
                    }
                }
            }
        }

        chatHistory.push({ role: "assistant", content: fullContent });
        updateChatUI(fullContent, 'bot');

    } catch (e) {
        if (e.name !== 'AbortError') captionText.textContent = "Произошла ошибка связи...";
    }
}

function speak(text) {
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.1;

    utterance.onstart = () => {
        mouth.classList.add('talking');
        visualizer.classList.add('active');
    };

    utterance.onend = () => {
        if (!synth.speaking) {
            mouth.classList.remove('talking');
            visualizer.classList.remove('active');
        }
    };

    synth.speak(utterance);
}

function stopAI() {
    synth.cancel();
    if (abortController) abortController.abort();
    mouth.classList.remove('talking');
    visualizer.classList.remove('active');
}

function updateChatUI(text, sender) {
    const history = document.getElementById('chat-history');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    history.appendChild(msgDiv);
    history.scrollTop = history.scrollHeight;
}

// --- EVENTS ---

micBtn.addEventListener('click', () => {
    if (recognition) recognition.start();
});

// Текстовый ввод
document.getElementById('send-text-btn').addEventListener('click', () => {
    const input = document.getElementById('text-input');
    if (input.value.trim() !== '') {
        processMessage(input.value);
        input.value = "";
    }
});

// Send message on Enter key press
document.getElementById('text-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {  // Only send on Enter, not Shift+Enter
        e.preventDefault(); // Prevent default Enter behavior (like creating new lines)
        const input = document.getElementById('text-input');
        if (input.value.trim() !== '') {
            processMessage(input.value);
            input.value = "";
        }
    }
});

// Переключение табов
function initializeTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length === 0) {
        // If buttons aren't ready yet, try again in a moment
        setTimeout(initializeTabSwitching, 100);
        return;
    }
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .content-section').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = document.getElementById(btn.dataset.tab);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // Update context based on active tab
                if (btn.dataset.tab === 'voice-tab') {
                    // Reset chat history with voice context when switching to voice tab
                    chatHistory = [KAIST_VOICE_CONTEXT];
                } else if (btn.dataset.tab === 'chat-tab') {
                    // Reset chat history with chat context when switching to chat tab
                    chatHistory = [KAIST_CHAT_CONTEXT];
                }
            }
        });
    });
}

// Initialize tab switching when the page is fully loaded
window.addEventListener('load', initializeTabSwitching);

// Also try to initialize immediately in case DOM is already ready
initializeTabSwitching();