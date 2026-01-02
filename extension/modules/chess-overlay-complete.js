// chess-overlay-complete.js - Complete overlay with MultiPV and MutationObserver
class ChessAnalysisOverlay {
    constructor(config = {}) {
        this.config = {
            serverUrl: 'ws://localhost:8000/ws',
            defaultDepth: 22,
            defaultMultiPV: 3,
            autoPlay: false,
            moveMethod: 'mouseclick',
            ... config
        };
        
        this.engine = new EngineWebSocketClient(this.config.serverUrl);
        this.boardHandler = new ChessComBoardHandler();
        this.observer = null;
        this.ui = null;
        
        this.analysisDepth = this.config.defaultDepth;
        this.multiPVCount = this.config.defaultMultiPV;
        this.autoPlay = this.config.autoPlay;
        this.moveMethod = this.config.moveMethod;
        this.playerColor = null; // 'white', 'black', or null for analysis
    }

    async init() {
        console.log('[Overlay] Initializing...');
        
        // 1. Check backend
        const isOnline = await this.engine.checkHealth();
        if (!isOnline) {
            this._showServerError();
            return false;
        }
        
        // 2. Connect WebSocket
        try {
            await this.engine.connect();
        } catch (error) {
            console.error('[Overlay] WebSocket failed:', error);
            return false;
        }
        
        // 3. Attach board handler
        if (! this.boardHandler.attach()) {
            console.error('[Overlay] Board not found');
            return false;
        }
        
        // 4. Set up MutationObserver
        this.observer = new BoardMutationObserver(this.boardHandler);
        this._setupObserverCallbacks();
        this.observer.attach();
        
        // 5. Create UI
        this.ui = new OverlayUI();
        this. ui.inject();
        this._setupUICallbacks();
        
        // 6. Set up engine callbacks
        this._setupEngineCallbacks();
        
        // 7. Load engine list
        await this._loadEngines();
        
        // 8. Set initial MultiPV
        this.engine.setMultiPV(this.multiPVCount);
        
        // 9. Initial analysis
        const fen = this.boardHandler.extractFullFEN();
        if (fen) {
            this.engine.analyze(fen, { 
                depth: this.analysisDepth,
                multipv:  this.multiPVCount
            });
        }
        
        // 10. Detect player color
        this._detectPlayerColor();
        
        console.log('[Overlay] Ready! ');
        return true;
    }

    _setupObserverCallbacks() {
        // Main move detection
        this.observer.onMove = (data) => {
            console.log('[Overlay] Move detected:', data. move);
            
            // Clear old highlights
            this.boardHandler.clearHighlight();
            
            // Analyze new position
            this.engine.analyze(data.fen, {
                depth: this.analysisDepth,
                multipv: this. multiPVCount
            });
        };
        
        // New game
        this.observer.onGameStart = () => {
            console.log('[Overlay] New game');
            this. engine.newGame();
            this.boardHandler.clearHighlight();
            this._detectPlayerColor();
            
            // Analyze starting position
            setTimeout(() => {
                const fen = this.boardHandler. extractFullFEN();
                this.engine.analyze(fen, {
                    depth: this.analysisDepth,
                    multipv: this.multiPVCount
                });
            }, 500);
        };
        
        // Game end
        this.observer.onGameEnd = (data) => {
            console.log('[Overlay] Game over:', data.result);
            this.engine.stop();
        };
        
        // Board flip
        this.observer.onBoardFlip = (isFlipped) => {
            console.log('[Overlay] Board flipped:', isFlipped);
            this._detectPlayerColor();
        };
        
        // Premove detection
        this.observer.onPremove = (premove) => {
            console.log('[Overlay] Premove:', premove. uci);
        };
    }

