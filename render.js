import { computeCoverTransform, drawCover, drawCityscapeInWindow } from './utils.js';
import { drawMonitor } from './monitor.js';
import { drawSnow } from './snow.js';

export function renderScene(
    ctx,
    canvas,
    processedBedroom,
    cityscapeImg,
    cityscapeConfig,
    monitorImg,
    processedMonitor,
    monitorConfig,
    monitorState,
    logoImg,
    bearImg,
    bearConfig,
    bearState,
    timestamp,
    snowState,
    pan = { x: 0.5, y: 0.5 }
) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!processedBedroom || !processedBedroom.windowBox || !cityscapeImg) {
        if (processedBedroom && processedBedroom.canvas) {
            drawCover(ctx, processedBedroom.canvas, canvas.width, canvas.height, pan.x, pan.y);
        }
        return;
    }

    const { canvas: bedroomCanvas, windowBox } = processedBedroom;

    const transform = computeCoverTransform(
        bedroomCanvas.width,
        bedroomCanvas.height,
        canvas.width,
        canvas.height,
        pan.x,
        pan.y
    );

    const windowCanvasX = transform.offsetX + windowBox.x * transform.renderW;
    const windowCanvasY = transform.offsetY + windowBox.y * transform.renderH;
    const windowCanvasW = windowBox.w * transform.renderW;
    const windowCanvasH = windowBox.h * transform.renderH;

    drawCityscapeInWindow(
        ctx,
        cityscapeImg,
        windowCanvasX,
        windowCanvasY,
        windowCanvasW,
        windowCanvasH,
        cityscapeConfig
    );

    if (snowState) {
        drawSnow(
            ctx,
            snowState,
            windowCanvasX,
            windowCanvasY,
            windowCanvasW,
            windowCanvasH
        );
    }

    drawCover(ctx, bedroomCanvas, canvas.width, canvas.height, pan.x, pan.y);

    if (bearImg) {
        drawPlacedItem(ctx, transform, bearImg, bearConfig, bearState);
    }

    if (monitorImg) {
        drawMonitor(ctx, transform, monitorImg, processedMonitor, monitorConfig, monitorState, logoImg, timestamp);
    }
}

function drawPlacedItem(ctx, transform, img, config, state) {
    const scale = config.scale || 0.2;
    const posX = state ? state.x : (config.x || 0.5);
    const posY = state ? state.y : (config.y || 0.5);
    
    const centerX = transform.offsetX + posX * transform.renderW;
    const centerY = transform.offsetY + posY * transform.renderH;

    const baseH = transform.renderH * scale;
    const aspect = img.width / img.height;
    const baseW = baseH * aspect;

    const x = centerX - baseW / 2;
    const y = centerY - baseH / 2;

    if (state) {
        state.rect = { x, y, w: baseW, h: baseH };
    }

    if (config.flipHorizontal) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
        ctx.restore();
    } else {
        ctx.drawImage(img, x, y, baseW, baseH);
    }
}

