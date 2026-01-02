// board-mutation-observer.js - Advanced MutationObserver for Chess.com
class BoardMutationObserver {
    constructor(boardHandler) {
        this.boardHandler = boardHandler;
        this. observer = null;
        this.isObserving = false;
        
        // Callbacks
        this.onMove = null;
        this.onGameStart = null;
        this.onGameEnd = null;
        this.onBoardFlip = null;
        this.onPremove = null;
        this.onHighlightChange = null;
        
        // State tracking
        this.lastFen = null;
        this.lastPieceCount = 0;
        this.lastMoveSquares = { from: null, to: null };
        this.isFlipped = false;
        this. moveHistory = [];
        
        // Debouncing
        this.debounceTimer = null;
        this.debounceDelay = 150;
        
        // Batch mutation processing
        this.mutationQueue = [];
        this. processingMutations = false;
    }

    // ═══════════════════════════════════════════════════════════
    // OBSERVER SETUP
    // ═══════════════════════════════════════════════════════════

    attach() {
        if (! this.boardHandler.board) {
            console.error('[Observer] Board not attached');
            return false;
        }
        
        // Store initial state
        this.lastFen = this.boardHandler.extractFullFEN();
        this.lastPieceCount = this._countPieces();
        this.isFlipped = this.boardHandler. board.classList.contains('flipped');
        
        // Create observer with specific configuration
        this.observer = new MutationObserver((mutations) => {
            this._queueMutations(mutations);
        });
        
        // Observe the board element
        this.observer.observe(this.boardHandler.board, {
            childList: true,      // Piece additions/removals
            subtree:  true,        // All descendants
            attributes: true,     // Class/style changes
            attributeFilter: [    // Only these attributes
                'class',
                'style',
                'transform',
                'data-square'
            ],
            characterData: false, // No text changes needed
            attributeOldValue: true // Track old values for comparison
        });
        
        // Also observe the game container for game state changes
        this._observeGameContainer();
        
        this.isObserving = true;
        console.log('[Observer] Attached to board');
        
        return true;
    }

