import { computeCoverTransform } from './utils.js';

export function setupInteraction(canvas, items, getProcessedBedroom, getTransform) {
    let activeItem = null;
    // Store offset from item center/top-left to mouse click position in normalized coordinates
    let dragOffset = { x: 0, y: 0 };

    const handleDown = (e) => {
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Iterate backwards (assuming last item is rendered on top)
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const state = item.state;
            
            if (
                state.rect &&
                x >= state.rect.x &&
                x <= state.rect.x + state.rect.w &&
                y >= state.rect.y &&
                y <= state.rect.y + state.rect.h
            ) {
                activeItem = item;
                state.dragging = true;
                
                // Calculate grab offset in image-normalized coordinates
                // We need the current transform to do this reverse projection
                const processedBedroom = getProcessedBedroom();
                if (processedBedroom) {
                    const { canvas: bedroomCanvas } = processedBedroom;
                    const transform = getTransform ? getTransform() : computeCoverTransform(
                        bedroomCanvas.width,
                        bedroomCanvas.height,
                        canvas.width,
                        canvas.height
                    );
                    
                    // Mouse pos in image coords (0-1)
                    const mouseImageX = (x - transform.offsetX) / transform.renderW;
                    const mouseImageY = (y - transform.offsetY) / transform.renderH;
                    
                    // Offset relative to the item's current position
                    dragOffset = {
                        x: mouseImageX - state.x,
                        y: mouseImageY - state.y
                    };
                }

                if (e.type === 'touchstart') e.preventDefault();
                break;
            }
        }
    };

    const handleMove = (e) => {
        if (!activeItem) return;
        const state = activeItem.state;
        if (!state.dragging) return;

        const processedBedroom = getProcessedBedroom();
        if (!processedBedroom) return;

        if (e.type === 'touchmove') e.preventDefault();

        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        const rect = canvas.getBoundingClientRect();
        const currentX = clientX - rect.left;
        const currentY = clientY - rect.top;

        const { canvas: bedroomCanvas } = processedBedroom;
        
        // Use provided transform getter to support panning
        const transform = getTransform ? getTransform() : computeCoverTransform(
            bedroomCanvas.width,
            bedroomCanvas.height,
            canvas.width,
            canvas.height
        );

        // Project screen position back to image normalized coordinates
        const mouseImageX = (currentX - transform.offsetX) / transform.renderW;
        const mouseImageY = (currentY - transform.offsetY) / transform.renderH;

        // Apply original drag offset to keep item under cursor correctly
        state.x = mouseImageX - dragOffset.x;
        state.y = mouseImageY - dragOffset.y;

        console.log(`Position [${activeItem.id}]:`, {
            x: state.x,
            y: state.y
        });
    };

    const handleUp = () => {
        if (activeItem) {
            activeItem.state.dragging = false;
            activeItem = null;
        }
    };

    canvas.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    canvas.addEventListener('touchstart', handleDown, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
}