// Core Setup and Variables
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
    circleSize: 10,
    borderWidth: 1,
    watercolorSpread: 0.5,
    watercolorBleed: 0.2,
    wingSize: 30,
    curlIntensity: 0.5,
    wingOpacity: 0.3,
    symmetry: 4,
    mirrorMode: 'none',
    spiralMode: 'off',
    bgColor: '#27362f',
    bgColor2: '#1a252f',
    gradientBg: false,
    transparentBg: false,
    currentBrush: 'continuousCircle',
    actions: [],
    redoStack: [],
    strokes: [],
    bgImage: null,
    colors: ['#1df58d'],
    colorCount: 1,
    colorImage: null,
    colorImageCanvas: null,
    colorImageCtx: null,
    colorSamplingMethod: 'random',
    isDrawingStarted: false,
    lowPerformanceMode: false,
    spiralSteps: 10,
    scale: 1,
    initialDistance: 0,
    initialScale: 1,
    recording: false,
    mediaRecorder: null,
    recordedChunks: [],
    frameRate: 30,
    ASPECT_RATIO: 16 / 9,
    lastDrawTime: 0,
    defaultColors: ['#1df58d', '#0000FF', '#FF0000', '#FFFF00', '#00FF00', '#FF00FF', '#00FFFF', '#800080', '#FFA500', '#808080']
};

// Utility Functions
function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getInternalResolution() {
    const resolutionSelect = document.getElementById('canvasResolution');
    const selectedValue = resolutionSelect ? resolutionSelect.value : 'fullhd';
    switch (selectedValue) {
        case 'hd': return { width: 1280, height: 720 };
        case 'fullhd': return { width: 1920, height: 1080 };
        case '4k': return { width: 3840, height: 2160 };
        default: return { width: 1920, height: 1080 };
    }
}

function getVideoResolution() {
    const select = document.getElementById('videoResolution');
    const value = select ? select.value : '1080p';
    switch (value) {
        case '720p': return { width: 1280, height: 720 };
        case '1080p': return { width: 1920, height: 1080 };
        default: return { width: 1920, height: 1080 };
    }
}

// Symmetry and Canvas Setup
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
    }
}

function resizeCanvas() {
    const app = DrawingApp;
    const toolbar = document.getElementById('toolbar');
    const isFullscreen = document.fullscreenElement !== null;
    let tempImageData = null;
    if (app.persistentCanvas.width > 0 && app.persistentCanvas.height > 0) {
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
        const toolbarHeight = toolbar.offsetHeight;
        const availableWidth = window.innerWidth - 22;
        const availableHeight = window.innerHeight - toolbarHeight - 22;
        let displayWidth = availableWidth;
        let displayHeight = displayWidth / app.ASPECT_RATIO;
        if (displayHeight > availableHeight) {
            displayHeight = availableHeight;
            displayWidth = displayHeight * app.ASPECT_RATIO;
        }
        app.canvas.style.width = `${displayWidth}px`;
        app.canvas.style.height = `${displayHeight}px`;
    }

    drawBackground(app.persistentCtx);
    if (tempImageData) app.persistentCtx.putImageData(tempImageData, 0, 0);
    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
    app.ctx.drawImage(app.persistentCanvas, 0, 0);
}

function drawBackground(context) {
    const app = DrawingApp;
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
}

// Drawing Logic
function createGradientImage(colors) {
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
}

