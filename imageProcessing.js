import { DETECTION_CONFIG } from './config.js';

export function createMaskedBedroom(img) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = img.width;
    offCanvas.height = img.height;
    const offCtx = offCanvas.getContext('2d');

    offCtx.drawImage(img, 0, 0);

    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imageData.data;
    const width = offCanvas.width;
    const height = offCanvas.height;

    const darkMask = new Uint8Array(width * height);
    const minX = Math.floor(width * DETECTION_CONFIG.minXRatio);

    for (let y = 0; y < height; y++) {
        for (let x = minX; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const maxVal = Math.max(r, g, b);
            if (maxVal < DETECTION_CONFIG.darkThreshold) {
                darkMask[y * width + x] = 1;
            }
        }
    }

    const visited = new Uint8Array(width * height);
    const selectedMask = new Uint8Array(width * height);
    let bestSize = 0;
    let bestBox = null;

    const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1]
    ];

    for (let y = 0; y < height; y++) {
        for (let x = minX; x < width; x++) {
            const idx = y * width + x;
            if (!darkMask[idx] || visited[idx]) continue;

            const stack = [idx];
            const componentPixels = [];
            visited[idx] = 1;

            while (stack.length) {
                const current = stack.pop();
                componentPixels.push(current);

                const cx = current % width;
                const cy = (current / width) | 0;

                for (let i = 0; i < neighbors.length; i++) {
                    const nx = cx + neighbors[i][0];
                    const ny = cy + neighbors[i][1];
                    if (nx < minX || nx >= width || ny < 0 || ny >= height) continue;

                    const nIdx = ny * width + nx;
                    if (!darkMask[nIdx] || visited[nIdx]) continue;

                    visited[nIdx] = 1;
                    stack.push(nIdx);
                }
            }

            if (componentPixels.length > bestSize) {
                bestSize = componentPixels.length;
                selectedMask.fill(0);

                let compMinX = width, compMaxX = 0;
                let compMinY = height, compMaxY = 0;

                for (let i = 0; i < componentPixels.length; i++) {
                    const p = componentPixels[i];
                    selectedMask[p] = 1;

                    const px = p % width;
                    const py = (p / width) | 0;
                    if (px < compMinX) compMinX = px;
                    if (px > compMaxX) compMaxX = px;
                    if (py < compMinY) compMinY = py;
                    if (py > compMaxY) compMaxY = py;
                }

                bestBox = {
                    minX: compMinX,
                    minY: compMinY,
                    maxX: compMaxX,
                    maxY: compMaxY
                };
            }
        }
    }

    if (bestSize > 0 && bestBox) {
        for (let y = bestBox.minY; y <= bestBox.maxY; y++) {
            for (let x = bestBox.minX; x <= bestBox.maxX; x++) {
                const idx = y * width + x;
                if (darkMask[idx]) {
                    selectedMask[idx] = 1;
                }
            }
        }

        const dilatedMask = new Uint8Array(selectedMask.length);
        dilatedMask.set(selectedMask);

        for (let i = 0; i < width * height; i++) {
            if (!selectedMask[i]) continue;
            const cx = i % width;
            const cy = (i / width) | 0;

            if (cx + 1 < width) dilatedMask[i + 1] = 1;
            if (cx - 1 >= 0) dilatedMask[i - 1] = 1;
            if (cy + 1 < height) dilatedMask[i + width] = 1;
            if (cy - 1 >= 0) dilatedMask[i - width] = 1;
        }

        for (let i = 0; i < dilatedMask.length; i++) {
            if (!dilatedMask[i]) continue;
            const index = i * 4;
            data[index + 3] = 0;
        }
    }

    offCtx.putImageData(imageData, 0, 0);

    let windowBox = null;
    if (bestBox) {
        const boxWidth = bestBox.maxX - bestBox.minX + 1;
        const boxHeight = bestBox.maxY - bestBox.minY + 1;
        windowBox = {
            x: bestBox.minX / width,
            y: bestBox.minY / height,
            w: boxWidth / width,
            h: boxHeight / height
        };
    }

    return {
        canvas: offCanvas,
        windowBox
    };
}

