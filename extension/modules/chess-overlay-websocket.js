// chess-overlay-websocket.js - Main overlay using WebSocket backend
class ChessAnalysisOverlay {
    constructor() {
        this.engine = new EngineWebSocketClient('ws://localhost:8000/ws');
        this.boardHandler = new ChessComBoardHandler();
        this.ui = null;
        
        this.autoPlay = false;
        this.autoPlayMethod = 'mouseclick'; // 'mouseclick' or 'teleport'
        this.lastFen = null;
        this.analysisDepth = 20;
    }

    async init() {
        console.log('[Overlay] Initializing.. .');
        
        // 1. Check backend health
        const isOnline = await this.engine.checkHealth();
        if (!isOnline) {
            console.error('[Overlay] Backend server not running! ');
            console.log('[Overlay] Start the server with: python unobs.py');
            this._showServerError();
            return false;
        }
        
        // 2. Connect WebSocket
        try {
            await this.engine. connect();
        } catch (error) {
            console.error('[Overlay] WebSocket connection failed:', error);
            return false;
        }
        
        // 3. Attach to board
        if (! this.boardHandler.attach()) {
            console.error('[Overlay] Board not found');
            return false;
        }
        
        // 4. Create UI
        this.ui = new OverlayUI();
        this.ui.inject();
        await this._createEngineSelector();
        
        // 5. Set up callbacks
        this._setupCallbacks();
        
        // 6. Set up board observer
        this._setupBoardObserver();
        
        // 7. Initial analysis
        const fen = this.boardHandler.extractFullFEN();
        if (fen) {
            this. engine.analyze(fen, { depth: this.analysisDepth });
        }
        
        console.log('[Overlay] Ready!');
        return true;
    }

    _setupCallbacks() {
        // Analysis updates
        this.engine.onAnalysis = (data) => {
            // Format score display
            let scoreText;
            if (data.scoreType === 'mate') {
                scoreText = data.score > 0 ? `M${data.score}` : `-M${Math.abs(data.score)}`;
            } else {
                scoreText = data.score > 0 ? `+${data.score. toFixed(1)}` : data.score.toFixed(1);
            }
            
            this.ui.updateScore(data.score, data.depth, data.scoreType);
            
            // Show best move from PV
            if (data.pv && data.pv[0]) {
                this.ui.updateBestMove(data.pv[0]);
                this.boardHandler.highlightMove(data.pv[0]);
            }
            
            // Show full line
            if (data.pv && data. pv.length > 1) {
                this.ui.updateLine(data.pv.slice(0, 5).join(' → '));
            }
        };
        
        // Best move (analysis complete)
        this.engine.onBestMove = async (move, ponder) => {
            console.log('[Overlay] Best move:', move, ponder ?  `(ponder: ${ponder})` : '');
            
            this.ui.updateBestMove(move);
            this.boardHandler.clearHighlight();
            this.boardHandler.highlightMove(move);
            
            // Auto-play if enabled
            if (this.autoPlay) {
                await this._playMove(move);
            }
        };
        
        // Connection status
        this.engine.onConnectionChange = (connected) => {
            this.ui.updateConnectionStatus(connected);
        };
        
        // Engine info
        this.engine.onEngineInfo = (info) => {
            if (info.type === 'name') {
                this.ui. updateEngineName(info.value);
            }
        };
    }

    _setupBoardObserver() {
        const observer = new MutationObserver((mutations) => {
            // Debounce
            clearTimeout(this._analysisTimer);
            this._analysisTimer = setTimeout(() => {
                const fen = this.boardHandler. extractFullFEN();
                
                if (fen && fen !== this.lastFen) {
                    this.lastFen = fen;
                    this.boardHandler.clearHighlight();
                    this. engine.analyze(fen, { depth: this.analysisDepth });
                }
            }, 200);
        });
        
        observer.observe(this.boardHandler.board, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    async _createEngineSelector() {
        const { engines, active } = await this.engine. listEngines();
        
        if (engines.length > 0) {
            this. ui.createEngineSelector(engines, active, async (engineName) => {
                const success = await this.engine.setEngine(engineName);
                if (success) {
                    // Re-analyze current position with new engine
                    const fen = this.boardHandler.extractFullFEN();
                    if (fen) {
                        this.engine.newGame();
                        this.engine.analyze(fen, { depth: this.analysisDepth });
                    }
                }
            });
        }
    }

    async _playMove(move) {
        if (this.autoPlayMethod === 'teleport') {
            this.boardHandler.teleportMove(move);
        } else {
            await this. boardHandler.mouseClickMove(move);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════

    setDepth(depth) {
        this.analysisDepth = depth;
    }

    setAutoPlay(enabled, method = 'mouseclick') {
        this.autoPlay = enabled;
        this.autoPlayMethod = method;
    }

    async switchEngine(name) {
        return await this.engine.setEngine(name);
    }

    _showServerError() {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed;top:20px;right:20px;background:#ff3333;color:#fff;
                        padding:15px;border-radius:8px;z-index:999999;font-family:sans-serif;">
                <strong>⚠️ Chess Engine Server Offline</strong><br>
                <small>Run: <code>python unobs.py</code></small>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
}

// Initialize
(async () => {
    // Wait for page load
    await new Promise(r => setTimeout(r, 2000));
    
    const overlay = new ChessAnalysisOverlay();
    await overlay. init();
    
    // Expose for console debugging
    window.__chessOverlay = overlay;
})();