function draw(e) {
    const app = DrawingApp;
    e.preventDefault();
    if (!app.painting || (e.buttons !== 1 && !e.touches)) return;
    const currentTime = performance.now();
    if (currentTime - app.lastDrawTime < 16) return;
    app.lastDrawTime = currentTime;

    const canvasRect = app.canvas.getBoundingClientRect();
    const resolution = getInternalResolution();
    const scaleX = resolution.width / canvasRect.width;
    const scaleY = resolution.height / canvasRect.height;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    let currentX = (clientX - canvasRect.left) * scaleX / app.scale;
    let currentY = (clientY - canvasRect.top) * scaleY / app.scale;

    const pressure = e.pressure !== undefined ? e.pressure : 0.5;
    const adjustedBrushSize = app.brushSize * (0.2 + 0.8 * pressure);
    const adjustedCircleSize = app.circleSize * (0.2 + 0.8 * pressure);

    if (!app.isDrawingStarted) {
        app.isDrawingStarted = true;
        if (!app.recording) startMP4Recording();
    }

    if (app.lastX !== undefined && app.lastY !== undefined) {
        const dx = currentX - app.lastX;
        const dy = currentY - app.lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        app.offscreenCtx.clearRect(0, 0, app.offscreenCanvas.width, app.offscreenCanvas.height);
        app.offscreenCtx.globalCompositeOperation = 'lighter';
        const strokePoints = [];
        for (let i = 0; i <= distance; i += app.smoothness) {
            const point = i / distance;
            const x = app.lastX + dx * point;
            const y = app.lastY + dy * point;
            strokePoints.push({ x, y, time: currentTime });
            drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
        }
        app.persistentCtx.drawImage(app.offscreenCanvas, 0, 0);
        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
        app.ctx.drawImage(app.persistentCanvas, 0, 0);
        const color = getColor(currentX, currentY);
        app.strokes.push({ points: strokePoints, brush: app.currentBrush, size: adjustedBrushSize, color, opacity: app.opacity });
        app.actions.push({ imageData: app.persistentCtx.getImageData(0, 0, app.canvas.width, app.canvas.height), strokes: strokePoints, brush: app.currentBrush, size: adjustedBrushSize, color, opacity: app.opacity });
        app.redoStack = [];
    }
    app.lastX = currentX;
    app.lastY = currentY;
}

function drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
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
}

function applyMirrorTransformations(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
    drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
    if (app.mirrorMode === 'horizontal') {
        drawBrush(x, app.canvas.height - y, dx, -dy, adjustedBrushSize, adjustedCircleSize);
    } else if (app.mirrorMode === 'vertical') {
        drawBrush(app.canvas.width - x, y, -dx, dy, adjustedBrushSize, adjustedCircleSize);
    }
}

function drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
    const app = DrawingApp;
    const color = getColor(x, y);
    switch (app.currentBrush) {
        case 'web': drawSpiderWeb(app.offscreenCtx, x, y, adjustedBrushSize, color); break;
        case 'continuousCircle': drawContinuousCircles(app.offscreenCtx, x, y, dx, dy, adjustedCircleSize, color); break;
        case 'watercolor': drawWatercolor(app.offscreenCtx, x, y, dx, dy, adjustedBrushSize, color); break;
        case 'curlyWings': drawCurlyWings(app.offscreenCtx, x, y, dx, dy, adjustedBrushSize, color); break;
    }
}

function getColor(x, y) {
    const app = DrawingApp;
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
    return app.colors[0];
}

function drawSpiderWeb(ctx, x, y, size, color) {
    const app = DrawingApp;
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
}

