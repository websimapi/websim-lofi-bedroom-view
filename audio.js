export function initAudio(url) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    // Create a stream destination for recording
    streamDest = ctx.createMediaStreamDestination();
    
    let buffer = null;
    let isPlaying = false;

    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => ctx.decodeAudioData(data))
        .then(decodedBuffer => {
            buffer = decodedBuffer;
            if (ctx.state === 'running') {
                play();
            }
        })
        .catch(e => console.error('Failed to load audio:', e));

    const unlock = () => {
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                if (buffer && !isPlaying) {
                    play();
                }
            });
        } else if (buffer && !isPlaying) {
            play();
        }
        
        if (ctx.state === 'running') {
             ['click', 'touchstart', 'keydown'].forEach(evt => 
                window.removeEventListener(evt, unlock)
            );
        }
    };

    ['click', 'touchstart', 'keydown'].forEach(evt => 
        window.addEventListener(evt, unlock)
    );

    function play() {
        if (isPlaying) return;
        isPlaying = true;

        const runLoop = () => {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            
            const gainNode = ctx.createGain();
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            // Connect to stream destination as well
            if (streamDest) {
                gainNode.connect(streamDest);
            }

            const now = ctx.currentTime;
            const duration = buffer.duration;
            const fadeDuration = 15;

            // Fade In (0 to 1 over first 15s)
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration);
            
            // Hold volume at 1 until fade out starts
            gainNode.gain.linearRampToValueAtTime(1, now + duration - fadeDuration);
            
            // Fade Out (1 to 0 over last 15s)
            gainNode.gain.linearRampToValueAtTime(0, now + duration);

            source.start(now);
            
            source.onended = () => {
                runLoop();
            };
        };

        runLoop();
    }
}

// Module-level variable to store the stream destination
let streamDest = null;

export function getAudioStream() {
    return streamDest ? streamDest.stream : null;
}