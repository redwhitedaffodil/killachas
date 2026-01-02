// ==UserScript==
// @name         Chess Analysis Overlay
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Real-time Stockfish analysis overlay for chess websites
// @match        https://www.chess.com/*
// @match        https://lichess.org/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    // Sandbox protection - store clean references
    const V_sandbox = {
        Worker: window.Worker. bind(window),
        setTimeout: window.setTimeout.bind(window),
        console: { ... console },
        Math: { ...Math },
        fetch: window.fetch.bind(window)
    };

    // [Include all module classes here or use @require]
    // ...  StockfishEngine, BoardObserver, OverlayUI, InputSimulator ... 

    class ChessAnalysisOverlay {
        constructor() {
            this.engine = new StockfishEngine();
            this.observer = new BoardObserver();
            this.ui = new OverlayUI();
            this.simulator = null;
            this.autoPlay = false;
            this.lastFen = null;
        }

        async init() {
            V_sandbox.console.log('[Overlay] Initializing...');
            
            // Step 1: Inject UI
            this.ui.inject();
            
            // Step 2: Start engine
            await this.engine.init();
            V_sandbox.console.log('[Overlay] Stockfish ready');
            
            // Step 3: Attach board observer
            if (! this.observer.attach()) {
                V_sandbox.console.error('[Overlay] Failed to find board');
                return;
            }
            
            this.simulator = new InputSimulator(this. observer.boardElement);
            
            // Step 4: Wire up callbacks
            this.engine.onAnalysis = (data) => {
                this.ui.updateScore(data. score, data.depth);
                if (data.pv[0]) {
                    this.ui. updateBestMove(data.pv[0]);
                    this.ui.highlightMove(data.pv[0], this.observer.boardElement);
                }
            };
            
            this.engine.onBestMove = (move) => {
                this.ui.updateBestMove(move);
                this.ui.highlightMove(move, this.observer.boardElement);
                
                if (this.autoPlay) {
                    this.simulator.playMove(move);
                }
            };
            
            this.observer.onBoardChange = (fen) => {
                if (fen !== this.lastFen) {
                    this.lastFen = fen;
                    this.ui.clearHighlights();
                    this.engine.analyze(fen, 18);
                }
            };
            
            // Initial analysis
            const initialFen = this.observer.extractFEN();
            if (initialFen) {
                this.engine.analyze(initialFen, 18);
            }
            
            V_sandbox. console.log('[Overlay] Ready! ');
        }
    }

    // Wait for page to fully load, then initialize
    V_sandbox.setTimeout(() => {
        const overlay = new ChessAnalysisOverlay();
        overlay.init();
        
        // Expose for debugging
        window.__chessOverlay = overlay;
    }, 2000);
})();
