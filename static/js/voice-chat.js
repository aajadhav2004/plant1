// Voice and Translation functionality
let currentLanguage = 'en';
let recognition = null;
let isRecording = false;

// Initialize speech recognition
function initializeSpeechRecognition() {
    try {
        // Check for SpeechRecognition API support (including webkit prefix)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Speech recognition not supported');
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        
        // Show feedback when recognition starts
        recognition.onstart = function() {
            showVoiceFeedback('Listening...');
            isRecording = true;
            updateVoiceButtonState(true);
        };
        
        // Handle interim and final results
        recognition.onresult = function(event) {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
                
            // Format the transcript (add question mark if needed)
            let formattedTranscript = transcript;
            if (!formattedTranscript.endsWith('?') && !formattedTranscript.endsWith('!') && !formattedTranscript.endsWith('.')) {
                formattedTranscript += '?';
            }
                
            // Show interim results
            document.getElementById('question').value = formattedTranscript;
            showVoiceFeedback('Recognized: ' + formattedTranscript);
            
            // If this is a final result
            if (event.results[0].isFinal) {
                stopRecording();
                showVoiceFeedback('Processing...');
                setTimeout(() => {
                    askQuestion(); // Ask question after a short delay
                    hideVoiceFeedback();
                }, 500);
            }
        };
        
        // Handle errors
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            showVoiceFeedback('Error: ' + event.error);
            stopRecording();
            setTimeout(hideVoiceFeedback, 2000);
        };
        
        // Clean up when recognition ends
        recognition.onend = function() {
            stopRecording();
            updateVoiceButtonState(false);
        };
        
        // Make the voice button visible since speech recognition is supported
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Speech recognition initialization failed:', error);
        // Hide the voice button if speech recognition is not supported
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.style.display = 'none';
        }
    }
}

// Show voice feedback to user
function showVoiceFeedback(message) {
    let feedback = document.getElementById('voice-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'voice-feedback';
        document.querySelector('.chat-input').appendChild(feedback);
    }
    feedback.textContent = message;
    feedback.style.display = 'block';
}

// Hide voice feedback
function hideVoiceFeedback() {
    const feedback = document.getElementById('voice-feedback');
    if (feedback) {
        feedback.style.display = 'none';
    }
}

// Update voice button state
function updateVoiceButtonState(recording) {
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        if (recording) {
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone-alt"></i>';
        } else {
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    }
}

// Start recording
function startRecording() {
    if (!recognition) {
        initializeSpeechRecognition();
    }
    
    if (recognition && !isRecording) {
        try {
            recognition.lang = getLangCode(currentLanguage);
            recognition.start();
            isRecording = true;
            updateVoiceButtonState(true);
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            showVoiceFeedback('Error starting recognition. Please try again.');
            setTimeout(hideVoiceFeedback, 2000);
        }
    }
}

// Stop recording
function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
        isRecording = false;
        document.getElementById('voice-btn').classList.remove('recording');
    }
}

// Get language code for speech recognition
function getLangCode(language) {
    const langCodes = {
        'en': 'en-US',
        'hi': 'hi-IN',
        'mr': 'mr-IN'
    };
    return langCodes[language] || 'en-US';
}

// Translate text
async function translateText(text, targetLang) {
    // If target language is English or not specified, return original text
    if (targetLang === 'en' || !targetLang) {
        return text;
    }
    
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                target_language: targetLang
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            return data.translated_text;
        } else {
            console.error('Translation error:', data.message);
            // Show a small notification to the user
            const notification = document.createElement('div');
            notification.className = 'translation-error';
            notification.textContent = 'Translation service unavailable. Showing original text.';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            return text;
        }
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

// Text to Speech
async function speakText(text, language) {
    try {
        const response = await fetch('/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                language: language
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const audio = new Audio('data:audio/mp3;base64,' + data.audio);
            audio.play();
        } else {
            console.error('Text-to-speech error:', data.message);
        }
    } catch (error) {
        console.error('Text-to-speech error:', error);
    }
}

// Update chat rendering to include translation and speech
async function renderChat() {
    if (!history || !Array.isArray(history)) {
        console.warn('No chat history available or invalid history format');
        chatBox.innerHTML = "";
        return;
    }

    chatBox.innerHTML = "";
    for (const h of history) {
        if (h && h.question && h.answer) {
            // Translate messages if not in English
            const translatedQuestion = currentLanguage !== 'en' ? 
                await translateText(h.question, currentLanguage) : h.question;
            const translatedAnswer = currentLanguage !== 'en' ? 
                await translateText(h.answer, currentLanguage) : h.answer;
            
            // Sanitize and format messages
            const sanitizedQuestion = translatedQuestion.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let sanitizedAnswer = translatedAnswer.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const formattedAnswer = sanitizedAnswer.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
            
            // Add messages with speech buttons
            chatBox.innerHTML += `
                <div class="user-message">
                    <div class="message-header">
                        <strong>You</strong>
                        <button class="speak-btn" onclick="speakText('${sanitizedQuestion}', '${currentLanguage}')">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>
                    <div class="message-content">${sanitizedQuestion}</div>
                </div>
                <div class="bot-message">
                    <div class="message-header">
                        <strong>Bot</strong>
                        <button class="speak-btn" onclick="speakText('${sanitizedAnswer}', '${currentLanguage}')">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>
                    <div class="message-content">${formattedAnswer}</div>
                </div>
            `;
        }
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Initialize voice and language features
document.addEventListener('DOMContentLoaded', function() {
    // Initialize speech recognition
    initializeSpeechRecognition();
    
    // Voice button event listener
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.addEventListener('mousedown', startRecording);
    voiceBtn.addEventListener('mouseup', stopRecording);
    voiceBtn.addEventListener('mouseleave', stopRecording);
    
    // Language selector event listener
    const languageSelect = document.getElementById('language-select');
    languageSelect.addEventListener('change', function(e) {
        currentLanguage = e.target.value;
        renderChat(); // Re-render chat in new language
    });
});