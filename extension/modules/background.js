// background.js - Service Worker for persistent connections
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed');
    
    // Set default settings
    chrome.storage.local.set({
        serverUrl: 'ws://localhost:8000/ws',
        apiUrl: 'http://localhost:8000',
        depth: 22,
        multiPV: 3,
        autoPlay: false,
        moveMethod: 'mouseclick',
        enabled: true
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getSettings') {
        chrome.storage.local.get(null, (settings) => {
            sendResponse(settings);
        });
        return true; // Async response
    }
    
    if (request.type === 'saveSettings') {
        chrome.storage.local.set(request.settings, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});
