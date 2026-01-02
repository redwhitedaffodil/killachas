// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings
    const settings = await chrome.storage.local.get(null);
    
    document.getElementById('serverUrl').value = settings.serverUrl || 'ws://localhost:8000/ws';
    document.getElementById('depth').value = settings.depth || 22;
    document.getElementById('multiPV').value = settings.multiPV || 3;
    document.getElementById('moveMethod').value = settings.moveMethod || 'mouseclick';
    document.getElementById('autoPlay').checked = settings.autoPlay || false;
    document.getElementById('enabled').checked = settings.enabled !== false;
    
    // Check server status
    checkServerStatus(settings.apiUrl || 'http://localhost:8000');
    
    // Save button
    document.getElementById('save').onclick = async () => {
        const newSettings = {
            serverUrl:  document.getElementById('serverUrl').value,
            apiUrl: document.getElementById('serverUrl').value.replace('ws://', 'http://').replace('/ws', ''),
            depth:  parseInt(document.getElementById('depth').value),
            multiPV:  parseInt(document.getElementById('multiPV').value),
            moveMethod: document.getElementById('moveMethod').value,
            autoPlay: document.getElementById('autoPlay').checked,
            enabled: document.getElementById('enabled').checked
        };
        
        await chrome.storage.local.set(newSettings);
        
        // Notify content script
        const [tab] = await chrome.tabs. query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings: newSettings });
        
        window.close();
    };
    
    // Reconnect button
    document.getElementById('reconnect').onclick = async () => {
        const [tab] = await chrome.tabs. query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'reconnect' });
    };
});

async function checkServerStatus(apiUrl) {
    const status = document.getElementById('status');
    try {
        const res = await fetch(`${apiUrl}/health`);
        const data = await res.json();
        status.classList.toggle('online', data.status === 'online');
    } catch {
        status.classList.remove('online');
    }
}
