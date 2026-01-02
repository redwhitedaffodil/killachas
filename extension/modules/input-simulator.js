// input-simulator.js - Realistic Mouse Event Simulation
class InputSimulator {
    constructor(boardElement) {
        this.board = boardElement;
    }

    async playMove(move) {
        if (!move || move.length < 4) return;
        
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        const promotion = move[4]; // e.g., 'q' for queen
        
        const fromEl = this._getSquare(from);
        const toEl = this._getSquare(to);
        
        if (! fromEl || !toEl) {
            console.warn('[Overlay] Could not find squares for move:', move);
            return;
        }

        // Simulate realistic click sequence with delays
        await this._simulateClick(fromEl, 'mousedown');
        await this._delay(50 + Math.random() * 50);
        await this._simulateClick(fromEl, 'mouseup');
        await this._simulateClick(fromEl, 'click');
        
        await this._delay(100 + Math.random() * 100);
        
        await this._simulateClick(toEl, 'mousedown');
        await this._delay(30 + Math.random() * 30);
        await this._simulateClick(toEl, 'mouseup');
        await this._simulateClick(toEl, 'click');
        
        // Handle pawn promotion
        if (promotion) {
            await this._delay(200);
            await this._selectPromotion(promotion);
        }
    }

    _getSquare(sq) {
        const selectors = [
            `[data-square="${sq}"]`,
            `.square-${sq}`,
            `.square[data-square-coord="${sq}"]`
        ];
        for (const sel of selectors) {
            const el = this.board.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    _simulateClick(element, type) {
        const rect = element.getBoundingClientRect();
        const x = rect. left + rect.width / 2 + (Math.random() - 0.5) * 10;
        const y = rect.top + rect. height / 2 + (Math.random() - 0.5) * 10;
        
        const event = new MouseEvent(type, {
            view: window,
            bubbles:  true,
            cancelable: true,
            clientX: x,
            clientY: y,
            screenX: x + window.screenX,
            screenY: y + window.screenY,
            button: 0,
            buttons: type === 'mousedown' ? 1 : 0
        });
        
        element. dispatchEvent(event);
    }

    async _selectPromotion(piece) {
        const promoMap = { 'q': 'queen', 'r': 'rook', 'b': 'bishop', 'n': 'knight' };
        const promoEl = document.querySelector(
            `[data-piece="${promoMap[piece]}"], . promotion-${piece}, [class*="promo"][class*="${promoMap[piece]}"]`
        );
        if (promoEl) {
            await this._simulateClick(promoEl, 'click');
        }
    }

    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
