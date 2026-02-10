import { KAIST_VOICE_CONTEXT, KAIST_CHAT_CONTEXT } from './knowledge_base.js';

const CONFIG = {
    apiKey: 'sk-KBBOK5OijPFvetFbyk1VLuvAXCFO6qHD',
    baseUrl: 'https://api.proxyapi.ru/openai/v1',
    model: 'gpt-4o-mini-search-preview',
    webSearchOptions: {
        search_context_size: 'medium',
        user_location: {
            type: 'approximate',
            approximate: {
                country: 'RU',
                city: 'Moscow',
                region: 'Moscow'
            }
        }
    }
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

    chatHistory.push({ role: "user", content: userText });
    updateChatUI(userText, 'user');

    captionText.textContent = "Думаю...";
    abortController = new AbortController();

    try {
        const response = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.model,
                messages: chatHistory,
                web_search_options: CONFIG.webSearchOptions
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`Проблемы с сетью (${response.status})`);
        }

        const payload = await response.json();
        const assistantText = payload.choices?.[0]?.message?.content?.trim() || "";

        if (!assistantText) {
            captionText.textContent = "Не удалось получить ответ.";
            return;
        }

        chatHistory.push({ role: "assistant", content: assistantText });
        updateChatUI(assistantText, 'bot');
        captionText.textContent = assistantText;
        speak(assistantText);

    } catch (e) {
        if (e.name !== 'AbortError') {
            captionText.textContent = "Произошла ошибка связи...";
        }
    }
}

function speak(text) {
    const cleanText = text.replace(/[*#]/g, '');
    const speechText = stripLinksForSpeech(cleanText);
    if (!speechText.trim()) return;
    const utterance = new SpeechSynthesisUtterance(speechText);
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

function stripLinksForSpeech(text) {
    let result = text;
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // keep link text
    result = result.replace(/https?:\/\/\S+/g, '');
    result = result.replace(/www\.\S+/g, '');
    return result;
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
    if (sender === 'bot') {
        msgDiv.innerHTML = marked.parse(text || '');
    } else {
        msgDiv.textContent = text;
    }
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
