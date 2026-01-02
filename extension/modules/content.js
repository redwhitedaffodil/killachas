// content.js - Entry point for extension
(async () => {
    // Wait for settings
    const settings = await chrome.runtime.sendMessage({ type: 'getSettings' });
    
    if (! settings.enabled) {
        console.log('[Overlay] Disabled');
        return;
    }
    
    // Initialize overlay (using same classes from modules)
    const overlay = new ChessOverlay(settings);
    await overlay.init();
    
    // Listen for settings updates
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg. type === 'settingsUpdated') {
            overlay.updateSettings(msg.settings);
        }
        if (msg.type === 'reconnect') {
            overlay. reconnect();
        }
    });
    
    window.__chessOverlay = overlay;
})();
