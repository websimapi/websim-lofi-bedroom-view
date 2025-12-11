import { getAudioStream } from './audio.js';
import { loadImage } from './utils.js';

let recording = false;
let recorder = null;
let chunks = [];
let recordCanvas = null;
let recordCtx = null;
let qrImg = null;
const QR_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://lofixmas--api.on.websim.com';

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
    console.log('Starting 15s recording...');

    const canvas = document.getElementById('main-canvas');
    const audioStream = getAudioStream();

    // Setup record canvas to match main canvas
    recordCanvas = document.createElement('canvas');
    recordCanvas.width = canvas.width;
    recordCanvas.height = canvas.height;
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

    // Stop after 15 seconds
    setTimeout(() => {
        if (recording) stopRecording();
    }, 15000);
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

    // Copy main canvas content
    recordCtx.drawImage(mainCanvas, 0, 0);

    // Draw QR Code bottom right
    if (qrImg) {
        const size = 150; 
        const padding = 30;
        // Keep QR aspect ratio square
        const x = recordCanvas.width - size - padding;
        const y = recordCanvas.height - size - padding;

        // Draw a slight dark backing for visibility if needed, but simple draw is likely fine
        recordCtx.globalAlpha = 0.9;
        recordCtx.drawImage(qrImg, x, y, size, size);
        recordCtx.globalAlpha = 1.0;
    }
}