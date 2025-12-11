export function createSnowState(count = 350) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const p = resetParticle({});
        p.y = Math.random(); // Start randomly distributed vertically
        p.x = Math.random() * 1.4 - 0.2; // Start randomly distributed horizontally (wider for wind)
        particles.push(p);
    }
    return { particles };
}

function resetParticle(p) {
    p.x = Math.random() * 1.4 - 0.2;
    p.y = -0.05;
    p.z = Math.random(); // Depth: 0 (far) to 1 (near)
    p.size = 1.0 + p.z * 1.5;
    // Speed: mix of constant fall and depth-based variance
    p.vy = 0.08 + p.z * 0.12; 
    p.swayPhase = Math.random() * Math.PI * 2;
    p.swaySpeed = 1.0 + Math.random() * 2.0;
    p.alpha = 0.4 + p.z * 0.4;
    return p;
}

export function updateSnow(state, dt) {
    const wind = 0.05; 
    
    for (const p of state.particles) {
        p.y += p.vy * dt;
        p.swayPhase += p.swaySpeed * dt;
        
        // Add wind drift
        p.x += wind * dt * (0.5 + p.z); 
        
        if (p.y > 1.05) {
            resetParticle(p);
        }
    }
}

export function drawSnow(ctx, state, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip(); 
    
    ctx.fillStyle = '#FFFFFF'; 
    
    for (const p of state.particles) {
        const swayOffset = Math.sin(p.swayPhase) * (0.005 + p.z * 0.01) * w;
        const px = x + p.x * w + swayOffset;
        const py = y + p.y * h;
        
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}