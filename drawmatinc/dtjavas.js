// === Section 1: DrawingApp Object Definition ===
const DrawingApp = {
    canvas: null,
    ctx: null,
    persistentCanvas: null,
    persistentCtx: null,
    offscreenCanvas: null,
    offscreenCtx: null,
    painting: false,
    lastX: null,
    lastY: null,
    brushSize: 10,
    smoothness: 0.5,
    opacity: 0.1,
    webDensity: 3,
    webSpread: 0.5,
    webWiggle: 0.1,
    circleSize: 20,
    borderWidth: 1,
    watercolorSpread: 0.5,
    watercolorBleed: 0.2,
    wingSize: 30,
    curlIntensity: 0.5,
    wingOpacity: 0.3,
    symmetry: 4,
    mirrorMode: 'vertical',
    spiralMode: 'off',
    bgColor: '#000000',
    bgColor2: '#1a252f',
    gradientBg: false,
    transparentBg: false,
    currentBrush: 'continuousCircle',
    actions: [],
    redoStack: [],
    strokes: [],
    bgImage: null,
    colors: ['#1df58d', '#0000FF', '#FF0000', '#FFFF00', '#00FF00', '#FF00FF', '#00FFFF', '#800080', '#FFA500', '#808080'],
    colorCount: 10,
    colorImage: null,
    colorImageCanvas: null,
    colorImageCtx: null,
    colorSamplingMethod: 'spatial',
    isDrawingStarted: false,
    lowPerformanceMode: false,
    spiralSteps: 10,
    scale: 1,
    initialDistance: 0,
    initialScale: 1,
    recording: false,
    mediaRecorder: null,
    recordedChunks: [],
    frameRate: 15,
    ASPECT_RATIO: 16 / 9,
    lastDrawTime: 0,
    defaultColors: ['#1df58d', '#0000FF', '#FF0000', '#FFFF00', '#00FF00', '#FF00FF', '#00FFFF', '#800080', '#FFA500', '#808080'],
    activeTab: null,
    audioContext: null,
    soundEnabled: true,
    lastSoundTime: 0
};

// === Section 2: Utility Functions ===
function showNotification(message, type = 'error') {
    try {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.setAttribute('role', 'alert');
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    } catch (err) {
        console.error('Notification error:', err);
    }
}

function getTouchDistance(touches) {
    try {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    } catch (err) {
        console.error('Touch distance error:', err);
        return 0;
    }
}

function getInternalResolution() {
    try {
        const resolutionSelect = document.getElementById('canvasResolution');
        const selectedValue = resolutionSelect ? resolutionSelect.value : 'fullhd';
        const aspectSelect = document.getElementById('aspectRatio');
        const aspectValue = aspectSelect ? aspectSelect.value : '16:9';
        
        let aspectRatio;
        switch (aspectValue) {
            case '4:3': aspectRatio = 4 / 3; break;
            case '3:4': aspectRatio = 3 / 4; break;
            case '16:9': aspectRatio = 16 / 9; break;
            case '9:16': aspectRatio = 9 / 16; break;
            default: aspectRatio = 16 / 9;
        }
        DrawingApp.ASPECT_RATIO = aspectRatio;

        let baseWidth;
        switch (selectedValue) {
            case 'hd': baseWidth = 1280; break;
            case 'fullhd': baseWidth = 1920; break;
            case '4k': baseWidth = 3840; break;
            default: baseWidth = 1920;
        }
        const height = Math.round(baseWidth / aspectRatio);
        console.log(`Resolution: ${baseWidth}x${height}, Aspect: ${aspectValue}`);
        return { width: baseWidth, height: height };
    } catch (err) {
        console.error('Resolution error:', err);
        return { width: 1920, height: 1080 };
    }
}

function getVideoResolution() {
    try {
        const select = document.getElementById('videoResolution');
        const value = select ? select.value : '1080p';
        const aspectSelect = document.getElementById('aspectRatio');
        const aspectValue = aspectSelect ? aspectSelect.value : '16:9';
        
        let aspectRatio;
        switch (aspectValue) {
            case '4:3': aspectRatio = 4 / 3; break;
            case '3:4': aspectRatio = 3 / 4; break;
            case '16:9': aspectRatio = 16 / 9; break;
            case '9:16': aspectRatio = 9 / 16; break;
            default: aspectRatio = 16 / 9;
        }

        let baseWidth;
        switch (value) {
            case '720p': baseWidth = 1280; break;
            case '1080p': baseWidth = 1920; break;
            default: baseWidth = 1920;
        }
        const height = Math.round(baseWidth / aspectRatio);
        console.log(`Video Resolution: ${baseWidth}x${height}, Aspect: ${aspectValue}`);
        return { width: baseWidth, height: height };
    } catch (err) {
        console.error('Video resolution error:', err);
        return { width: 1920, height: 1080 };
    }
}

// === Section 3: Symmetry and Canvas Setup ===
class SymmetryTransformer {
    constructor(symmetry) {
        this.symmetry = symmetry;
        this.matrices = [];
        for (let i = 0; i < symmetry; i++) {
            const angle = i * (Math.PI * 2 / symmetry);
            this.matrices.push({ cos: Math.cos(angle), sin: Math.sin(angle) });
        }
    }

    transform(x, y, dx, dy, centerX, centerY) {
        try {
            const newX = x - centerX;
            const newY = y - centerY;
            const transformed = [];
            for (let matrix of this.matrices) {
                const rotatedX = newX * matrix.cos - newY * matrix.sin + centerX;
                const rotatedY = newX * matrix.sin + newY * matrix.cos + centerY;
                const rotatedDx = dx * matrix.cos - dy * matrix.sin;
                const rotatedDy = dx * matrix.sin + dy * matrix.cos;
                transformed.push({ x: rotatedX, y: rotatedY, dx: rotatedDx, dy: rotatedDy });
            }
            return transformed;
        } catch (err) {
            console.error('Symmetry transform error:', err);
            return [{ x, y, dx, dy }];
        }
    }
}

function resizeCanvas() {
    const app = DrawingApp;
    try {
        const toolbar = document.getElementById('toolbar');
        const actionsRow = document.getElementById('actions-row');
        const isFullscreen = document.fullscreenElement !== null;
        let tempImageData = null;
        if (app.persistentCanvas && app.persistentCanvas.width > 0 && app.persistentCanvas.height > 0) {
            tempImageData = app.persistentCtx.getImageData(0, 0, app.persistentCanvas.width, app.persistentCanvas.height);
        }

        const resolution = getInternalResolution();
        app.canvas.width = resolution.width;
        app.canvas.height = resolution.height;
        app.persistentCanvas.width = resolution.width;
        app.persistentCanvas.height = resolution.height;
        app.offscreenCanvas.width = resolution.width;
        app.offscreenCanvas.height = resolution.height;

        if (isFullscreen) {
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';
        } else {
            const toolbarHeight = (toolbar ? toolbar.offsetHeight : 0) + (actionsRow ? actionsRow.offsetHeight : 0);
            const availableWidth = window.innerWidth - 24;
            const availableHeight = window.innerHeight - toolbarHeight - 24;
            let displayWidth = availableWidth;
            let displayHeight = displayWidth / app.ASPECT_RATIO;
            if (displayHeight > availableHeight) {
                displayHeight = availableHeight;
                displayWidth = displayHeight * app.ASPECT_RATIO;
            }
            app.canvas.style.width = `${Math.round(displayWidth)}px`;
            app.canvas.style.height = `${Math.round(displayHeight)}px`;
        }

        drawBackground(app.persistentCtx);
        if (tempImageData) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tempImageData.width;
            tempCanvas.height = tempImageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(tempImageData, 0, 0);
            app.persistentCtx.drawImage(tempCanvas, 0, 0, resolution.width, resolution.height);
        }
        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
        app.ctx.drawImage(app.persistentCanvas, 0, 0);
        console.log('Canvas resized:', resolution);
    } catch (err) {
        console.error('Resize canvas error:', err);
        showNotification('Failed to resize canvas.', 'error');
    }
}

