export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export function loadConfig(url) {
    // Append timestamp to prevent caching issues
    const finalUrl = `${url}?t=${Date.now()}`;
    return fetch(finalUrl)
        .then(res => {
            if (!res.ok) throw new Error('Failed to load config');
            return res.json();
        })
        .catch(err => {
            console.warn('Using default config due to error:', err);
            return null;
        });
}

export function computeCoverTransform(imgWidth, imgHeight, canvasWidth, canvasHeight, panX = 0.5, panY = 0.5) {
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let renderW, renderH;

    if (canvasRatio > imgRatio) {
        renderW = canvasWidth;
        renderH = canvasWidth / imgRatio;
    } else {
        renderW = canvasHeight * imgRatio;
        renderH = canvasHeight;
    }

    const offsetX = (canvasWidth - renderW) * panX;
    const offsetY = (canvasHeight - renderH) * panY;

    return { offsetX, offsetY, renderW, renderH };
}

export function drawCover(ctx, img, canvasWidth, canvasHeight, panX = 0.5, panY = 0.5) {
    const { offsetX, offsetY, renderW, renderH } = computeCoverTransform(
        img.width,
        img.height,
        canvasWidth,
        canvasHeight,
        panX,
        panY
    );

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    return { offsetX, offsetY, renderW, renderH };
}

export function drawContainIntoRect(ctx, img, dstX, dstY, dstW, dstH) {
    const imgRatio = img.width / img.height;
    const rectRatio = dstW / dstH;

    let renderW, renderH, offsetX, offsetY;

    if (rectRatio > imgRatio) {
        renderH = dstH;
        renderW = dstH * imgRatio;
        offsetX = dstX + (dstW - renderW) / 2;
        offsetY = dstY;
    } else {
        renderW = dstW;
        renderH = dstW / imgRatio;
        offsetX = dstX;
        offsetY = dstY + (dstH - renderH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
}

export function drawCityscapeInWindow(ctx, img, dstX, dstY, dstW, dstH, config) {
    const imgRatio = img.width / img.height;
    const rectRatio = dstW / dstH;

    let baseW, baseH;

    if (rectRatio > imgRatio) {
        baseH = dstH;
        baseW = dstH * imgRatio;
    } else {
        baseW = dstW;
        baseH = dstW / imgRatio;
    }

    const scale = typeof config.scale === 'number' ? config.scale : 1.0;
    const renderW = baseW * scale;
    const renderH = baseH * scale;

    let offsetX = dstX + (dstW - renderW) / 2;
    let offsetY = dstY + (dstH - renderH) / 2;

    const cfgOffsetX = typeof config.offsetX === 'number' ? config.offsetX : 0.0;
    const cfgOffsetY = typeof config.offsetY === 'number' ? config.offsetY : 0.0;

    const freeX = dstW - renderW;
    const freeY = dstH - renderH;

    offsetX += (freeX / 2) * cfgOffsetX;
    offsetY += (freeY / 2) * cfgOffsetY;

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
}