function drawContinuousCircles(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
    ctx.globalAlpha = app.opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = app.borderWidth;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

function drawWatercolor(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
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
}

function drawCurlyWings(ctx, x, y, dx, dy, size, color) {
    const app = DrawingApp;
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
}

// Event Listeners and Recording
function startPosition(e) {
    const app = DrawingApp;
    e.preventDefault();
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
    drawWithSymmetry(app.lastX, app.lastY, 0, 0, app.brushSize, app.circleSize);
    app.persistentCtx.drawImage(app.offscreenCanvas, 0, 0);
    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
    app.ctx.drawImage(app.persistentCanvas, 0, 0);
    const color = getColor(app.lastX, app.lastY);
    app.strokes.push({ points: [{ x: app.lastX, y: app.lastY, time: performance.now() }], brush: app.currentBrush, size: app.brushSize, color, opacity: app.opacity });
    app.actions.push({ imageData: app.persistentCtx.getImageData(0, 0, app.canvas.width, app.canvas.height), strokes: [{ x: app.lastX, y: app.lastY }], brush: app.currentBrush, size: app.brushSize, color, opacity: app.opacity });
    app.redoStack = [];
}

function startMP4Recording() {
    const app = DrawingApp;
    if (app.recording) return;
    if (app.actions.length === 0) {
        showNotification('No drawing actions to record.', 'error');
        return;
    }

    const videoRes = getVideoResolution();
    const recordingCanvas = document.createElement('canvas');
    recordingCanvas.width = videoRes.width;
    recordingCanvas.height = videoRes.height;
    const recordingCtx = recordingCanvas.getContext('2d');

    app.recordedChunks = [];
    const stream = recordingCanvas.captureStream(app.frameRate);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    app.mediaRecorder = new MediaRecorder(stream, { mimeType });
    app.mediaRecorder.ondataavailable = (e) => app.recordedChunks.push(e.data);
    app.mediaRecorder.onstop = () => {
        const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
        const blob = new Blob(app.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `drawing_process_${videoRes.width}x${videoRes.height}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification(`Saved as ${extension} at ${videoRes.width}x${videoRes.height}`, 'success');
        app.recording = false;
        document.getElementById('saveMP4').textContent = 'Save MP4';
        resizeCanvas();
    };

    app.mediaRecorder.start();
    app.recording = true;
    document.getElementById('saveMP4').textContent = 'Stop Recording';

    recordingCtx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
    drawBackground(recordingCtx);

    let frameIndex = 0;
    const frameDelay = 1000 / app.frameRate;

    function replayFrame() {
        if (frameIndex < app.actions.length && app.recording) {
            recordingCtx.putImageData(app.actions[frameIndex].imageData, 0, 0);
            frameIndex++;
            setTimeout(replayFrame, frameDelay);
        } else if (app.recording) {
            app.mediaRecorder.stop();
        }
    }

    replayFrame();
}

// UI and Initialization
document.addEventListener('DOMContentLoaded', () => {
    const app = DrawingApp;
    app.canvas = document.getElementById('canvas');
    app.ctx = app.canvas.getContext('2d');
    app.persistentCanvas = document.createElement('canvas');
    app.persistentCtx = app.persistentCanvas.getContext('2d');
    app.offscreenCanvas = document.createElement('canvas');
    app.offscreenCtx = app.offscreenCanvas.getContext('2d');

    // Hide GIF and SVG buttons if they exist
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
        "The world always seems brighter when you’ve just made something that wasn’t there before...:Neil Gaiman",
        "Art is the journey of a free soul...:Alev Oguz",
        "Every canvas is a journey all its own...:Helen Frankenthaler"
    ];
    document.getElementById('quote-text').textContent = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('close-welcome').addEventListener('click', () => {
        document.getElementById('welcome-screen').classList.add('hidden');
    });

    window.addEventListener('load', () => {
        showNotification('Welcome to the Brush Stroke Patterns Drawing Tool!', 'success');
    });

    function handleOrientationChange() {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        const portraitMedia = window.matchMedia("(orientation: portrait) and (max-width: 768px)");
        const overlay = document.getElementById('orientation-overlay');
        if (isMobile && portraitMedia.matches) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
            resizeCanvas();
        }
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.matchMedia("(orientation: portrait)").addEventListener('change', handleOrientationChange);
    document.getElementById('dismiss-overlay').addEventListener('click', () => {
        document.getElementById('orientation-overlay').style.display = 'none';
        resizeCanvas();
    });

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            resizeCanvas();
        });
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tab.click();
            }
        });
    });

    const updateSliderValue = (id, value) => document.getElementById(id).textContent = value;
    const updateValue = (id, func) => {
        const input = document.getElementById(id);
        if (input) {
            if (input.type === 'color') {
                input.addEventListener('input', (e) => {
                    func(e.target.value);
                    if ((id === 'bgColor' || id === 'bgColor2') && !app.bgImage && !app.transparentBg) {
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
            } else {
                input.addEventListener('change', (e) => func(e.target.value));
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

    function updateColorInputs() {
        const colorInputs = document.getElementById('colorInputs');
        colorInputs.innerHTML = '';
        for (let i = 0; i < app.colorCount; i++) {
            const label = document.createElement('label');
            label.textContent = `Color ${i + 1}:`;
            label.setAttribute('data-tooltip', `Pick color ${i + 1}`);
            const input = document.createElement('input');
            input.type = 'color';
            input.id = `colorPicker${i + 1}`;
            input.value = app.colors[i] || app.defaultColors[i % app.defaultColors.length];
            input.setAttribute('aria-label', `Color ${i + 1}`);
            colorInputs.appendChild(label);
            colorInputs.appendChild(input);

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
    }

    updateColorInputs();

    document.getElementById('colorCount').addEventListener('change', (e) => {
        app.colorCount = parseInt(e.target.value);
        const prevColors = app.colors.slice();
        app.colors = [];
        for (let i = 0; i < app.colorCount; i++) {
            app.colors[i] = prevColors[i] || app.defaultColors[i % app.defaultColors.length];
        }
        updateColorInputs();
    });

    document.querySelectorAll('.symmetry-option').forEach(option => {
        option.addEventListener('click', function() {
            if (app.lowPerformanceMode && parseInt(this.getAttribute('data-symmetry')) > 4) return;
            document.querySelectorAll('.symmetry-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            app.symmetry = parseInt(this.getAttribute('data-symmetry'), 10);
        });
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                option.click();
            }
        });
    });

    document.querySelectorAll('.mirror-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.mirror-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            app.mirrorMode = this.getAttribute('data-mirror');
        });
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                option.click();
            }
        });
    });

    document.querySelectorAll('.spiral-option').forEach(option => {
        option.addEventListener('click', function() {
            if (app.lowPerformanceMode && this.getAttribute('data-spiral') === 'on') return;
            document.querySelectorAll('.spiral-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            app.spiralMode = this.getAttribute('data-spiral');
            document.getElementById('spiralSettings').style.display = app.spiralMode === 'on' ? 'flex' : 'none';
        });
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                option.click();
            }
        });
    });

    function setupBrushOptions() {
        const brushSelect = document.getElementById('brushSelect');
        brushSelect.addEventListener('change', function() {
            app.currentBrush = this.value;
            ['webSettings', 'continuousCircleSettings', 'watercolorSettings', 'curlyWingsSettings'].forEach(id => {
                document.getElementById(id).style.display = app.currentBrush === id.split('Settings')[0] ? 'flex' : 'none';
            });
            if (app.currentBrush === 'continuousCircle') {
                document.getElementById('continuousCircleSettings').style.display = 'flex';
            }
        });
        brushSelect.dispatchEvent(new Event('change'));
    }
    setupBrushOptions();

    document.getElementById('canvasResolution').addEventListener('change', resizeCanvas);

    document.getElementById('bgImageUpload').addEventListener('change', (e) => {
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
                    drawBackground(app.persistentCtx);
                    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                    app.ctx.drawImage(app.persistentCanvas, 0, 0);
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
    });

    document.getElementById('gradientBg').addEventListener('change', (e) => {
        app.gradientBg = e.target.checked;
        drawBackground(app.persistentCtx);
        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
        app.ctx.drawImage(app.persistentCanvas, 0, 0);
    });

    document.getElementById('transparentBg').addEventListener('change', (e) => {
        app.transparentBg = e.target.checked;
        drawBackground(app.persistentCtx);
        app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
        app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
        app.ctx.drawImage(app.persistentCanvas, 0, 0);
    });

    document.getElementById('colorImageUpload').addEventListener('change', (e) => {
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
    });

    document.getElementById('removeColorImage').addEventListener('click', () => {
        app.colorImage = null;
        app.colorImageCanvas = createGradientImage(app.colors);
        app.colorImageCtx = app.colorImageCanvas ? app.colorImageCanvas.getContext('2d') : null;
        document.getElementById('colorImageUpload').value = '';
        showNotification('Color image removed.', 'success');
    });

    document.getElementById('performanceMode').addEventListener('change', (e) => {
        app.lowPerformanceMode = e.target.checked;
        updatePerformanceModeUI();
    });

    function updatePerformanceModeUI() {
        const symmetryOptions = document.querySelectorAll('.symmetry-option');
        const spiralOptions = document.querySelectorAll('.spiral-option');
        if (app.lowPerformanceMode) {
            symmetryOptions.forEach(option => {
                const value = parseInt(option.getAttribute('data-symmetry'));
                if (value > 4) {
                    option.classList.add('disabled');
                    if (option.classList.contains('active')) {
                        document.querySelector('.symmetry-option[data-symmetry="4"]').click();
                    }
                }
            });
            spiralOptions.forEach(option => {
                if (option.getAttribute('data-spiral') === 'on') {
                    option.classList.add('disabled');
                    if (option.classList.contains('active')) {
                        document.querySelector('.spiral-option[data-spiral="off"]').click();
                    }
                }
            });
        } else {
            symmetryOptions.forEach(option => option.classList.remove('disabled'));
            spiralOptions.forEach(option => option.classList.remove('disabled'));
        }
    }

    app.canvas.addEventListener('pointerdown', startPosition);
    app.canvas.addEventListener('pointermove', draw);
    document.addEventListener('pointerup', () => {
        app.painting = false;
        app.lastX = undefined;
        app.lastY = undefined;
    });

    app.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            app.initialDistance = getTouchDistance(e.touches);
            app.initialScale = app.scale;
        } else {
            startPosition(e);
        }
    }, { passive: false });

    app.canvas.addEventListener('touchmove', (e) => {
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
        if (e.touches.length < 2) {
            app.painting = false;
            app.lastX = undefined;
            app.lastY = undefined;
        }
    }, { passive: false });

    document.getElementById('clear').addEventListener('click', () => {
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
            document.getElementById('saveMP4').textContent = 'Save MP4';
        }
        showNotification('Canvas cleared!', 'success');
    });

    document.getElementById('save').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'brush_pattern_art.png';
        link.href = app.canvas.toDataURL('image/png');
        link.click();
        showNotification('PNG saved successfully!', 'success');
    });

    document.getElementById('saveMP4').addEventListener('click', () => {
        if (!app.recording) {
            startMP4Recording();
        } else {
            app.mediaRecorder.stop();
            app.recording = false;
            document.getElementById('saveMP4').textContent = 'Save MP4';
        }
    });

    document.getElementById('undo').addEventListener('click', () => {
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
    });

    document.getElementById('redo').addEventListener('click', () => {
        if (app.redoStack.length > 0) {
            const action = app.redoStack.pop();
            app.persistentCtx.putImageData(action.imageData, 0, 0);
            app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
            app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
            app.ctx.drawImage(app.persistentCanvas, 0, 0);
            app.actions.push(action);
            app.strokes.push(action.strokes);
            showNotification('Action redone.', 'success');
        }
    });

    document.getElementById('undoAll').addEventListener('click', () => {
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
    });

    document.getElementById('redoAll').addEventListener('click', () => {
        if (app.redoStack.length > 0) {
            function redoFrame() {
                if (app.redoStack.length > 0) {
                    const action = app.redoStack.pop();
                    app.persistentCtx.putImageData(action.imageData, 0, 0);
                    app.ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
                    app.ctx.clearRect(0, 0, app.canvas.width / app.scale, app.canvas.height / app.scale);
                    app.ctx.drawImage(app.persistentCanvas, 0, 0);
                    app.actions.push(action);
                    app.strokes.push(action.strokes);
                    setTimeout(redoFrame, 50);
                }
            }
            redoFrame();
            showNotification('All actions redone.', 'success');
        }
    });

    const toggleFullscreenBtn = document.getElementById('toggleFullscreen');
    const showToolbarBtn = document.getElementById('showToolbarBtn');
    const toolbar = document.getElementById('toolbar');
    const container = document.getElementById('canvas-container');

    toggleFullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            toggleFullscreenBtn.textContent = 'Exit Fullscreen';
        } else {
            document.exitFullscreen();
            toggleFullscreenBtn.textContent = 'Fullscreen';
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            container.classList.add('fullscreen');
            showToolbarBtn.style.display = 'block';
            toolbar.classList.add('hidden');
        } else {
            container.classList.remove('fullscreen');
            showToolbarBtn.style.display = 'none';
            toolbar.classList.remove('hidden');
            toolbar.style.transform = 'translateY(0)';
            resizeCanvas();
        }
    });

    showToolbarBtn.addEventListener('mouseover', () => {
        toolbar.classList.remove('hidden');
        toolbar.style.transform = 'translateY(0)';
    });

    toolbar.addEventListener('mouseleave', () => {
        if (document.fullscreenElement) {
            toolbar.style.transform = 'translateY(-100%)';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            document.getElementById('undo').click();
        }
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            document.getElementById('toggleFullscreen').click();
        }
    });

    function setupTooltips() {
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
    }

    drawBackground(app.persistentCtx);
    resizeCanvas();
    setupTooltips();
    updatePerformanceModeUI();
});