function drawBackground(context) {
    const app = DrawingApp;
    try {
        context.globalCompositeOperation = 'source-over';
        if (app.transparentBg) {
            context.clearRect(0, 0, app.canvas.width, app.canvas.height);
        } else if (app.bgImage) {
            context.drawImage(app.bgImage, 0, 0, app.canvas.width, app.canvas.height);
        } else if (app.gradientBg) {
            const gradient = context.createLinearGradient(0, 0, app.canvas.width, app.canvas.height);
            gradient.addColorStop(0, app.bgColor);
            gradient.addColorStop(1, app.bgColor2);
            context.fillStyle = gradient;
            context.fillRect(0, 0, app.canvas.width, app.canvas.height);
        } else {
            context.fillStyle = app.bgColor;
            context.fillRect(0, 0, app.canvas.width, app.canvas.height);
        }
    } catch (err) {
        console.error('Draw background error:', err);
        showNotification('Failed to draw background.', 'error');
    }
}

// === Section 4: Drawing Logic ===
function createGradientImage(colors) {
    try {
        if (colors.length === 1) return null;
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 256;
        gradientCanvas.height = 1;
        const gradientCtx = gradientCanvas.getContext('2d');
        const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
        colors.forEach((color, index) => {
            gradient.addColorStop(index / (colors.length - 1), color);
        });
        gradientCtx.fillStyle = gradient;
        gradientCtx.fillRect(0, 0, 256, 1);
        return gradientCanvas;
    } catch (err) {
        console.error('Gradient image error:', err);
        return null;
    }
}

function playBrushSound(brush, x, pressure) {
    const app = DrawingApp;
    if (!app.soundEnabled || !app.audioContext) return;
    try {
        const now = app.audioContext.currentTime;
        const oscillator = app.audioContext.createOscillator();
        const gainNode = app.audioContext.createGain();

        let baseFreq, type;
        switch (brush) {
            case 'web':
                baseFreq = 200;
                type = 'square';
                break;
            case 'continuousCircle':
                baseFreq = 400;
                type = 'sine';
                break;
            case 'watercolor':
                baseFreq = 600;
                type = 'triangle';
                break;
            case 'curlyWings':
                baseFreq = 300;
                type = 'sawtooth';
                break;
            default:
                baseFreq = 400;
                type = 'sine';
        }

        const freq = baseFreq * (0.8 + 0.4 * pressure) * (1 + 0.2 * (x / app.canvas.width));
        oscillator.frequency.setValueAtTime(freq, now);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(app.audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } catch (err) {
        console.error('Play brush sound error:', err);
    }
}

function draw(e) {
    const app = DrawingApp;
    try {
        e.preventDefault();
        if (!app.painting || (e.buttons !== 1 && !e.touches)) {
            console.log('Draw skipped: Not painting or no valid input');
            return;
        }
        const currentTime = performance.now();
        if (currentTime - app.lastDrawTime < 16) {
            console.log('Draw skipped: Frame rate limit');
            return;
        }
        app.lastDrawTime = currentTime;

        const canvasRect = app.canvas.getBoundingClientRect();
        const resolution = getInternalResolution();
        const scaleX = resolution.width / canvasRect.width;
        const scaleY = resolution.height / canvasRect.height;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        let currentX = (clientX - canvasRect.left) * scaleX / app.scale;
        let currentY = (clientY - canvasRect.top) * scaleY / app.scale;

        console.log(`Drawing at (${currentX}, ${currentY}) with brush: ${app.currentBrush}`);

        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        const adjustedBrushSize = app.brushSize * (0.2 + 0.8 * pressure);
        const adjustedCircleSize = app.circleSize * (0.2 + 0.8 * pressure);

        if (!app.isDrawingStarted) {
            app.isDrawingStarted = true;
            console.log('Drawing started');
        }

        if (app.lastX !== undefined && app.lastY !== undefined) {
            const dx = currentX - app.lastX;
            const dy = currentY - app.lastY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            app.offscreenCtx.clearRect(0, 0, app.offscreenCanvas.width, app.offscreenCanvas.height);
            app.offscreenCtx.globalCompositeOperation = 'source-over';
            const strokePoints = [];
            for (let i = 0; i <= distance; i += app.smoothness) {
                const point = i / distance;
                const x = app.lastX + dx * point;
                const y = app.lastY + dy * point;
                strokePoints.push({ x, y, time: currentTime, pressure });
                drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
                if (currentTime - app.lastSoundTime > 100) {
                    playBrushSound(app.currentBrush, x, pressure);
                    app.lastSoundTime = currentTime;
                }
            }
            app.persistentCtx.drawImage(app.offscreenCanvas, 0, 0);
            app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
            app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
            app.ctx.drawImage(app.persistentCanvas, 0, 0);
            const color = getColor(currentX, currentY);
            app.strokes.push({
                points: strokePoints,
                brush: app.currentBrush,
                size: adjustedBrushSize,
                color,
                opacity: app.opacity,
                pressure,
                settings: {
                    webDensity: app.webDensity,
                    webSpread: app.webSpread,
                    webWiggle: app.webWiggle,
                    circleSize: adjustedCircleSize,
                    borderWidth: app.borderWidth,
                    watercolorSpread: app.watercolorSpread,
                    watercolorBleed: app.watercolorBleed,
                    wingSize: app.wingSize,
                    curlIntensity: app.curlIntensity,
                    wingOpacity: app.wingOpacity,
                    symmetry: app.symmetry,
                    mirrorMode: app.mirrorMode,
                    spiralMode: app.spiralMode,
                    spiralSteps: app.spiralSteps
                }
            });
            app.actions.push({
                imageData: app.persistentCtx.getImageData(0, 0, app.canvas.width, app.canvas.height),
                strokes: strokePoints,
                brush: app.currentBrush,
                size: adjustedBrushSize,
                color,
                opacity: app.opacity,
                pressure,
                settings: {
                    webDensity: app.webDensity,
                    webSpread: app.webSpread,
                    webWiggle: app.webWiggle,
                    circleSize: adjustedCircleSize,
                    borderWidth: app.borderWidth,
                    watercolorSpread: app.watercolorSpread,
                    watercolorBleed: app.watercolorBleed,
                    wingSize: app.wingSize,
                    curlIntensity: app.curlIntensity,
                    wingOpacity: app.wingOpacity,
                    symmetry: app.symmetry,
                    mirrorMode: app.mirrorMode,
                    spiralMode: app.spiralMode,
                    spiralSteps: app.spiralSteps
                }
            });
            app.redoStack = [];
            console.log('Stroke recorded:', strokePoints.length, 'points');
        }
        app.lastX = currentX;
        app.lastY = currentY;
    } catch (err) {
        console.error('Draw error:', err);
        showNotification('Drawing failed.', 'error');
    }
}

function drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
    try {
        const centerX = app.canvas.width / 2;
        const centerY = app.canvas.height / 2;
        const transformer = new SymmetryTransformer(app.symmetry);
        const transformed = transformer.transform(x, y, dx, dy, centerX, centerY);
        for (let t of transformed) {
            if (app.spiralMode === 'on') {
                const distanceFromCenter = Math.sqrt((t.x - centerX) ** 2 + (t.y - centerY) ** 2);
                const baseAngle = Math.atan2(t.y - centerY, t.x - centerX);
                const maxRadius = distanceFromCenter;
                for (let j = 0; j <= app.spiralSteps; j++) {
                    const tSpiral = j / app.spiralSteps;
                    const theta = baseAngle + tSpiral * Math.PI * 2;
                    const r = maxRadius * tSpiral;
                    const spiralX = centerX + r * Math.cos(theta);
                    const spiralY = centerY + r * Math.sin(theta);
                    const spiralDx = t.dx * (1 - tSpiral);
                    const spiralDy = t.dy * (1 - tSpiral);
                    if (spiralX >= 0 && spiralX <= app.canvas.width && spiralY >= 0 && spiralY <= app.canvas.height) {
                        applyMirrorTransformations(spiralX, spiralY, spiralDx, spiralDy, adjustedBrushSize * (1 - tSpiral), adjustedCircleSize * (1 - tSpiral));
                    }
                }
            } else {
                applyMirrorTransformations(t.x, t.y, t.dx, t.dy, adjustedBrushSize, adjustedCircleSize);
            }
        }
    } catch (err) {
        console.error('Symmetry draw error:', err);
    }
}

