// input-manager.js - Unified Move Input Manager
class InputManager {
    constructor(boardElement) {
        this.board = boardElement;
        this. teleport = new TeleportMover(boardElement);
        this.mouseClick = new MouseClickMover(boardElement);
        
        // Configuration
        this.preferredMethod = 'mouseclick'; // 'teleport' | 'mouseclick'
        this.fallbackEnabled = true;
    }

    async playMove(move, method = null) {
        const useMethod = method || this.preferredMethod;
        
        console.debug(`[InputManager] Playing ${move} via ${useMethod}`);
        
        let success = false;
        
        if (useMethod === 'teleport') {
            success = this. teleport.playMove(move);
            if (!success && this.fallbackEnabled) {
                console.debug('[InputManager] Teleport failed, falling back to mouse click');
                success = await this.mouseClick.playMove(move);
            }
        } else {
            success = await this.mouseClick.playMove(move);
            if (!success && this.fallbackEnabled) {
                console.debug('[InputManager] Mouse click failed, falling back to teleport');
                success = this.teleport.playMove(move);
            }
        }
        
        if (! success) {
            console.error('[InputManager] All move methods failed for:', move);
        }
        
        return success;
    }

    // Configure mouse click behavior
    setClickConfig(config) {
        Object.assign(this.mouseClick. config, config);
    }

    // Toggle drag vs click-click
    setDragMode(enabled) {
        this.mouseClick.config.useDragMethod = enabled;
    }
}