export function createMaskedMonitor(img) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = img.width;
    offCanvas.height = img.height;
    const offCtx = offCanvas.getContext('2d');

    offCtx.drawImage(img, 0, 0);

    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imageData.data;
    const width = offCanvas.width;
    const height = offCanvas.height;

    const darkThreshold = 40;

    const darkMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            if (a === 0) continue;

            const maxVal = Math.max(r, g, b);
            if (maxVal < darkThreshold) {
                darkMask[y * width + x] = 1;
            }
        }
    }

    const visited = new Uint8Array(width * height);
    const selectedMask = new Uint8Array(width * height);
    let bestSize = 0;
    let bestBox = null;

    const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1]
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!darkMask[idx] || visited[idx]) continue;

            const stack = [idx];
            const componentPixels = [];
            visited[idx] = 1;

            while (stack.length) {
                const current = stack.pop();
                componentPixels.push(current);

                const cx = current % width;
                const cy = (current / width) | 0;

                for (let i = 0; i < neighbors.length; i++) {
                    const nx = cx + neighbors[i][0];
                    const ny = cy + neighbors[i][1];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const nIdx = ny * width + nx;
                    if (!darkMask[nIdx] || visited[nIdx]) continue;

                    visited[nIdx] = 1;
                    stack.push(nIdx);
                }
            }

            if (componentPixels.length > bestSize) {
                bestSize = componentPixels.length;
                selectedMask.fill(0);

                let compMinX = width, compMaxX = 0;
                let compMinY = height, compMaxY = 0;

                for (let i = 0; i < componentPixels.length; i++) {
                    const p = componentPixels[i];
                    selectedMask[p] = 1;

                    const px = p % width;
                    const py = (p / width) | 0;
                    if (px < compMinX) compMinX = px;
                    if (px > compMaxX) compMaxX = px;
                    if (py < compMinY) compMinY = py;
                    if (py > compMaxY) compMaxY = py;
                }

                bestBox = {
                    minX: compMinX,
                    minY: compMinY,
                    maxX: compMaxX,
                    maxY: compMaxY
                };
            }
        }
    }

    let screenMaskCanvas = null;

    if (bestSize > 0 && bestBox) {
        for (let y = bestBox.minY; y <= bestBox.maxY; y++) {
            for (let x = bestBox.minX; x <= bestBox.maxX; x++) {
                const idx = y * width + x;
                if (darkMask[idx]) {
                    selectedMask[idx] = 1;
                }
            }
        }

        const dilatedMask = new Uint8Array(selectedMask.length);
        dilatedMask.set(selectedMask);

        for (let i = 0; i < width * height; i++) {
            if (!selectedMask[i]) continue;
            const cx = i % width;
            const cy = (i / width) | 0;

            if (cx + 1 < width) dilatedMask[i + 1] = 1;
            if (cx - 1 >= 0) dilatedMask[i - 1] = 1;
            if (cy + 1 < height) dilatedMask[i + width] = 1;
            if (cy - 1 >= 0) dilatedMask[i - width] = 1;
        }

        screenMaskCanvas = document.createElement('canvas');
        screenMaskCanvas.width = width;
        screenMaskCanvas.height = height;
        const maskCtx = screenMaskCanvas.getContext('2d');
        const maskImageData = maskCtx.createImageData(width, height);
        const maskData = maskImageData.data;

        for (let i = 0; i < dilatedMask.length; i++) {
            const on = dilatedMask[i];
            const idx4 = i * 4;
            if (on) {
                maskData[idx4] = 255;
                maskData[idx4 + 1] = 255;
                maskData[idx4 + 2] = 255;
                maskData[idx4 + 3] = 255;
            } else {
                maskData[idx4] = 0;
                maskData[idx4 + 1] = 0;
                maskData[idx4 + 2] = 0;
                maskData[idx4 + 3] = 0;
            }
        }
        maskCtx.putImageData(maskImageData, 0, 0);

        for (let i = 0; i < dilatedMask.length; i++) {
            if (!dilatedMask[i]) continue;
            const index = i * 4;
            data[index + 3] = 0;
        }
    }

    offCtx.putImageData(imageData, 0, 0);

    let windowBox = null;
    if (bestBox) {
        const boxWidth = bestBox.maxX - bestBox.minX + 1;
        const boxHeight = bestBox.maxY - bestBox.minY + 1;
        windowBox = {
            x: bestBox.minX / width,
            y: bestBox.minY / height,
            w: boxWidth / width,
            h: boxHeight / height
        };
    }

    return {
        canvas: offCanvas,
        windowBox,
        screenMaskCanvas
    };
}