    _observeGameContainer() {
        // Chess.com specific: observe game state elements
        const gameContainer = document.querySelector('.game-controls, .live-game-buttons, .board-layout-main');
        
        if (gameContainer) {
            const gameObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    // Check for game end indicators
                    if (mutation.type === 'childList') {
                        const addedNodes = Array.from(mutation.addedNodes);
                        
                        // Game result modal
                        const resultModal = addedNodes.find(node => 
                            node.classList?. contains('game-over-modal') ||
                            node.querySelector?. ('.game-over-modal')
                        );
                        
                        if (resultModal) {
                            this._handleGameEnd(resultModal);
                        }
                        
                        // New game started
                        const newGameIndicator = addedNodes.find(node =>
                            node.classList?.contains('board-layout-newgame') ||
                            node.querySelector?. ('.board-layout-newgame')
                        );
                        
                        if (newGameIndicator) {
                            this._handleGameStart();
                        }
                    }
                }
            });
            
            gameObserver.observe(gameContainer, {
                childList: true,
                subtree:  true
            });
        }
    }

    detach() {
        if (this.observer) {
            this. observer.disconnect();
            this.observer = null;
        }
        this.isObserving = false;
        clearTimeout(this.debounceTimer);
        console.log('[Observer] Detached from board');
    }

    // ═══════════════════════════════════════════════════════════
    // MUTATION PROCESSING
    // ═══════════════════════════════════════════════════════════

    _queueMutations(mutations) {
        this.mutationQueue.push(...mutations);
        
        // Debounce processing
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this._processMutationQueue();
        }, this.debounceDelay);
    }

    _processMutationQueue() {
        if (this.processingMutations || this.mutationQueue.length === 0) {
            return;
        }
        
        this.processingMutations = true;
        const mutations = [... this.mutationQueue];
        this.mutationQueue = [];
        
        try {
            const analysis = this._analyzeMutations(mutations);
            
            if (analysis.hasPieceMove) {
                this._handlePieceMove(analysis);
            }
            
            if (analysis.hasBoardFlip) {
                this._handleBoardFlip();
            }
            
            if (analysis.hasHighlightChange) {
                this._handleHighlightChange(analysis. highlights);
            }
            
            if (analysis.hasPremove) {
                this._handlePremove(analysis. premoveSquares);
            }
            
        } catch (error) {
            console. error('[Observer] Error processing mutations:', error);
        }
        
        this.processingMutations = false;
    }

    _analyzeMutations(mutations) {
        const analysis = {
            hasPieceMove: false,
            hasBoardFlip: false,
            hasHighlightChange: false,
            hasPremove: false,
            pieceChanges: [],
            highlights: [],
            premoveSquares: [],
            movedPieces: new Map()
        };
        
        for (const mutation of mutations) {
            // Attribute changes (piece movement via class change)
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                
                // Piece position change
                if (target.classList?. contains('piece') && mutation.attributeName === 'class') {
                    const oldClass = mutation.oldValue || '';
                    const newClass = target.className;
                    
                    const oldSquare = this._extractSquareFromClass(oldClass);
                    const newSquare = this._extractSquareFromClass(newClass);
                    
                    if (oldSquare && newSquare && oldSquare !== newSquare) {
                        analysis.hasPieceMove = true;
                        analysis.movedPieces.set(target, {
                            from: oldSquare,
                            to:  newSquare,
                            piece: this._extractPieceType(newClass)
                        });
                    }
                }
                
                // Board flip detection
                if (target === this.boardHandler.board && mutation.attributeName === 'class') {
                    const wasFlipped = mutation.oldValue?. includes('flipped') || false;
                    const isFlipped = target.classList. contains('flipped');
                    
                    if (wasFlipped !== isFlipped) {
                        analysis.hasBoardFlip = true;
                    }
                }
                
                // Highlight changes
                if (target.classList?.contains('highlight')) {
                    analysis.hasHighlightChange = true;
                }
            }
            
            // Child node changes (piece capture, promotion, highlight add/remove)
            if (mutation.type === 'childList') {
                // Added nodes
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    
                    // New piece (promotion, etc.)
                    if (node. classList?.contains('piece')) {
                        analysis.hasPieceMove = true;
                        analysis.pieceChanges.push({
                            type: 'add',
                            element: node,
                            square: this._extractSquareFromClass(node.className),
                            piece: this._extractPieceType(node.className)
                        });
                    }
                    
                    // Highlight added
                    if (node.classList?. contains('highlight')) {
                        analysis.hasHighlightChange = true;
                        const square = this._extractSquareFromClass(node.className);
                        const style = node.getAttribute('style') || '';
                        
                        analysis.highlights.push({
                            type: 'add',
                            square: square,
                            color: this._extractColorFromStyle(style),
                            isPremove: style.includes('rgb(244, 42, 65)') // Chess.com premove color
                        });
                        
                        if (analysis.highlights[analysis.highlights.length - 1].isPremove) {
                            analysis.hasPremove = true;
                            analysis.premoveSquares.push(square);
                        }
                    }
                }
                
                // Removed nodes
                for (const node of mutation.removedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    
                    // Piece removed (capture)
                    if (node.classList?.contains('piece')) {
                        analysis.hasPieceMove = true;
                        analysis. pieceChanges.push({
                            type: 'remove',
                            element: node,
                            square: this._extractSquareFromClass(node.className),
                            piece: this._extractPieceType(node.className)
                        });
                    }
                    
                    // Highlight removed
                    if (node.classList?.contains('highlight')) {
                        analysis.hasHighlightChange = true;
                        analysis.highlights.push({
                            type: 'remove',
                            square: this._extractSquareFromClass(node.className)
                        });
                    }
                }
            }
        }
        
        return analysis;
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════

    _handlePieceMove(analysis) {
        const currentFen = this.boardHandler.extractFullFEN();
        
        // Skip if FEN hasn't changed (animation artifacts)
        if (currentFen === this.lastFen) {
            return;
        }
        
        // Determine the move
        let move = null;
        
        // Try to extract move from piece movements
        if (analysis.movedPieces.size > 0) {
            // Primary piece movement
            const [, moveData] = analysis.movedPieces.entries().next().value;
            move = {
                from: this. boardHandler.numericToAlgebraic(moveData.from),
                to: this.boardHandler.numericToAlgebraic(moveData.to),
                piece: moveData.piece,
                capture: analysis.pieceChanges.some(c => c.type === 'remove'),
                promotion: null
            };
            
            // Check for promotion
            const promotedPiece = analysis.pieceChanges.find(c => 
                c.type === 'add' && 
                c.square === moveData.to &&
                ! ['wp', 'bp']. includes(c.piece)
            );
            
            if (promotedPiece) {
                move.promotion = promotedPiece.piece[1]; // 'q', 'r', 'b', 'n'
            }
            
            // Check for castling
            if (moveData.piece === 'wk' || moveData.piece === 'bk') {
                const fromFile = parseInt(moveData.from[0]);
                const toFile = parseInt(moveData.to[0]);
                
                if (Math.abs(toFile - fromFile) === 2) {
                    move.castling = toFile > fromFile ? 'kingside' : 'queenside';
                }
            }
        }
        
        // Track move
        this.lastMoveSquares = move ?  { from: move.from, to: move.to } : { from: null, to: null };
        this.lastFen = currentFen;
        this.lastPieceCount = this._countPieces();
        
        if (move) {
            this. moveHistory.push({
                ... move,
                fen: currentFen,
                timestamp: Date.now()
            });
        }
        
        // Emit callback
        this.onMove?. ({
            fen: currentFen,
            move: move,
            pieceCount: this. lastPieceCount,
            moveNumber: this.moveHistory.length
        });
    }

    _handleBoardFlip() {
        this.isFlipped = this.boardHandler.board.classList. contains('flipped');
        console.log('[Observer] Board flipped:', this.isFlipped ?  'black' : 'white');
        
        this.onBoardFlip? .(this.isFlipped);
    }

    _handleHighlightChange(highlights) {
        const moveHighlights = highlights.filter(h => 
            h.type === 'add' && ! h.isPremove
        );
        
        this.onHighlightChange?. ({
            highlights: moveHighlights,
            lastMoveSquares: this.lastMoveSquares
        });
    }

    _handlePremove(squares) {
        if (squares.length >= 2) {
            const from = this.boardHandler.numericToAlgebraic(squares[0]);
            const to = this.boardHandler.numericToAlgebraic(squares[1]);
            
            console.log('[Observer] Premove detected:', from, '->', to);
            
            this.onPremove?.({
                from: from,
                to: to,
                uci: from + to
            });
        }
    }

    _handleGameStart() {
        console.log('[Observer] New game started');
        
        this.moveHistory = [];
        this.lastFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        this.lastPieceCount = 32;
        this.lastMoveSquares = { from:  null, to: null };
        
        this.onGameStart?.();
    }

    _handleGameEnd(resultElement) {
        let result = 'unknown';
        let winner = null;
        
        // Try to extract result from element
        const resultText = resultElement.textContent?. toLowerCase() || '';
        
        if (resultText.includes('checkmate')) {
            result = 'checkmate';
            winner = resultText.includes('white') ? 'white' : 
                     resultText.includes('black') ? 'black' : null;
        } else if (resultText.includes('resign')) {
            result = 'resignation';
        } else if (resultText.includes('timeout')) {
            result = 'timeout';
        } else if (resultText.includes('draw') || resultText.includes('stalemate')) {
            result = 'draw';
        }
        
        console.log('[Observer] Game ended:', result);
        
        this.onGameEnd?.({
            result: result,
            winner: winner,
            moveCount: this.moveHistory.length,
            moveHistory: [... this.moveHistory]
        });
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════

    _extractSquareFromClass(className) {
        const match = className.match(/square-(\d{2})/);
        return match ?  match[1] : null;
    }

    _extractPieceType(className) {
        const match = className.match(/\b([wb][pnbrqk])\b/);
        return match ?  match[1] : null;
    }

    _extractColorFromStyle(style) {
        const match = style.match(/background-color:\s*([^;]+)/);
        return match ? match[1]. trim() : null;
    }

    _countPieces() {
        return this.boardHandler.board.querySelectorAll('.piece').length;
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════

    getCurrentFen() {
        return this.lastFen;
    }

    getMoveHistory() {
        return [... this.moveHistory];
    }

    getLastMove() {
        return this.moveHistory. length > 0 
            ? this.moveHistory[this.moveHistory.length - 1] 
            : null;
    }

    isMyTurn(playerColor) {
        // Determine from FEN whose turn it is
        const fen = this.lastFen || '';
        const turnIndicator = fen.split(' ')[1];
        
        if (playerColor === 'white') {
            return turnIndicator === 'w';
        } else if (playerColor === 'black') {
            return turnIndicator === 'b';
        }
        
        return true; // Default to true if unknown
    }

    setDebounceDelay(ms) {
        this.debounceDelay = ms;
    }
}