function applyMirrorTransformations(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
    try {
        drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
        if (app.mirrorMode === 'horizontal') {
            drawBrush(x, app.canvas.height - y, dx, -dy, adjustedBrushSize, adjustedCircleSize);
        } else if (app.mirrorMode === 'vertical') {
            drawBrush(app.canvas.width - x, y, -dx, dy, adjustedBrushSize, adjustedCircleSize);
        }
    } catch (err) {
        console.error('Mirror transform error:', err);
    }
}

function drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
    try {
        const color = getColor(x, y);
        console.log(`Drawing brush: ${app.currentBrush} at (${x}, ${y}) with size: ${adjustedBrushSize}, color: ${color}`);
        switch (app.currentBrush) {
            case 'web': drawSpiderWeb(app.offscreenCtx, x, y, adjustedBrushSize, color); break;
            case 'continuousCircle': drawContinuousCircles(app.offscreenCtx, x, y, dx, dy, adjustedCircleSize, color); break;
            case 'watercolor': drawWatercolor(app.offscreenCtx, x, y, dx, dy, adjustedBrushSize, color); break;
            case 'curlyWings': drawCurlyWings(app.offscreenCtx, x, y, dx, dy, adjustedBrushSize, color); break;
            default: console.warn(`Unknown brush type: ${app.currentBrush}`);
        }
    } catch (err) {
        console.error('Brush draw error:', err);
    }
}

// === Section 5: Brush Drawing Functions ===
function getColor(x, y) {
    const app = DrawingApp;
    try {
        if (app.colorImageCtx) {
            let imgX, imgY;
            switch (app.colorSamplingMethod) {
                case 'random': imgX = Math.floor(Math.random() * app.colorImageCanvas.width); imgY = Math.floor(Math.random() * app.colorImageCanvas.height); break;
                case 'spatial': imgX = Math.floor((x / app.canvas.width) * app.colorImageCanvas.width); imgY = Math.floor((y / app.canvas.height) * app.colorImageCanvas.height); break;
                case 'horizontal': imgX = Math.floor((x / app.canvas.width) * app.colorImageCanvas.width); imgY = 0; break;
                case 'vertical': imgX = Math.floor(app.colorImageCanvas.width / 2); imgY = Math.floor((y / app.canvas.height) * app.colorImageCanvas.height); break;
                case 'radial':
                    const centerX = app.canvas.width / 2;
                    const centerY = app.canvas.height / 2;
                    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    const maxDistance = Math.sqrt((app.canvas.width / 2) ** 2 + (app.canvas.height / 2) ** 2);
                    const ratio = distance / maxDistance;
                    imgX = Math.floor(ratio * app.colorImageCanvas.width);
                    imgY = 0;
                    break;
            }
            imgX = Math.min(Math.max(imgX, 0), app.colorImageCanvas.width - 1);
            imgY = Math.min(Math.max(imgY, 0), app.colorImageCanvas.height - 1);
            const pixelData = app.colorImageCtx.getImageData(imgX, imgY, 1, 1).data;
            return `#${((1 << 24) + (pixelData[0] << 16) + (pixelData[1] << 8) + pixelData[2]).toString(16).slice(1)}`;
        }
        return app.colors[Math.floor(Math.random() * app.colors.length)];
    } catch (err) {
        console.error('Get color error:', err);
        return '#000000';
    }
}

function drawSpiderWeb(ctx, x, y, size, color) {
    const app = DrawingApp;
    try {
        ctx.globalAlpha = app.opacity;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < app.webDensity; i++) {
            let angle = Math.random() * Math.PI * 2;
            let endAngle = angle + (Math.random() - 0.5) * Math.PI * app.webSpread;
            let radius = size * (Math.random() + 0.5);
            let points = [];
            let segments = 10;
            for (let j = 0; j <= segments; j++) {
                let t = j / segments;
                let currentAngle = angle + (endAngle - angle) * t;
                let wiggle = (Math.random() - 0.5) * size * app.webWiggle;
                let r = radius * t + wiggle;
                points.push({ x: x + r * Math.cos(currentAngle), y: y + r * Math.sin(currentAngle) });
            }
            ctx.moveTo(x, y);
            for (let point of points) ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        console.log(`Spider web drawn at (${x}, ${y})`);
    } catch (err) {
        console.error('Spider web draw error:', err);
    }
}

function drawContinuousCircles(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
    try {
        ctx.globalAlpha = app.opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = app.borderWidth;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        console.log(`Continuous circle drawn at (${x}, ${y})`);
    } catch (err) {
        console.error('Continuous circles draw error:', err);
    }
}

