// Handle flash message dismissal
function setupFlashMessages() {
    const closeButtons = document.querySelectorAll('.close-flash');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const flashMessage = this.parentElement;
            flashMessage.style.animation = 'fadeOut 0.5s ease forwards';
            setTimeout(() => {
                flashMessage.remove();
            }, 500);
        });
    });

    // Auto-dismiss flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        setTimeout(() => {
            if (message && message.parentElement) {
                message.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => {
                    if (message && message.parentElement) {
                        message.remove();
                    }
                }, 500);
            }
        }, 5000);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Setup flash messages
    setupFlashMessages();
    
    // DOM Elements
    const fileUpload = document.getElementById('file-upload');
    const webcamBtn = document.getElementById('webcam-btn');
    const webcamContainer = document.getElementById('webcam-container');
    const webcamElement = document.getElementById('webcam');
    const captureBtn = document.getElementById('capture-btn');
    const closeWebcamBtn = document.getElementById('close-webcam-btn');
    const previewImage = document.getElementById('preview-image');
    const placeholderText = document.getElementById('placeholder-text');
    const resultContainer = document.getElementById('result-container');
    const predictionResult = document.getElementById('prediction-result');
    const predictBtn = document.getElementById('predict-btn');
    
    // Initialize chat state
    loadChatHistory();
    
    // Chat Elements
    const questionInput = document.getElementById('question');
    const askBtn = document.getElementById('ask-btn');
    const chatBox = document.getElementById('chat-box');
    const plantName = document.getElementById('plant-name');
    const downloadBtn = document.getElementById('download-btn');
    const printBtn = document.getElementById('print-btn');
    const languageSelect = document.getElementById('language-select');
    
    let stream = null;
    let currentImage = null;
    let plantClass = null;
    let history = [];
    let currentAudio = null; // Track current playing audio
    
    // File Upload Handler
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                displayImage(e.target.result);
                currentImage = file; // Store the file for prediction
            };
            
            reader.readAsDataURL(file);
        }
    });
    
    // Predict Button Handler
    predictBtn.addEventListener('click', function() {
        if (currentImage) {
            predictPlant(currentImage);
        } else {
            alert('Please upload or capture an image first');
        }
    });
    
    // Webcam Handlers
    webcamBtn.addEventListener('click', startWebcam);
    captureBtn.addEventListener('click', captureImage);
    closeWebcamBtn.addEventListener('click', stopWebcam);
    
    // Start Webcam
    function startWebcam() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(function(mediaStream) {
                    stream = mediaStream;
                    webcamElement.srcObject = mediaStream;
                    webcamContainer.style.display = 'block';
                })
                .catch(function(error) {
                    console.error('Error accessing webcam:', error);
                    alert('Could not access webcam. Please make sure you have a webcam connected and have granted permission.');
                });
        } else {
            alert('Your browser does not support webcam access.');
        }
    }
    
    // Stop Webcam
    function stopWebcam() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            webcamElement.srcObject = null;
            webcamContainer.style.display = 'none';
        }
    }
    
    // Capture Image from Webcam
    function captureImage() {
        if (stream) {
            // Create canvas to capture frame
            const canvas = document.createElement('canvas');
            canvas.width = webcamElement.videoWidth;
            canvas.height = webcamElement.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw video frame to canvas
            ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);
            
            // Convert to data URL
            const imageDataUrl = canvas.toDataURL('image/jpeg');
            
            // Display image and store for later prediction
            displayImage(imageDataUrl);
            currentImage = imageDataUrl; // Store the image data for prediction
            
            // Stop webcam
            stopWebcam();
        }
    }
    
    // Display Image in Preview
    function displayImage(src) {
        previewImage.src = src;
        previewImage.style.display = 'block';
        placeholderText.style.display = 'none';
    }
    
    // Predict Plant from Image
    function predictPlant(imageData) {
        // Show loading state
        resultContainer.style.display = 'block';
        predictionResult.textContent = 'Analyzing image...';
        
        // Create form data for file upload
        const formData = new FormData();
        
        // Check if imageData is a base64 string (from webcam) or a file
        if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
            // It's a base64 image from webcam
            formData.append('image_data', imageData);
        } else {
            // It's a file from upload
            formData.append('image', imageData);
        }
        
        // Send image to backend for prediction
        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                predictionResult.textContent = 'Error: ' + data.message;
            } else {
                const predictedClass = data.prediction;
                predictionResult.textContent = predictedClass;
                
                // Send the predicted class to the backend and reset chat
                setPredictedPlant(predictedClass);
            }
        })
        .catch(error => {
            console.error('Error predicting plant:', error);
            predictionResult.textContent = 'Error processing image. Please try again.';
        });
    }
    
    // Chat Functions
    
    // Set the predicted plant and reset chat
    async function setPredictedPlant(predictedClass) {
        try {
            const res = await fetch("/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plant_class: predictedClass })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                plantClass = data.plant;
                history = [];
                document.getElementById("plant-name").innerHTML = "🌿 Current Plant: <strong>" + plantClass + "</strong>";
                document.getElementById("chat-box").innerHTML = "";
                document.getElementById("question").value = "";
            } else {
                console.error('Error setting plant:', data.message);
            }
        } catch (error) {
            console.error('Error setting plant:', error);
        }
    }
    
    // Function to stop any currently playing audio
    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
    }

    // Function to play audio response
    function playAudioResponse(audioUrl, messageElement) {
        if (!audioUrl) return;
        
        stopCurrentAudio();
        
        const audio = new Audio(audioUrl);
        currentAudio = audio;
        
        // Add play/pause button to message
        const playButton = document.createElement('button');
        playButton.className = 'audio-control-btn';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        
        playButton.addEventListener('click', () => {
            if (audio.paused) {
                stopCurrentAudio();
                audio.play();
                playButton.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                audio.pause();
                playButton.innerHTML = '<i class="fas fa-play"></i>';
            }
        });
        
        // Update button when audio ends
        audio.addEventListener('ended', () => {
            playButton.innerHTML = '<i class="fas fa-play"></i>';
        });
        
        messageElement.appendChild(playButton);
        
        // Auto-play the response
        audio.play();
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
    }

    // Add question mark if not present
    function formatQuestion(question) {
        question = question.trim();
        // Don't add ? if the question already ends with ?, ! or .
        if (!question.endsWith('?') && !question.endsWith('!') && !question.endsWith('.')) {
            question += '?';
        }
        return question;
    }

    // Ask a question about the current plant
    async function askQuestion() {
        let q = document.getElementById("question").value.trim();
        if (!q) return;
        
        if (!plantClass) {
            alert("Please predict a plant first before asking questions.");
            return;
        }

        // Format the question with question mark
        q = formatQuestion(q);
        
        try {
            // Show loading state
            document.getElementById("question").value = "";
            const botLoadingMessage = `<div class="bot-message"><strong>Bot:</strong> <em>Thinking...</em></div>`;
            const userMessage = `<div class="user-message"><strong>You:</strong> ${q}</div>`;
            document.getElementById("chat-box").innerHTML += userMessage + botLoadingMessage;
            chatBox.scrollTop = chatBox.scrollHeight;
            
            // Get selected language
            const selectedLanguage = languageSelect.value;
            
            const res = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    question: q,
                    language: selectedLanguage
                })
            });
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            const data = await res.json();
            
            if (data.status === 'success') {
                // Update local history with the new response
                if (data.history && Array.isArray(data.history)) {
                    history = data.history;
                    console.log("Updated history length:", history.length);
                } else {
                    // If no history in response, add the new Q&A to local history
                    history.push({
                        question: q,
                        answer: data.text,
                        audioUrl: data.audio_url
                    });
                }
                
                // Remove loading message
                chatBox.lastElementChild.remove();
                
                // Create new bot message element
                const botMessageDiv = document.createElement('div');
                botMessageDiv.className = 'bot-message';
                botMessageDiv.innerHTML = `<strong>Bot:</strong> ${data.text.replace(/\n/g, '<br>')}`;
                
                // Add the message to chat
                chatBox.appendChild(botMessageDiv);
                
                // Add audio playback if available
                if (data.audio_url) {
                    playAudioResponse(data.audio_url, botMessageDiv);
                }
                
                // Scroll to bottom
                chatBox.scrollTop = chatBox.scrollHeight;
                
                // Log success
                console.log("Chat updated successfully");
            } else {
                // Handle error in a way that preserves previous messages
                const errorMessage = `<strong>Bot:</strong> ${data.message || 'Sorry, I couldn\'t process your question. Please try again.'}`;
                // Replace the "thinking" message with the error
                chatBox.lastElementChild.innerHTML = errorMessage;
            }
        } catch (error) {
            console.error('Error asking question:', error);
            document.getElementById("chat-box").lastElementChild.innerHTML = `<strong>Bot:</strong> Sorry, an error occurred. Please try again.`;
        }
    }
    
    // Render the chat history
    function renderChat() {
        if (!history || !Array.isArray(history)) {
            console.warn('No chat history available or invalid history format');
            chatBox.innerHTML = "";
            return;
        }

        chatBox.innerHTML = "";
        history.forEach((h, index) => {
            if (h && h.question && h.answer) {
                // Sanitize and format messages
                const sanitizedQuestion = h.question.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                let sanitizedAnswer = h.answer.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // Format the bot's answer to properly display newlines
                const formattedAnswer = sanitizedAnswer.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
                
                // Add messages to chat box
                chatBox.innerHTML += `
                    <div class="user-message"><strong>You:</strong> ${sanitizedQuestion}</div>
                    <div class="bot-message"><strong>Bot:</strong> ${formattedAnswer}</div>
                `;
            } else {
                console.warn(`Invalid message format at index ${index}`);
            }
        });
        
        // Scroll to bottom after rendering
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    // Download the conversation as a text file
    function downloadConversation() {
        if (!plantClass || history.length === 0) {
            return alert("No conversation yet!");
        }
        let content = `Conversation about ${plantClass}\n\n`;
        history.forEach((h, i) => {
            content += `Q${i+1}: ${h.question}\nA${i+1}: ${h.answer}\n\n`;
        });
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${plantClass}_conversation.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Print the conversation
    function printConversation() {
        window.print();
    }
    
    // Share conversation on WhatsApp
    function shareOnWhatsApp() {
        if (!plantClass || history.length === 0) {
            return alert("No conversation yet!");
        }
        
        let content = `Conversation about ${plantClass}\n\n`;
        history.forEach((h, i) => {
            content += `Q${i+1}: ${h.question}\nA${i+1}: ${h.answer}\n\n`;
        });
        
        // Encode the text for URL
        const encodedText = encodeURIComponent(content);
        
        // Create WhatsApp share URL
        const whatsappURL = `https://wa.me/?text=${encodedText}`;
        
        // Open in new window
        window.open(whatsappURL, '_blank');
    }
    
    // Event listeners for chat functionality
    askBtn.addEventListener('click', askQuestion);
    questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
    downloadBtn.addEventListener('click', downloadConversation);
    printBtn.addEventListener('click', printConversation);
    document.getElementById('share-btn').addEventListener('click', shareOnWhatsApp);
    
    // Function to load chat history
    async function loadChatHistory() {
        try {
            const response = await fetch('/history');
            const data = await response.json();
            
            if (data.status === 'success') {
                plantClass = data.plant;
                history = data.history || [];
                
                if (plantClass && plantClass !== 'Unknown plant') {
                    document.getElementById("plant-name").innerHTML = "🌿 Current Plant: <strong>" + plantClass + "</strong>";
                    console.log("Loading history:", history.length, "messages");
                    renderChat();
                }
            } else {
                console.warn('No chat history available:', data.message);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
    
    // Initial load of chat history
    loadChatHistory();
});