    _setupEngineCallbacks() {
        // Primary analysis (line 1)
        this.engine.onAnalysis = (data) => {
            this.ui.updateScore(data.score, data.depth, data.scoreType);
            this.ui.updateNPS(data.nps);
            
            if (data.pv && data.pv[0]) {
                this.ui.updateBestMove(data.pv[0]);
                this.boardHandler.clearHighlight();
                this.boardHandler.highlightMove(data.pv[0]);
            }
        };
        
        // MultiPV updates
        this.engine.onMultiPVUpdate = (lines) => {
            this.ui. updateMultiPV(lines);
        };
        
        // Best move found
        this.engine.onBestMove = async (move, ponder, allLines) => {
            console.log('[Overlay] Best move:', move);
            
            this.ui.updateBestMove(move);
            this.boardHandler.clearHighlight();
            this.boardHandler.highlightMove(move);
            
            // Auto-play if enabled and it's our turn
            if (this.autoPlay && this._isMyTurn()) {
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

    _setupUICallbacks() {
        // MultiPV count change
        this.ui.onMultiPVChange = (count) => {
            this.multiPVCount = count;
            this.engine.setMultiPV(count);
            
            // Re-analyze current position
            const fen = this.boardHandler.extractFullFEN();
            if (fen) {
                this.engine.analyze(fen, {
                    depth: this.analysisDepth,
                    multipv: count
                });
            }
        };
        
        // Auto-play toggle
        this.ui. onAutoPlayChange = (enabled) => {
            this.autoPlay = enabled;
            console.log('[Overlay] Auto-play:', enabled);
        };
        
        // Move method change
        this.ui.onMoveMethodChange = (method) => {
            this.moveMethod = method;
            console.log('[Overlay] Move method:', method);
        };
        
        // Line click (highlight alternative move)
        this.ui.onLineClick = (line) => {
            if (line.pv && line.pv[0]) {
                this. boardHandler.clearHighlight();
                this.boardHandler.highlightMove(line. pv[0], 
                    'rgb(255, 193, 7)', // Alt color
                    'rgb(255, 152, 0)'
                );
            }
        };
    }

    async _loadEngines() {
        const { engines, active } = await this.engine.listEngines();
        
        if (engines.length > 0) {
            this. ui.createEngineSelector(engines, active, async (name) => {
                const success = await this.engine.setEngine(name);
                if (success) {
                    this. engine.setMultiPV(this.multiPVCount);
                    
                    const fen = this.boardHandler. extractFullFEN();
                    if (fen) {
                        this.engine.newGame();
                        this.engine.analyze(fen, {
                            depth: this.analysisDepth,
                            multipv: this.multiPVCount
                        });
                    }
                }
            });
        }
    }

    _detectPlayerColor() {
        // Chess.com specific:  detect player color from board orientation and UI
        const isFlipped = this.boardHandler.board.classList.contains('flipped');
        const playerElement = document.querySelector('.player-component. player-bottom . user-username-component');
        
        // If board is flipped, we're likely playing as black
        this.playerColor = isFlipped ?  'black' : 'white';
        
        console.log('[Overlay] Player color:', this.playerColor);
    }

    _isMyTurn() {
        if (!this.playerColor) return true;
        return this.observer.isMyTurn(this.playerColor);
    }

    async _playMove(move) {
        if (this.moveMethod === 'teleport') {
            this.boardHandler.teleportMove(move);
        } else {
            await this.boardHandler.mouseClickMove(move);
        }
    }

    _showServerError() {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed;top:20px;right:20px;background: linear-gradient(135deg,#e74c3c,#c0392b);
                        color:#fff;padding:15px 20px;border-radius:10px;z-index:999999;
                        font-family:sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                <strong>⚠️ Chess Engine Server Offline</strong><br>
                <small style="opacity:0.9">Start with:  <code style="background: rgba(0,0,0,0.2);padding:2px 6px;border-radius:3px;">python unobs.py</code></small>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════

    setDepth(depth) {
        this.analysisDepth = depth;
    }

    setMultiPV(count) {
        this.multiPVCount = count;
        this.engine.setMultiPV(count);
    }

    setAutoPlay(enabled) {
        this.autoPlay = enabled;
    }

    setMoveMethod(method) {
        this.moveMethod = method;
    }

    async switchEngine(name) {