function drawWatercolor(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
    try {
        ctx.globalAlpha = app.opacity * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * app.watercolorSpread, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = app.opacity * app.watercolorBleed;
        for (let i = 0; i < 5; i++) {
            const offsetX = (Math.random() - 0.5) * size * app.watercolorSpread;
            const offsetY = (Math.random() - 0.5) * size * app.watercolorSpread;
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, size * app.watercolorSpread * (0.5 + Math.random() * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        console.log(`Watercolor drawn at (${x}, ${y})`);
    } catch (err) {
        console.error('Watercolor draw error:', err);
    }
}

function drawCurlyWings(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
    try {
        ctx.globalAlpha = app.opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();

        ctx.globalAlpha = app.wingOpacity;
        const wingCount = 3;
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;

        for (let i = 0; i < wingCount; i++) {
            let t = i / (wingCount - 1);
            if (wingCount === 1) t = 0.5;
            let wingBaseX = x + dx * t;
            let wingBaseY = y + dy * t;

            ctx.beginPath();
            ctx.moveTo(wingBaseX, wingBaseY);
            let controlX1 = wingBaseX + Math.cos(perpAngle) * app.wingSize * 0.3;
            let controlY1 = wingBaseY + Math.sin(perpAngle) * app.wingSize * 0.3;
            let controlX2 = wingBaseX - Math.cos(angle + app.curlIntensity) * app.wingSize * 0.7;
            let controlY2 = wingBaseY - Math.sin(angle + app.curlIntensity) * app.wingSize * 0.7;
            let endX = wingBaseX - Math.cos(angle + app.curlIntensity * 1.5) * app.wingSize;
            let endY = wingBaseY - Math.sin(angle + app.curlIntensity * 1.5) * app.wingSize;
            ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(wingBaseX, wingBaseY);
            controlX1 = wingBaseX - Math.cos(perpAngle) * app.wingSize * 0.3;
            controlY1 = wingBaseY - Math.sin(perpAngle) * app.wingSize * 0.3;
            controlX2 = wingBaseX - Math.cos(angle - app.curlIntensity) * app.wingSize * 0.7;
            controlY2 = wingBaseY - Math.sin(angle - app.curlIntensity) * app.wingSize * 0.7;
            endX = wingBaseX - Math.cos(angle - app.curlIntensity * 1.5) * app.wingSize;
            endY = wingBaseY - Math.sin(angle - app.curlIntensity * 1.5) * app.wingSize;
            ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        console.log(`Curly wings drawn at (${x}, ${y})`);
    } catch (err) {
        console.error('Curly wings draw error:', err);
    }
}

// === Section 6: Event Listeners and Recording ===
function startPosition(e) {
    const app = DrawingApp;
    try {
        e.preventDefault();
        console.log('startPosition triggered:', e.type);
        const canvasRect = app.canvas.getBoundingClientRect();
        const resolution = getInternalResolution();
        const scaleX = resolution.width / canvasRect.width;
        const scaleY = resolution.height / canvasRect.height;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        app.lastX = (clientX - canvasRect.left) * scaleX / app.scale;
        app.lastY = (clientY - canvasRect.top) * scaleY / app.scale;
        app.painting = true;
        if (!app.isDrawingStarted) app.isDrawingStarted = true;
        app.offscreenCtx.clearRect(0, 0, app.offscreenCanvas.width, app.offscreenCanvas.height);
        app.ctx.globalCompositeOperation = 'source-over';
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        console.log(`Starting draw at (${app.lastX}, ${app.lastY})`);
        playBrushSound(app.currentBrush, app.lastX, pressure);
        drawWithSymmetry(app.lastX, app.lastY, 0, 0, app.brushSize * (0.2 + 0.8 * pressure), app.circleSize * (0.2 + 0.8 * pressure));
        app.persistentCtx.drawImage(app.offscreenCanvas, 0, 0);
        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
        app.ctx.drawImage(app.persistentCanvas, 0, 0);
        const color = getColor(app.lastX, app.lastY);
        app.strokes.push({
            points: [{ x: app.lastX, y: app.lastY, time: performance.now(), pressure }],
            brush: app.currentBrush,
            size: app.brushSize * (0.2 + 0.8 * pressure),
            color,
            opacity: app.opacity,
            settings: {
                webDensity: app.webDensity,
                webSpread: app.webSpread,
                webWiggle: app.webWiggle,
                circleSize: app.circleSize * (0.2 + 0.8 * pressure),
                borderWidth: app.borderWidth,
                watercolorSpread: app.watercolorSpread,
                watercolorBleed: app.watercolorBleed,
                wingSize: app.wingSize,
                curlIntensity: app.curlIntensity,
                wingOpacity: app.wingOpacity,
                symmetry: app.symmetry,
                mirrorMode: app.mirrorMode,
                spiralMode: app.spiralMode,
                spiralSteps: app.spiralSteps
            }
        });
        app.actions.push({
            imageData: app.persistentCtx.getImageData(0, 0, app.canvas.width, app.canvas.height),
            strokes: [{ x: app.lastX, y: app.lastY }],
            brush: app.currentBrush,
            size: app.brushSize * (0.2 + 0.8 * pressure),
            color,
            opacity: app.opacity,
            pressure,
            settings: {
                webDensity: app.webDensity,
                webSpread: app.webSpread,
                webWiggle: app.webWiggle,
                circleSize: app.circleSize * (0.2 + 0.8 * pressure),
                borderWidth: app.borderWidth,
                watercolorSpread: app.watercolorSpread,
                watercolorBleed: app.watercolorBleed,
                wingSize: app.wingSize,
                curlIntensity: app.curlIntensity,
                wingOpacity: app.wingOpacity,
                symmetry: app.symmetry,
                mirrorMode: app.mirrorMode,
                spiralMode: app.spiralMode,
                spiralSteps: app.spiralSteps
            }
        });
        app.redoStack = [];
    } catch (err) {
        console.error('Start position error:', err);
        showNotification('Failed to start drawing.', 'error');
    }
}

function startMP4Recording() {
    const app = DrawingApp;
    try {
        if (app.recording) {
            console.warn('Recording already in progress');
            return;
        }
        if (app.actions.length <= 1) {
            showNotification('No drawing actions to record.', 'error');
            console.error('No actions available for recording');
            return;
        }

        const videoRes = getVideoResolution();
        const recordingCanvas = document.createElement('canvas');
        recordingCanvas.width = videoRes.width;
        recordingCanvas.height = videoRes.height;
        const recordingCtx = recordingCanvas.getContext('2d', { willReadFrequently: true });

        app.recordedChunks = [];
        let stream = recordingCanvas.captureStream(app.frameRate);
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
        app.mediaRecorder = new MediaRecorder(stream, { mimeType });

        app.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) app.recordedChunks.push(e.data);
        };
        app.mediaRecorder.onstop = () => {
            try {
                const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
                const blob = new Blob(app.recordedChunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `drawing_process_${videoRes.width}x${videoRes.height}.${extension}`;
                link.click();
                URL.revokeObjectURL(url);
                showNotification(`Saved as ${extension} at ${videoRes.width}x${videoRes.height}`, 'success');
            } catch (err) {
                showNotification('Error saving video.', 'error');
                console.error('Save video error:', err);
            }
            app.recording = false;
            const saveMP4Button = document.getElementById('saveMP4');
            if (saveMP4Button) {
                saveMP4Button.innerHTML = '<img src="icons/MP4.png" alt="Save MP4 icon">';
                saveMP4Button.setAttribute('aria-label', 'Save as MP4');
            }
            resizeCanvas();
        };
        app.mediaRecorder.onerror = (err) => {
            showNotification('Recording error occurred.', 'error');
            console.error('MediaRecorder error:', err);
        };

        app.mediaRecorder.start();
        app.recording = true;
        const saveMP4Button = document.getElementById('saveMP4');
        if (saveMP4Button) {
            saveMP4Button.innerHTML = '<img src="icons/savingMP4.png" alt="Stop recording icon">';
            saveMP4Button.setAttribute('aria-label', 'Stop recording');
        }

        let frameIndex = 0;
        const framesPerStroke = 1;
        const totalFrames = (app.actions.length - 1) * framesPerStroke;

        function renderFrame() {
            if (frameIndex < totalFrames && app.recording) {
                console.time('renderFrame');
                recordingCtx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);

                const actionIndex = Math.min(Math.floor(frameIndex / framesPerStroke) + 1, app.actions.length - 1);
                const action = app.actions[actionIndex];

                try {
                    if (action.imageData.width !== recordingCanvas.width || action.imageData.height !== recordingCanvas.height) {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = action.imageData.width;
                        tempCanvas.height = action.imageData.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.putImageData(action.imageData, 0, 0);
                        recordingCtx.drawImage(tempCanvas, 0, 0, recordingCanvas.width, recordingCanvas.height);
                    } else {
                        recordingCtx.putImageData(action.imageData, 0, 0);
                    }
                } catch (err) {
                    console.error('Render frame error:', err);
                    showNotification('Error rendering frame.', 'error');
                    app.mediaRecorder.stop();
                    return;
                }

                frameIndex++;
                console.timeEnd('renderFrame');
                requestAnimationFrame(renderFrame);
            } else if (app.recording) {
                app.mediaRecorder.stop();
            }
        }

        renderFrame();
    } catch (err) {
        console.error('Start MP4 recording error:', err);
        showNotification('Failed to start recording.', 'error');
    }
}

// === Section 7: Random Color Generator ===
function generateRandomColor() {
    try {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    } catch (err) {
        console.error('Random color error:', err);
        return '#000000';
    }
}

// === Section 8: UI and Initialization ===
document.addEventListener('DOMContentLoaded', () => {
    const app = DrawingApp;
    try {
        app.canvas = document.getElementById('canvas');
        if (!app.canvas) throw new Error('Canvas element not found');
        app.ctx = app.canvas.getContext('2d', { willReadFrequently: true });
        app.persistentCanvas = document.createElement('canvas');
        app.persistentCtx = app.persistentCanvas.getContext('2d', { willReadFrequently: true });
        app.offscreenCanvas = document.createElement('canvas');
        app.offscreenCtx = app.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        // Ensure canvas is interactive
        app.canvas.style.pointerEvents = 'auto';
        app.canvas.style.touchAction = 'none';
        console.log('Canvas initialized successfully:', app.canvas.width, app.canvas.height);

        // Initialize AudioContext after user interaction
        app.canvas.addEventListener('pointerdown', () => {
            if (!app.audioContext) {
                try {
                    app.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('AudioContext initialized');
                } catch (err) {
                    console.error('AudioContext initialization error:', err);
                    showNotification('Failed to initialize audio.', 'error');
                }
            }
        }, { once: true });
    } catch (err) {
        showNotification('Failed to initialize canvas.', 'error');
        console.error('Canvas initialization error:', err);
        return;
    }

    try {
        const saveGIFButton = document.getElementById('saveGIF');
        const saveSVGButton = document.getElementById('saveSVG');
        if (saveGIFButton) saveGIFButton.style.display = 'none';
        if (saveSVGButton) saveSVGButton.style.display = 'none';

        const quotes = [
            "Art is not what you see, but what you make others see....:Edgar Degas",
            "Creativity takes courage...:Henri Matisse",
            "Every artist was first an amateur...:Ralph Waldo Emerson",
            "The purpose of art is washing the dust of daily life off our souls...:Pablo Picasso",
            "Painting is just another way of keeping a diary...:Pablo Picasso",
            "Art enables us to find ourselves and lose ourselves at the same time...:Thomas Merton",
            "To practice any art, no matter how well or badly, is a way to make your soul grow. So do it...:Kurt Vonnegut",
            "The world always seems brighter when you've just made something that wasn't there before...:Neil Gaiman",
            "Art is the journey of a free soul...:Alev Oguz",
            "Every canvas is a journey all its own...:Helen Frankenthaler"
        ];
        const quoteText = document.getElementById('quote-text');
        if (quoteText) quoteText.textContent = quotes[Math.floor(Math.random() * quotes.length)];

        const closeWelcome = document.getElementById('close-welcome');
        if (closeWelcome) {
            closeWelcome.addEventListener('click', () => {
                const welcomeScreen = document.getElementById('welcome-screen');
                if (welcomeScreen) welcomeScreen.classList.add('hidden');
            });
        }

        window.addEventListener('load', () => {
            showNotification('Welcome to the Brush Stroke Patterns Drawing Tool!', 'success');
        });

        function handleOrientationChange() {
            const isMobile = /Mobi|Android/i.test(navigator.userAgent);
            const portraitMedia = window.matchMedia("(orientation: portrait) and (max-width: 768px)");
            const overlay = document.getElementById('orientation-overlay');
            if (isMobile && portraitMedia.matches) {
                if (overlay) overlay.style.display = 'flex';
            } else {
                if (overlay) overlay.style.display = 'none';
                resizeCanvas();
            }
        }

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', handleOrientationChange);
        window.matchMedia("(orientation: portrait)").addEventListener('change', handleOrientationChange);
        const dismissOverlay = document.getElementById('dismiss-overlay');
        if (dismissOverlay) {
            dismissOverlay.addEventListener('click', () => {
                const overlay = document.getElementById('orientation-overlay');
                if (overlay) overlay.style.display = 'none';
                resizeCanvas();
            });
        }

        function hideToolbarOptions() {
            try {
                document.querySelectorAll('.tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                app.activeTab = null;
                resizeCanvas();
            } catch (err) {
                console.error('Hide toolbar options error:', err);
            }
        }

        // Ensure toolbar is hidden on load
        hideToolbarOptions();

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    if (app.activeTab === tab.dataset.tab) {
                        hideToolbarOptions();
                    } else {
                        document.querySelectorAll('.tab').forEach(t => {
                            t.classList.remove('active');
                            t.setAttribute('aria-selected', 'false');
                        });
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        tab.setAttribute('aria-selected', 'true');
                        const tabContent = document.getElementById(`${tab.dataset.tab}-tab`);
                        if (tabContent) tabContent.classList.add('active');
                        app.activeTab = tab.dataset.tab;
                        resizeCanvas();
                    }
                } catch (err) {
                    console.error('Tab click error:', err);
                }
            });
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    tab.click();
                }
            });
        });

        document.addEventListener('click', (e) => {
            const toolbar = document.getElementById('toolbar');
            if (toolbar && !toolbar.contains(e.target)) {
                hideToolbarOptions();
            }
        });

        const updateSliderValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        const updateValue = (id, func) => {
            const input = document.getElementById(id);
            if (input) {
                if (input.type === 'color') {
                    input.addEventListener('input', (e) => {
                        func(e.target.value);
                        if ((id === 'bgColor' || id === 'bgColor2') && !app.transparentBg && !app.bgImage) {
                            drawBackground(app.persistentCtx);
                            app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                            app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                            app.ctx.drawImage(app.persistentCanvas, 0, 0);
                        }
                    });
                } else if (input.type === 'range') {
                    input.addEventListener('input', (e) => {
                        func(e.target.value);
                        updateSliderValue(id + 'Value', e.target.value);
                    });
                } else if (input.type === 'checkbox') {
                    input.addEventListener('change', (e) => {
                        func(e.target.checked);
                        if (id === 'soundToggle' && !e.target.checked && app.audioContext) {
                            app.audioContext.suspend();
                        } else if (id === 'soundToggle' && e.target.checked && app.audioContext) {
                            app.audioContext.resume();
                        }
                        if (id !== 'soundToggle') {
                            drawBackground(app.persistentCtx);
                            app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                            app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                            app.ctx.drawImage(app.persistentCanvas, 0, 0);
                        }
                    });
                } else {
                    input.addEventListener('change', (e) => {
                        func(e.target.value);
                        if (id === 'aspectRatio' || id === 'canvasResolution') {
                            resizeCanvas();
                        }
                    });
                }
            }
        };

        updateValue('brushSize', v => app.brushSize = parseFloat(v));
        updateValue('smoothness', v => app.smoothness = parseFloat(v) / 100);
        updateValue('opacity', v => app.opacity = parseFloat(v));
        updateValue('webDensity', v => app.webDensity = parseInt(v));
        updateValue('webSpread', v => app.webSpread = parseFloat(v));
        updateValue('webWiggle', v => app.webWiggle = parseFloat(v));
        updateValue('circleSize', v => app.circleSize = parseFloat(v));
        updateValue('borderWidth', v => app.borderWidth = parseFloat(v));
        updateValue('watercolorSpread', v => app.watercolorSpread = parseFloat(v));
        updateValue('watercolorBleed', v => app.watercolorBleed = parseFloat(v));
        updateValue('wingSize', v => app.wingSize = parseFloat(v));
        updateValue('curlIntensity', v => app.curlIntensity = parseFloat(v));
        updateValue('wingOpacity', v => app.wingOpacity = parseFloat(v));
        updateValue('bgColor', v => app.bgColor = v);
        updateValue('bgColor2', v => app.bgColor2 = v);
        updateValue('colorSamplingMethod', v => app.colorSamplingMethod = v);
        updateValue('spiralSteps', v => app.spiralSteps = parseInt(v));
        updateValue('aspectRatio', v => {});
        updateValue('canvasResolution', v => {});
        updateValue('videoResolution', v => {});
        updateValue('symmetrySelect', v => {
            if (app.lowPerformanceMode && parseInt(v) > 4) return;
            app.symmetry = parseInt(v);
        });
        updateValue('mirrorSelect', v => app.mirrorMode = v);
        updateValue('spiralSelect', v => {
            if (app.lowPerformanceMode && v === 'on') return;
            app.spiralMode = v;
            const spiralSettings = document.getElementById('spiralSettings');
            if (spiralSettings) spiralSettings.style.display = v === 'on' ? 'flex' : 'none';
        });
        updateValue('performanceMode', v => {
            app.lowPerformanceMode = v;
            updatePerformanceModeUI();
        });
        updateValue('gradientBg', v => app.gradientBg = v);
        updateValue('transparentBg', v => app.transparentBg = v);
        updateValue('soundToggle', v => app.soundEnabled = v);

        function updateColorInputs() {
            try {
                const colorInputs = document.getElementById('colorInputs');
                if (!colorInputs) return;
                colorInputs.innerHTML = '';
                colorInputs.style.display = 'grid';
                const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
                colorInputs.style.gridTemplateColumns = isSmallScreen ? '1fr 1fr' : 'repeat(auto-fit, minmax(100px, 1fr))';
                colorInputs.style.gap = isSmallScreen ? '8px' : '12px';
                colorInputs.style.alignItems = 'center';

                for (let i = 0; i < app.colorCount; i++) {
                    const container = document.createElement('div');
                    container.className = 'dropdown-container';
                    container.style.display = 'flex';
                    container.style.flexDirection = 'column';
                    container.style.alignItems = 'center';

                    const label = document.createElement('label');
                    label.id = `colorLabel${i + 1}`;
                    label.textContent = `Color ${i + 1}`;
                    label.setAttribute('for', `colorPicker${i + 1}`);

                    const input = document.createElement('input');
                    input.type = 'color';
                    input.id = `colorPicker${i + 1}`;
                    input.value = app.colors[i] || app.defaultColors[i % app.defaultColors.length];
                    input.setAttribute('aria-labelledby', `colorLabel${i + 1}`);
                    input.style.width = isSmallScreen ? '30px' : '40px';
                    input.style.height = isSmallScreen ? '30px' : '40px';
                    input.style.marginTop = '4px';

                    container.appendChild(label);
                    container.appendChild(input);
                    colorInputs.appendChild(container);

                    input.addEventListener('input', (e) => {
                        app.colors[i] = e.target.value;
                        if (!app.colorImage) {
                            app.colorImageCanvas = createGradientImage(app.colors);
                            app.colorImageCtx = app.colorImageCanvas ? app.colorImageCanvas.getContext('2d') : null;
                        }
                    });
                }
                if (!app.colorImage) {
                    app.colorImageCanvas = createGradientImage(app.colors);
                    app.colorImageCtx = app.colorImageCanvas ? app.colorImageCanvas.getContext('2d') : null;
                }
            } catch (err) {
                console.error('Update color inputs error:', err);
            }
        }

        updateColorInputs();

        const colorCountInput = document.getElementById('colorCount');
        if (colorCountInput) {
            colorCountInput.addEventListener('change', (e) => {
                try {
                    app.colorCount = parseInt(e.target.value);
                    const prevColors = app.colors.slice();
                    app.colors = [];
                    for (let i = 0; i < app.colorCount; i++) {
                        app.colors[i] = prevColors[i] || app.defaultColors[i % app.defaultColors.length];
                    }
                    updateColorInputs();
                } catch (err) {
                    console.error('Color count change error:', err);
                }
            });
        }

        const randomizeAllButton = document.getElementById('randomizeAllColors');
        if (randomizeAllButton) {
            randomizeAllButton.addEventListener('click', () => {
                try {
                    app.colors = Array.from({ length: app.colorCount }, () => generateRandomColor());
                    updateColorInputs();
                    showNotification('All colors randomized!', 'success');
                } catch (err) {
                    console.error('Randomize colors error:', err);
                }
            });
        }

        const removeColorImage = document.getElementById('removeColorImage');
        if (removeColorImage) {
            removeColorImage.addEventListener('click', () => {
                try {
                    app.colorImage = null;
                    app.colorImageCanvas = createGradientImage(app.colors);
                    app.colorImageCtx = app.colorImageCanvas ? app.colorImageCanvas.getContext('2d') : null;
                    const colorImageUploadInput = document.getElementById('colorImageUpload');
                    if (colorImageUploadInput) colorImageUploadInput.value = '';
                    showNotification('Color image removed.', 'success');
                } catch (err) {
                    console.error('Remove color image error:', err);
                }
            });
        }

        const removeBgButton = document.getElementById('removeBg');
        if (removeBgButton) {
            removeBgButton.addEventListener('click', () => {
                try {
                    app.bgImage = null;
                    app.transparentBg = false;
                    app.gradientBg = false;
                    drawBackground(app.persistentCtx);
                    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                    app.ctx.drawImage(app.persistentCanvas, 0, 0);
                    showNotification('Background removed.', 'success');
                    const bgImageUploadInput = document.getElementById('bgImageUpload');
if (bgImageUploadInput) bgImageUploadInput.value = '';
                } catch (err) {
                    console.error('Remove background error:', err);
                    showNotification('Failed to remove background.', 'error');
                }
            });
        }

        function updatePerformanceModeUI() {
            try {
                const symmetrySelect = document.getElementById('symmetrySelect');
                const spiralSelect = document.getElementById('spiralSelect');
                if (app.lowPerformanceMode) {
                    if (symmetrySelect && parseInt(symmetrySelect.value) > 4) {
                        symmetrySelect.value = '4';
                        app.symmetry = 4;
                    }
                    if (spiralSelect && spiralSelect.value === 'on') {
                        spiralSelect.value = 'off';
                        app.spiralMode = 'off';
                        const spiralSettings = document.getElementById('spiralSettings');
                        if (spiralSettings) spiralSettings.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error('Update performance mode UI error:', err);
            }
        }

        function setupBrushOptions() {
            try {
                const brushSelect = document.getElementById('brushSelect');
                if (brushSelect) {
                    brushSelect.addEventListener('change', function() {
                        app.currentBrush = this.value;
                        console.log(`Brush changed to: ${app.currentBrush}`);
                        ['webSettings', 'continuousCircleSettings', 'watercolorSettings', 'curlyWingsSettings'].forEach(id => {
                            const element = document.getElementById(id);
                            if (element) element.style.display = app.currentBrush === id.split('Settings')[0] ? 'flex' : 'none';
                        });
                    });
                    brushSelect.dispatchEvent(new Event('change'));
                }
            } catch (err) {
                console.error('Setup brush options error:', err);
            }
        }
        setupBrushOptions();

        const bgImageUpload = document.getElementById('bgImageUpload');
        if (bgImageUpload) {
            bgImageUpload.addEventListener('change', (e) => {
                try {
                    const file = e.target.files[0];
                    if (file) {
                        if (!file.type.startsWith('image/')) {
                            showNotification('Please upload an image file.', 'error');
                            e.target.value = '';
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            app.bgImage = new Image();
                            app.bgImage.onload = () => {
                                if (!app.transparentBg) {
                                    drawBackground(app.persistentCtx);
                                    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                                    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                                    app.ctx.drawImage(app.persistentCanvas, 0, 0);
                                }
                                showNotification('Background image uploaded!', 'success');
                            };
                            app.bgImage.onerror = () => {
                                showNotification('Failed to load image.', 'error');
                                app.bgImage = null;
                            };
                            app.bgImage.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                } catch (err) {
                    console.error('Background image upload error:', err);
                }
            });
        }

        const colorImageUpload = document.getElementById('colorImageUpload');
        if (colorImageUpload) {
            colorImageUpload.addEventListener('change', (e) => {
                try {
                    const file = e.target.files[0];
                    if (file) {
                        if (!file.type.startsWith('image/')) {
                            showNotification('Please upload an image file.', 'error');
                            e.target.value = '';
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            app.colorImage = new Image();
                            app.colorImage.onload = () => {
                                app.colorImageCanvas = document.createElement('canvas');
                                app.colorImageCanvas.width = app.colorImage.width;
                                app.colorImageCanvas.height = app.colorImage.height;
                                app.colorImageCtx = app.colorImageCanvas.getContext('2d');
                                app.colorImageCtx.drawImage(app.colorImage, 0, 0);
                                showNotification('Color sampling image uploaded!', 'success');
                            };
                            app.colorImage.onerror = () => {
                                showNotification('Failed to load image.', 'error');
                                app.colorImage = null;
                            };
                            app.colorImage.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                } catch (err) {
                    console.error('Color image upload error:', err);
                }
            });
        }

        app.canvas.addEventListener('pointerdown', (e) => {
            console.log('Pointerdown event:', e);
            startPosition(e);
        });
        app.canvas.addEventListener('pointermove', (e) => {
            console.log('Pointermove event:', e);
            draw(e);
        });
        document.addEventListener('pointerup', () => {
            console.log('Pointerup event');
            app.painting = false;
            app.lastX = undefined;
            app.lastY = undefined;
        });

        app.canvas.addEventListener('touchstart', (e) => {
            console.log('Touchstart event:', e);
            if (e.touches.length === 2) {
                e.preventDefault();
                app.initialDistance = getTouchDistance(e.touches);
                app.initialScale = app.scale;
            } else {
                startPosition(e);
            }
        }, { passive: false });

        app.canvas.addEventListener('touchmove', (e) => {
            console.log('Touchmove event:', e);
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = getTouchDistance(e.touches);
                app.scale = app.initialScale * (currentDistance / app.initialDistance);
                app.scale = Math.min(Math.max(app.scale, 0.5), 3);
                app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                app.ctx.drawImage(app.persistentCanvas, 0, 0);
            } else {
                draw(e);
            }
        }, { passive: false });

        app.canvas.addEventListener('touchend', (e) => {
            console.log('Touchend event:', e);
            if (e.touches.length < 2) {
                app.painting = false;
                app.lastX = undefined;
                app.lastY = undefined;
            }
        }, { passive: false });

        const clearButton = document.getElementById('clear');
        if (clearButton) {
            clearButton.setAttribute('aria-label', 'Clear canvas');
            clearButton.addEventListener('click', () => {
                try {
                    app.persistentCtx.clearRect(0, 0, app.canvas.width, app.canvas.height);
                    drawBackground(app.persistentCtx);
                    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                    app.ctx.drawImage(app.persistentCanvas, 0, 0);
                    app.actions = [];
                    app.redoStack = [];
                    app.strokes = [];
                    app.isDrawingStarted = false;
                    if (app.recording) {
                        app.mediaRecorder.stop();
                        app.recording = false;
                        const saveMP4Button = document.getElementById('saveMP4');
                        if (saveMP4Button) {
                            saveMP4Button.innerHTML = '<img src="icons/MP4.png" alt="Save MP4 icon">';
                            saveMP4Button.setAttribute('aria-label', 'Save as MP4');
                        }
                    }
                    showNotification('Canvas cleared!', 'success');
                } catch (err) {
                    console.error('Clear canvas error:', err);
                }
            });
        }

        const saveButton = document.getElementById('save');
        if (saveButton) {
            saveButton.setAttribute('aria-label', 'Save as PNG');
            saveButton.addEventListener('click', () => {
                try {
                    const link = document.createElement('a');
                    link.download = 'brush_pattern_art.png';
                    link.href = app.canvas.toDataURL('image/png');
                    link.click();
                    showNotification('PNG saved successfully!', 'success');
                } catch (err) {
                    showNotification('Error saving PNG.', 'error');
                    console.error('Save PNG error:', err);
                }
            });
        }

        const saveMP4Button = document.getElementById('saveMP4');
        if (saveMP4Button) {
            saveMP4Button.setAttribute('aria-label', 'Save as MP4');
            saveMP4Button.addEventListener('click', () => {
                try {
                    if (!app.recording) {
                        startMP4Recording();
                    } else {
                        app.mediaRecorder.stop();
                    }
                } catch (err) {
                    console.error('Save MP4 click error:', err);
                }
            });
        }

        const undoButton = document.getElementById('undo');
        if (undoButton) {
            undoButton.setAttribute('aria-label', 'Undo last action');
            undoButton.addEventListener('click', () => {
                try {
                    if (app.actions.length > 1) {
                        app.redoStack.push(app.actions.pop());
                        const lastAction = app.actions[app.actions.length - 1];
                        app.persistentCtx.putImageData(lastAction.imageData, 0, 0);
                        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                        app.ctx.drawImage(app.persistentCanvas, 0, 0);
                        app.strokes.pop();
                        showNotification('Action undone.', 'success');
                    }
                } catch (err) {
                    console.error('Undo error:', err);
                }
            });
        }

        const redoButton = document.getElementById('redo');
        if (redoButton) {
            redoButton.setAttribute('aria-label', 'Redo last action');
            redoButton.addEventListener('click', () => {
                try {
                    if (app.redoStack.length > 0) {
                        const action = app.redoStack.pop();
                        app.persistentCtx.putImageData(action.imageData, 0, 0);
                        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                        app.ctx.drawImage(app.persistentCanvas, 0, 0);
                        app.actions.push(action);
                        app.strokes.push(action);
                        showNotification('Action redone.', 'success');
                    }
                } catch (err) {
                    console.error('Redo error:', err);
                }
            });
        }

        const undoAllButton = document.getElementById('undoAll');
        if (undoAllButton) {
            undoAllButton.setAttribute('aria-label', 'Undo all actions');
            undoAllButton.addEventListener('click', () => {
                try {
                    if (app.actions.length > 1) {
                        let frameIndex = app.actions.length - 1;
                        function undoFrame() {
                            if (frameIndex > 0) {
                                app.persistentCtx.putImageData(app.actions[frameIndex - 1].imageData, 0, 0);
                                app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                                app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                                app.ctx.drawImage(app.persistentCanvas, 0, 0);
                                app.redoStack.push(app.actions.pop());
                                app.strokes.pop();
                                frameIndex--;
                                setTimeout(undoFrame, 50);
                            }
                        }
                        undoFrame();
                        showNotification('All actions undone.', 'success');
                    }
                } catch (err) {
                    console.error('Undo all error:', err);
                }
            });
        }

        const redoAllButton = document.getElementById('redoAll');
        if (redoAllButton) {
            redoAllButton.setAttribute('aria-label', 'Redo all actions');
            redoAllButton.addEventListener('click', () => {
                try {
                    if (app.redoStack.length > 0) {
                        function redoFrame() {
                            if (app.redoStack.length > 0) {
                                const action = app.redoStack.pop();
                                app.persistentCtx.putImageData(action.imageData, 0, 0);
                                app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                                app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                                app.ctx.drawImage(app.persistentCanvas, 0, 0);
                                app.actions.push(action);
                                app.strokes.push(action);
                                setTimeout(redoFrame, 50);
                            }
                        }
                        redoFrame();
                        showNotification('All actions redone.', 'success');
                    }
                } catch (err) {
                    console.error('Redo all error:', err);
                }
            });
        }

        const toggleFullscreenBtn = document.getElementById('toggleFullscreen');
        const showToolbarBtn = document.getElementById('showToolbarBtn');
        const toolbar = document.getElementById('toolbar');
        const container = document.getElementById('canvas-container');

        if (toggleFullscreenBtn) {
            toggleFullscreenBtn.addEventListener('click', () => {
                try {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(err => {
                            showNotification('Failed to enter fullscreen.', 'error');
                            console.error('Fullscreen error:', err);
                        });
                        toggleFullscreenBtn.innerHTML = '<img src="icons/fscrn1.png" alt="Exit fullscreen icon">';
                        toggleFullscreenBtn.setAttribute('aria-label', 'Exit fullscreen mode');
                    } else {
                        document.exitFullscreen();
                        toggleFullscreenBtn.innerHTML = '<img src="icons/fscrn1.png" alt="Fullscreen icon">';
                        toggleFullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen mode');
                    }
                } catch (err) {
                    console.error('Toggle fullscreen error:', err);
                }
            });
        }

        document.addEventListener('fullscreenchange', () => {
            try {
                if (document.fullscreenElement) {
                    if (container) container.classList.add('fullscreen');
                    if (showToolbarBtn) showToolbarBtn.style.display = 'block';
                    if (toolbar) toolbar.classList.add('hidden');
                } else {
                    if (container) container.classList.remove('fullscreen');
                    if (showToolbarBtn) showToolbarBtn.style.display = 'none';
                    if (toolbar) {
                        toolbar.classList.remove('hidden');
                        toolbar.style.transform = 'translateY(0)';
                    }
                    resizeCanvas();
                }
            } catch (err) {
                console.error('Fullscreen change error:', err);
            }
        });

        if (showToolbarBtn) {
            showToolbarBtn.addEventListener('mouseover', () => {
                if (toolbar) {
                    toolbar.classList.remove('hidden');
                    toolbar.style.transform = 'translateY(0)';
                }
            });
        }

        if (toolbar) {
            toolbar.addEventListener('mouseleave', () => {
                if (document.fullscreenElement && toolbar) {
                    toolbar.style.transform = 'translateY(-100%)';
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            try {
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    const undoButton = document.getElementById('undo');
                    if (undoButton) undoButton.click();
                }
                if (e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    const toggleFullscreen = document.getElementById('toggleFullscreen');
                    if (toggleFullscreen) toggleFullscreen.click();
                }
            } catch (err) {
                console.error('Keydown error:', err);
            }
        });

        function setupTooltips() {
            try {
                const tooltipElements = document.querySelectorAll('[data-tooltip]');
                tooltipElements.forEach(el => {
                    el.addEventListener('click', (e) => {
                        if (window.matchMedia('(max-width: 768px)').matches) {
                            const existingTooltip = document.querySelector('.tooltip-active');
                            if (existingTooltip) existingTooltip.remove();

                            const tooltipText = el.getAttribute('data-tooltip');
                            const tooltip = document.createElement('div');
                            tooltip.className = 'tooltip-active';
                            tooltip.textContent = tooltipText;
                            tooltip.style.position = 'absolute';
                            tooltip.style.background = 'rgba(0, 0, 0, 0.9)';
                            tooltip.style.color = '#fff';
                            tooltip.style.padding = '4px 8px';
                            tooltip.style.borderRadius = '3px';
                            tooltip.style.fontSize = '10px';
                            tooltip.style.zIndex = '10000';

                            const rect = el.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const spaceAbove = rect.top;
                            const spaceBelow = viewportHeight - rect.bottom;

                            if (spaceAbove < 40 && spaceBelow > 40) {
                                tooltip.style.top = `${rect.bottom + 5}px`;
                                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                tooltip.style.transform = 'translateX(-50%)';
                            } else {
                                tooltip.style.top = `${rect.top - 30}px`;
                                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                tooltip.style.transform = 'translateX(-50%)';
                            }

                            document.body.appendChild(tooltip);
                            setTimeout(() => tooltip.remove(), 2000);
                            document.addEventListener('click', (e) => {
                                if (!el.contains(e.target)) tooltip.remove();
                            }, { once: true });
                        }
                    });
                });
            } catch (err) {
                console.error('Setup tooltips error:', err);
            }
        }

        drawBackground(app.persistentCtx);
        resizeCanvas();
        setupTooltips();
        updatePerformanceModeUI();
    } catch (err) {
        showNotification('Initialization error.', 'error');
        console.error('Initialization error:', err);
    }
});