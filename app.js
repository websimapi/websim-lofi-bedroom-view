import {
    ASSETS,
    SETTINGS_URL,
    DEFAULT_CITYSCAPE_CONFIG,
    DEFAULT_MONITOR_CONFIG,
    DEFAULT_BEAR_CONFIG
} from './config.js';
import { loadImage, loadConfig, computeCoverTransform } from './utils.js';
import { createMaskedBedroom, createMaskedMonitor } from './imageProcessing.js';
import { createMonitorState } from './monitor.js';
import { setupInteraction } from './interaction.js';
import { renderScene } from './render.js';
import { createSnowState, updateSnow } from './snow.js';
import { initAudio } from './audio.js';
import { initRecorder, updateRecorder } from './recorder.js';

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');

let bedroomImg = null;
let cityscapeImg = null;
let monitorImg = null;
let logoImg = null;
let bearImg = null;
let processedBedroom = null; // { canvas, windowBox }
let processedMonitor = null; // { canvas, windowBox, screenMaskCanvas }
let cityscapeConfig = { ...DEFAULT_CITYSCAPE_CONFIG };
let monitorConfig = { ...DEFAULT_MONITOR_CONFIG };
let bearConfig = { ...DEFAULT_BEAR_CONFIG };
let monitorState = createMonitorState(monitorConfig);
let bearState = { x: DEFAULT_BEAR_CONFIG.x, y: DEFAULT_BEAR_CONFIG.y, dragging: false, rect: { x: 0, y: 0, w: 0, h: 0 } };
let snowState = createSnowState();
let lastTime = 0;

// View panning state
let mouse = { x: 0.5, y: 0.5 };
let smoothMouse = { x: 0.5, y: 0.5 };

