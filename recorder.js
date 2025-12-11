import { getAudioStream } from './audio.js';
import { loadImage } from './utils.js';

let recording = false;
let recorder = null;
let chunks = [];
let recordCanvas = null;
let recordCtx = null;
let qrImg = null;
const QR_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://lofixmas--api.on.websim.com';

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const RECORD_DURATION = 30000;

export async function initRecorder() {
    try {
        qrImg = await loadImage(QR_URL);
    } catch (e) {
        console.warn('Failed to load QR code for recording overlay');
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === '~' || e.key === '`') {
            startRecording();
        }
    });
}

function getSupportedMimeType() {
    const types = [
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

function startRecording() {
    if (recording) return;
    console.log('Starting 30s recording...');

    const canvas = document.getElementById('main-canvas');
    const audioStream = getAudioStream();

    // Setup record canvas for vertical short format
    recordCanvas = document.createElement('canvas');
    recordCanvas.width = VIDEO_WIDTH;
    recordCanvas.height = VIDEO_HEIGHT;
    recordCtx = recordCanvas.getContext('2d');

    // Capture stream from the recording canvas
    const canvasStream = recordCanvas.captureStream(30); // 30 FPS

    // Combine tracks
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = getSupportedMimeType();

    if (!mimeType) {
        console.error('No supported MediaRecorder mime type found');
        return;
    }

    try {
        recorder = new MediaRecorder(combinedStream, { mimeType });
    } catch (e) {
        console.error('MediaRecorder initialization failed:', e);
        return;
    }

    chunks = [];
    recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => saveRecording(mimeType);

    recorder.start();
    recording = true;

    // Stop after 30 seconds
    setTimeout(() => {
        if (recording) stopRecording();
    }, RECORD_DURATION);
}

function stopRecording() {
    if (!recorder || !recording) return;
    recorder.stop();
    recording = false;
    console.log('Recording finished.');
}

function saveRecording(mimeType) {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Determine extension
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    a.download = `lofi_xmas_replay_${Date.now()}.${ext}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function updateRecorder(mainCanvas) {
    if (!recording || !recordCtx) return;

    // Draw main canvas content covering the vertical video frame
    const srcW = mainCanvas.width;
    const srcH = mainCanvas.height;
    const dstW = recordCanvas.width;
    const dstH = recordCanvas.height;

    // "Cover" scaling to fill vertical video
    const scale = Math.max(dstW / srcW, dstH / srcH);
    const renderW = srcW * scale;
    const renderH = srcH * scale;
    
    // Center alignment
    const x = (dstW - renderW) / 2;
    const y = (dstH - renderH) / 2;

    recordCtx.fillStyle = '#000';
    recordCtx.fillRect(0, 0, dstW, dstH);
    recordCtx.drawImage(mainCanvas, x, y, renderW, renderH);

    // Draw QR Code bottom right
    if (qrImg) {
        const size = 150; 
        const padding = 30;
        const qrX = dstW - size - padding;
        const qrY = dstH - size - padding;

        recordCtx.globalAlpha = 0.9;
        recordCtx.drawImage(qrImg, qrX, qrY, size, size);
        recordCtx.globalAlpha = 1.0;
    }
}