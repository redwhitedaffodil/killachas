// In ChessAnalysisOverlay class
class ChessAnalysisOverlay {
    constructor() {
        // ...  other initialization
        this.inputManager = null;
        this.autoPlayMethod = 'mouseclick'; // User preference
    }

    async init() {
        // ... previous init code
        
        this.inputManager = new InputManager(this.observer. boardElement);
        
        // Configure based on site
        if (window.location.host.includes('chess.com')) {
            this.inputManager.setDragMode(false); // Chess.com prefers click-click
        } else if (window.location.host.includes('lichess')) {
            this.inputManager. setDragMode(true); // Lichess works well with drag
        }
        
        this.engine. onBestMove = async (move) => {
            this.ui.updateBestMove(move);
            this.ui.highlightMove(move, this.observer.boardElement);
            
            if (this.autoPlay) {
                await this.inputManager.playMove(move, this.autoPlayMethod);
            }
        };
    }
    
    // Public API to toggle method
    setMoveMethod(method) {
        this.autoPlayMethod = method; // 'teleport' or 'mouseclick'
    }
}