async function init() {
    try {
        resize();
        window.addEventListener('resize', resize);
        const updateInput = (x, y) => {
            mouse.x = x / window.innerWidth;
            mouse.y = y / window.innerHeight;
        };

        window.addEventListener('mousemove', (e) => {
            updateInput(e.clientX, e.clientY);
        });

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                updateInput(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                e.preventDefault(); // Prevent scrolling to allow smooth panning
                updateInput(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        // Initialize background music
        initAudio(ASSETS.music);
        
        // Initialize recorder
        initRecorder();

        // Interaction setup with multiple items
        const interactables = [
            { id: 'santa_bear', state: bearState },
            { id: 'monitor', state: monitorState }
        ];

        setupInteraction(
            canvas,
            interactables,
            () => processedBedroom,
            () => {
                // Provide current transform for accurate dragging
                if (!processedBedroom) return null;
                return computeCoverTransform(
                    processedBedroom.canvas.width,
                    processedBedroom.canvas.height,
                    canvas.width,
                    canvas.height,
                    smoothMouse.x,
                    smoothMouse.y
                );
            }
        );

        const [bedroom, cityscape, settings, monitor, logo, bear] = await Promise.all([
            loadImage(ASSETS.bedroom),
            loadImage(ASSETS.cityscape),
            loadConfig(SETTINGS_URL),
            loadImage(ASSETS.monitor),
            loadImage(ASSETS.logo),
            loadImage(ASSETS.santa_bear)
        ]);

        bedroomImg = bedroom;
        cityscapeImg = cityscape;
        monitorImg = monitor;
        logoImg = logo;
        bearImg = bear;

        if (settings) {
            console.log('Configuration loaded successfully:', settings);

            if (settings.cityscape) {
                const c = settings.cityscape;
                cityscapeConfig = {
                    scale: typeof c.scale === 'number' ? c.scale : DEFAULT_CITYSCAPE_CONFIG.scale,
                    offsetX: typeof c.offsetX === 'number' ? c.offsetX : DEFAULT_CITYSCAPE_CONFIG.offsetX,
                    offsetY: typeof c.offsetY === 'number' ? c.offsetY : DEFAULT_CITYSCAPE_CONFIG.offsetY
                };
            }

            if (settings.monitor) {
                const m = settings.monitor;
                monitorConfig = {
                    x: typeof m.x === 'number' ? m.x : DEFAULT_MONITOR_CONFIG.x,
                    y: typeof m.y === 'number' ? m.y : DEFAULT_MONITOR_CONFIG.y,
                    scale: typeof m.scale === 'number' ? m.scale : DEFAULT_MONITOR_CONFIG.scale,
                    zIndex: typeof m.zIndex === 'number' ? m.zIndex : DEFAULT_MONITOR_CONFIG.zIndex,
                    flipHorizontal: typeof m.flipHorizontal === 'boolean'
                        ? m.flipHorizontal
                        : DEFAULT_MONITOR_CONFIG.flipHorizontal,
                    blueScreen: {
                        scaleX: m.blueScreen && typeof m.blueScreen.scaleX === 'number'
                            ? m.blueScreen.scaleX
                            : DEFAULT_MONITOR_CONFIG.blueScreen.scaleX,
                        scaleY: m.blueScreen && typeof m.blueScreen.scaleY === 'number'
                            ? m.blueScreen.scaleY
                            : DEFAULT_MONITOR_CONFIG.blueScreen.scaleY,
                        offsetX: m.blueScreen && typeof m.blueScreen.offsetX === 'number'
                            ? m.blueScreen.offsetX
                            : DEFAULT_MONITOR_CONFIG.blueScreen.offsetX,
                        offsetY: m.blueScreen && typeof m.blueScreen.offsetY === 'number'
                            ? m.blueScreen.offsetY
                            : DEFAULT_MONITOR_CONFIG.blueScreen.offsetY,
                        color: typeof m.blueScreen === 'object' && typeof m.blueScreen.color === 'string'
                            ? m.blueScreen.color
                            : DEFAULT_MONITOR_CONFIG.blueScreen.color
                    }
                };
                monitorState.x = monitorConfig.x;
                monitorState.y = monitorConfig.y;
            }

            if (settings.santa_bear) {
                const b = settings.santa_bear;
                bearConfig = {
                    x: typeof b.x === 'number' ? b.x : DEFAULT_BEAR_CONFIG.x,
                    y: typeof b.y === 'number' ? b.y : DEFAULT_BEAR_CONFIG.y,
                    scale: typeof b.scale === 'number' ? b.scale : DEFAULT_BEAR_CONFIG.scale,
                    flipHorizontal: typeof b.flipHorizontal === 'boolean' ? b.flipHorizontal : DEFAULT_BEAR_CONFIG.flipHorizontal
                };
                bearState.x = bearConfig.x;
                bearState.y = bearConfig.y;
            }
        }

        processedBedroom = createMaskedBedroom(bedroomImg);
        processedMonitor = createMaskedMonitor(monitorImg);

        loader.classList.add('hidden');

        // Start continuous loop
        requestAnimationFrame(loop);
    } catch (e) {
        loader.textContent = 'Error loading assets.';
        console.error(e);
    }
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Smooth mouse movement for panning with deadzone
    const targetPanX = applyPanDeadzone(mouse.x);
    const targetPanY = applyPanDeadzone(mouse.y);

    const smoothing = 0.05;
    smoothMouse.x += (targetPanX - smoothMouse.x) * smoothing;
    smoothMouse.y += (targetPanY - smoothMouse.y) * smoothing;

    // Clamp dt to avoid huge jumps
    const safeDt = Math.min(dt, 0.1);
    
    updateSnow(snowState, safeDt);

    renderCurrent(timestamp);
    requestAnimationFrame(loop);
}

function renderCurrent(timestamp) {
    renderScene(
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
        smoothMouse // Pass smoothed mouse as pan state
    );
    
    // Feed the recorder
    updateRecorder(canvas, smoothMouse);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (processedBedroom) requestAnimationFrame(renderCurrent);
}

init();

function applyPanDeadzone(value, threshold = 0.25) {
    if (value < threshold) {
        return 0.5 * (value / threshold);
    }
    if (value > 1 - threshold) {
        return 0.5 + 0.5 * ((value - (1 - threshold)) / threshold);
    }
    return 0.5;
}