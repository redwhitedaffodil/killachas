// input-teleport.js - Direct Move Injection
class TeleportMover {
    constructor(boardElement) {
        this.board = boardElement;
    }

    playMove(move) {
        if (!move || move.length < 4) return false;
        
        const from = move.slice(0, 2);
        const to = move. slice(2, 4);
        const promotion = move[4] || '';

        // Method 1A: Hook into site's game API (fastest, cleanest)
        if (this._tryAPIMove(move)) return true;
        
        // Method 1B: Direct DOM teleport (manipulate piece elements)
        if (this._tryDOMTeleport(from, to, promotion)) return true;
        
        // Method 1C: Input field injection (some sites have hidden move inputs)
        if (this._tryInputInjection(move)) return true;
        
        return false;
    }

    _tryAPIMove(move) {
        // Chess.com - hook into game controller
        try {
            const gameController = 
                window.game ||
                window.chessboard?. game ||
                document.querySelector('chess-board')?.__vue__?.game ||
                document.querySelector('wc-chess-board')?.game;
            
            if (gameController?. move) {
                gameController.move(move);
                return true;
            }
            
            // Lichess uses a different structure
            if (window.lichess?.analysis?.study?.makeMove) {
                window.lichess.analysis.study.makeMove(move);
                return true;
            }
            
            // Lichess ground
            if (window.LichessAnalyse?.ground?.playPremove) {
                // Convert UCI to Lichess format
                window.LichessAnalyse. ground.playPremove();
                return true;
            }
        } catch (e) {
            console.debug('[Teleport] API hook failed:', e);
        }
        return false;
    }

    _tryDOMTeleport(from, to, promotion) {
        try {
            const pieceEl = this._findPieceOnSquare(from);
            if (!pieceEl) return false;
            
            // Get destination square coordinates
            const toSquareEl = this._findSquareElement(to);
            if (!toSquareEl) return false;
            
            // Chess.com style: Update class directly
            // Changes "piece wp square-e2" → "piece wp square-e4"
            const classMatch = pieceEl.className.match(/square-([a-h][1-8]|\d{2})/);
            if (classMatch) {
                pieceEl.classList.remove(classMatch[0]);
                pieceEl.classList.add(`square-${to}`);
                
                // Remove captured piece if any
                const capturedPiece = this._findPieceOnSquare(to, pieceEl);
                if (capturedPiece) {
                    capturedPiece.remove();
                }
                
                // Dispatch custom event to notify the site
                this. board.dispatchEvent(new CustomEvent('move', {
                    detail: { from, to, promotion },
                    bubbles: true
                }));
                
                return true;
            }
            
            // Lichess style: Update transform/style
            const toRect = toSquareEl.getBoundingClientRect();
            const boardRect = this.board.getBoundingClientRect();
            const squareSize = boardRect. width / 8;
            
            const fileIndex = to.charCodeAt(0) - 97; // a=0, h=7
            const rankIndex = parseInt(to[1]) - 1;   // 1=0, 8=7
            
            pieceEl.style.transform = `translate(${fileIndex * squareSize}px, ${(7 - rankIndex) * squareSize}px)`;
            
            return true;
        } catch (e) {
            console.debug('[Teleport] DOM teleport failed:', e);
        }
        return false;
    }

    _tryInputInjection(move) {
        try {
            // Some sites have hidden input fields for moves
            const moveInput = document.querySelector(
                'input[name="move"], input. move-input, [data-move-input]'
            );
            
            if (moveInput) {
                moveInput.value = move;
                moveInput.dispatchEvent(new Event('input', { bubbles: true }));
                moveInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Try to find and click submit
                const submitBtn = document.querySelector(
                    'button[type="submit"], . submit-move, [data-submit-move]'
                );
                if (submitBtn) submitBtn.click();
                
                return true;
            }
            
            // WebSocket injection (advanced) - intercept and send move message
            // This requires hooking into the site's WebSocket connection
            
        } catch (e) {
            console.debug('[Teleport] Input injection failed:', e);
        }
        return false;
    }

    _findPieceOnSquare(square, excludeEl = null) {
        const pieces = this.board.querySelectorAll('[class*="piece"]');
        for (const piece of pieces) {
            if (piece === excludeEl) continue;
            if (piece.className.includes(`square-${square}`)) {
                return piece;
            }
            // Check data attribute
            if (piece.dataset?. square === square) {
                return piece;
            }
        }
        return null;
    }

    _findSquareElement(square) {
        return this.board. querySelector(`[data-square="${square}"]`) ||
               this.board.querySelector(`.square-${square}`) ||
               this.board.querySelector(`[data-square-coord="${square}"]`);
    }
}
