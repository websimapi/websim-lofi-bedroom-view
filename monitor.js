let screenTempCanvas = null;

export function createMonitorState(monitorConfig) {
    return {
        x: monitorConfig.x,
        y: monitorConfig.y,
        dragging: false,
        dragStart: { x: 0, y: 0 },
        basePos: { x: 0, y: 0 },
        rect: { x: 0, y: 0, w: 0, h: 0 },
        // Screensaver state (normalized 0-1 relative to screen area)
        logoState: {
            x: 0.5,
            y: 0.5,
            vx: 0.002,
            vy: 0.002
        }
    };
}

export function drawMonitor(ctx, transform, monitorImg, processedMonitor, monitorConfig, monitorState, logoImg, timestamp) {
    const sourceImg = processedMonitor && processedMonitor.canvas ? processedMonitor.canvas : monitorImg;
    const screenMaskCanvas = processedMonitor ? processedMonitor.screenMaskCanvas : null;

    const scale = typeof monitorConfig.scale === 'number' ? monitorConfig.scale : 0.25;

    const blueScreenCfg = monitorConfig.blueScreen || {};
    const blueScaleX = typeof blueScreenCfg.scaleX === 'number' ? blueScreenCfg.scaleX : 1.0;
    const blueScaleY = typeof blueScreenCfg.scaleY === 'number' ? blueScreenCfg.scaleY : 1.0;
    const blueOffsetX = typeof blueScreenCfg.offsetX === 'number' ? blueScreenCfg.offsetX : 0.0;
    const blueOffsetY = typeof blueScreenCfg.offsetY === 'number' ? blueScreenCfg.offsetY : 0.0;
    const blueColor = typeof blueScreenCfg.color === 'string' ? blueScreenCfg.color : '#0044ff';

    const centerX = transform.offsetX + monitorState.x * transform.renderW;
    const centerY = transform.offsetY + monitorState.y * transform.renderH;

    const baseH = transform.renderH * scale;
    const aspect = sourceImg.width / sourceImg.height;
    const baseW = baseH * aspect;

    const x = centerX - baseW / 2;
    const y = centerY - baseH / 2;

    monitorState.rect.x = x;
    monitorState.rect.y = y;
    monitorState.rect.w = baseW;
    monitorState.rect.h = baseH;

    if (screenMaskCanvas) {
        if (!screenTempCanvas) {
            screenTempCanvas = document.createElement('canvas');
        }
        screenTempCanvas.width = baseW;
        screenTempCanvas.height = baseH;
        const tempCtx = screenTempCanvas.getContext('2d');

        tempCtx.clearRect(0, 0, baseW, baseH);
        tempCtx.fillStyle = blueColor;

        const clampedBlueScaleX = Math.max(0, Math.min(1, blueScaleX));
        const clampedBlueScaleY = Math.max(0, Math.min(1, blueScaleY));
        const blueW = baseW * clampedBlueScaleX;
        const blueH = baseH * clampedBlueScaleY;

        const freeX = baseW - blueW;
        const freeY = baseH - blueH;

        const blueX = (baseW - blueW) / 2 + (freeX / 2) * blueOffsetX;
        const blueY = (baseH - blueH) / 2 + (freeY / 2) * blueOffsetY;

        tempCtx.fillRect(blueX, blueY, blueW, blueH);

        // Draw bouncing logo if available
        if (logoImg) {
            const logo = monitorState.logoState;
            
            // Determine bounds for the logo
            let boundsX, boundsY, boundsW, boundsH;
            
            if (processedMonitor && processedMonitor.windowBox) {
                // Use detected screen region
                const box = processedMonitor.windowBox;
                boundsX = box.x * baseW;
                boundsY = box.y * baseH;
                boundsW = box.w * baseW;
                boundsH = box.h * baseH;
            } else {
                // Fallback to blue rect if detection failed
                boundsX = blueX;
                boundsY = blueY;
                boundsW = blueW;
                boundsH = blueH;
            }
            
            // Logo size (e.g., 25% of the bounds width)
            const logoSize = Math.min(boundsW, boundsH) * 0.25;
            const logoW = logoSize;
            const logoH = logoSize * (logoImg.height / logoImg.width);

            // Update position
            logo.x += logo.vx;
            logo.y += logo.vy;

            // Boundary checks (normalized coordinates)
            const logoFracW = logoW / boundsW;
            const logoFracH = logoH / boundsH;

            if (logo.x <= 0 || logo.x + logoFracW >= 1) {
                logo.vx *= -1;
                logo.x = Math.max(0, Math.min(1 - logoFracW, logo.x));
            }
            if (logo.y <= 0 || logo.y + logoFracH >= 1) {
                logo.vy *= -1;
                logo.y = Math.max(0, Math.min(1 - logoFracH, logo.y));
            }

            // Draw logo
            const drawX = boundsX + logo.x * boundsW;
            const drawY = boundsY + logo.y * boundsH;
            
            const time = timestamp || 0;
            const sliceWidth = 2; // Width of each vertical slice
            const amplitude = logoH * 0.06; // Height of the wave
            const waveSpeed = 0.004; 
            
            // Draw the logo in vertical slices with sine wave offset
            for (let i = 0; i < logoW; i += sliceWidth) {
                const sW = Math.min(sliceWidth, logoW - i);
                
                // Calculate mapping from destination width back to source image
                const sx = (i / logoW) * logoImg.width;
                const sw = (sW / logoW) * logoImg.width;

                // Create wave effect
                // Frequency: 1 full wave across the logo width
                const angle = (i / logoW) * (Math.PI * 2) - time * waveSpeed;
                const waveOffset = Math.sin(angle) * amplitude;

                tempCtx.drawImage(
                    logoImg, 
                    sx, 0, sw, logoImg.height,
                    drawX + i, drawY + waveOffset, sW, logoH
                );
            }
        }

        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(screenMaskCanvas, 0, 0, baseW, baseH);
        tempCtx.globalCompositeOperation = 'source-over';

        if (monitorConfig.flipHorizontal) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.drawImage(screenTempCanvas, -baseW / 2, -baseH / 2, baseW, baseH);
            ctx.drawImage(sourceImg, -baseW / 2, -baseH / 2, baseW, baseH);
            ctx.restore();
        } else {
            ctx.drawImage(screenTempCanvas, x, y, baseW, baseH);
            ctx.drawImage(sourceImg, x, y, baseW, baseH);
        }
    } else {
        if (monitorConfig.flipHorizontal) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.drawImage(sourceImg, -baseW / 2, -baseH / 2, baseW, baseH);
            ctx.restore();
        } else {
            ctx.drawImage(sourceImg, x, y, baseW, baseH);
        }
    }
}

