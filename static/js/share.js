document.addEventListener('DOMContentLoaded', function() {
    const shareBtn = document.getElementById('share-btn');
    const sharePopup = document.getElementById('share-popup');
    const closeSharePopup = document.getElementById('close-share-popup');
    const shareWhatsApp = document.getElementById('share-whatsapp');
    const shareGmail = document.getElementById('share-gmail');
    const chatBox = document.getElementById('chat-box');
    const plantNameElement = document.getElementById('plant-name');

    // Function to format the conversation content
    function getConversationContent() {
        // Get plant name
        const plantName = plantNameElement ? plantNameElement.textContent : '';
        
        // Start with plant name
        let content = `Conversation about ${plantName}\n\n`;

        // Get all messages
        if (chatBox) {
            const userMessages = chatBox.getElementsByClassName('user-message');
            const botMessages = chatBox.getElementsByClassName('bot-message');
            
            // Process messages
            for (let i = 0; i < userMessages.length; i++) {
                const userText = userMessages[i].textContent.replace('You:', '').trim();
                const botText = botMessages[i] ? botMessages[i].textContent.replace('Bot:', '').trim() : '';
                
                // Add question with proper spacing
                content += `Q${i + 1}: ${userText}\n`;
                
                if (botText) {
                    // Add answer label
                    content += `A${i + 1}: `;
                    
                    // Split the bot's answer into lines and process each section
                    const sections = botText.split('\n\n').map(section => section.trim()).filter(section => section);
                    
                    sections.forEach((section, sectionIndex) => {
                        if (sectionIndex > 0) {
                            content += '\n';  // Add extra line between sections
                        }
                        
                        const lines = section.split('\n').map(line => line.trim()).filter(line => line);
                        
                        lines.forEach((line, lineIndex) => {
                            // Main heading (ends with :)
                            if (line.endsWith(':')) {
                                content += `*   *${line}*\n`;
                            }
                            // Sub-points (starts with - or •)
                            else if (line.startsWith('-') || line.startsWith('•')) {
                                content += `    *   ${line.substring(1).trim()}\n`;
                            }
                            // Regular bullet points
                            else {
                                content += `*   ${line}\n`;
                            }
                        });
                    });
                    
                    // Add one line break after each Q&A pair
                    content += '\n';
                }
            }
        }

        return content.trim();  // Remove any trailing whitespace
    }

    // Function to show popup
    function showSharePopup(e) {
        e.preventDefault(); // Prevent any default action
        e.stopPropagation(); // Stop event bubbling
        sharePopup.classList.add('active');
    }

    // Function to hide popup
    function hideSharePopup() {
        sharePopup.classList.remove('active');
    }

    // Share on WhatsApp
    function shareOnWhatsApp(e) {
        e.preventDefault();
        const content = getConversationContent();
        const encodedContent = encodeURIComponent(content);
        const whatsappUrl = `https://wa.me/?text=${encodedContent}`;
        window.open(whatsappUrl, '_blank');
        hideSharePopup();
    }

    // Share via Gmail
    function shareViaGmail(e) {
        e.preventDefault();
        const content = getConversationContent();
        const subject = encodeURIComponent('Medicinal Plant Information');
        const body = encodeURIComponent(content);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
        hideSharePopup();
    }

    // Event Listeners
    if (shareBtn) {
        // Remove any existing click listeners
        shareBtn.replaceWith(shareBtn.cloneNode(true));
        // Get the new button reference
        const newShareBtn = document.getElementById('share-btn');
        // Add new click listener
        newShareBtn.addEventListener('click', showSharePopup);
    }

    if (closeSharePopup) {
        closeSharePopup.addEventListener('click', hideSharePopup);
    }

    if (shareWhatsApp) {
        shareWhatsApp.addEventListener('click', shareOnWhatsApp);
    }

    if (shareGmail) {
        shareGmail.addEventListener('click', shareViaGmail);
    }

    // Close popup when clicking outside
    if (sharePopup) {
        sharePopup.addEventListener('click', function(e) {
            if (e.target === sharePopup) {
                hideSharePopup();
            }
        });
    }

    // Prevent popup close when clicking inside popup content
    const popupContent = document.querySelector('.share-popup-content');
    if (popupContent) {
        popupContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});