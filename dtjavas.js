
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let painting = false;
    let lastX, lastY;
    let brushSize = 10;
    let smoothness = 0.5;
    let opacity = 0.1;
    let webDensity = 3;
    let webSpread = 0.5;
    let webWiggle = 0.1;
    let circleSize = 10;
    let borderWidth = 1;
    let watercolorSpread = 0.5;
    let watercolorBleed = 0.2;
    let wingSize = 30;
    let curlIntensity = 0.5;
    let wingOpacity = 0.3;
    let color1 = '#1df58d';
    let color2 = '#0000FF';
    let gradientRatio = 0.5; // Kept for UI consistency
    let symmetry = 4;
    let mirrorMode = 'none';
    let spiralMode = 'off';
    let dualTone = false;
    let bgColor = '#27362f';
    let transparentBg = false;
    let currentBrush = 'continuousCircle';
    let actions = [];
    let redoStack = [];
    let bgImage = null;
    let colorImage = null;
    let colorImageCanvas = null;
    let colorImageCtx = null;
    let colorSamplingMethod = 'random';
    let isDrawingStarted = false;
    let lowPerformanceMode = false;

    const persistentCanvas = document.createElement('canvas');
    const persistentCtx = persistentCanvas.getContext('2d');
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');

    const ASPECT_RATIO = 16 / 9;

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

    function resizeCanvas() {
        const toolbar = document.getElementById('toolbar');
        const container = document.getElementById('canvas-container');
        const isFullscreen = document.fullscreenElement !== null;

        let tempImageData = null;
        if (persistentCanvas.width > 0 && persistentCanvas.height > 0) {
            tempImageData = persistentCtx.getImageData(0, 0, persistentCanvas.width, persistentCanvas.height);
        }

        const resolution = getInternalResolution();
        canvas.width = resolution.width;
        canvas.height = resolution.height;
        persistentCanvas.width = resolution.width;
        persistentCanvas.height = resolution.height;
        offscreenCanvas.width = resolution.width;
        offscreenCanvas.height = resolution.height;

        if (isFullscreen) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        } else {
            const toolbarHeight = toolbar.offsetHeight;
            const availableWidth = window.innerWidth - 22;
            const availableHeight = window.innerHeight - toolbarHeight - 22;
            let displayWidth = availableWidth;
            let displayHeight = displayWidth / ASPECT_RATIO;
            if (displayHeight > availableHeight) {
                displayHeight = availableHeight;
                displayWidth = displayHeight * ASPECT_RATIO;
            }
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
        }

        drawBackground(persistentCtx);
        if (tempImageData) {
            persistentCtx.putImageData(tempImageData, 0, 0);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(persistentCanvas, 0, 0);
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            resizeCanvas();
        });
    });

    const updateSliderValue = (id, value) => document.getElementById(id).textContent = value;
    const updateValue = (id, func) => {
        const input = document.getElementById(id);
        if (input) {
            if (input.type === 'color') {
                input.addEventListener('input', (e) => {
                    func(e.target.value);
                    if (id === 'bgColor' && !bgImage && !transparentBg) {
                        drawBackground(persistentCtx);
                        ctx.drawImage(persistentCanvas, 0, 0);
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

    updateValue('brushSize', v => brushSize = parseFloat(v));
    updateValue('smoothness', v => smoothness = parseFloat(v) / 100);
    updateValue('opacity', v => opacity = parseFloat(v));
    updateValue('webDensity', v => webDensity = parseInt(v));
    updateValue('webSpread', v => webSpread = parseFloat(v));
    updateValue('webWiggle', v => webWiggle = parseFloat(v));
    updateValue('circleSize', v => circleSize = parseFloat(v));
    updateValue('borderWidth', v => borderWidth = parseFloat(v));
    updateValue('watercolorSpread', v => watercolorSpread = parseFloat(v));
    updateValue('watercolorBleed', v => watercolorBleed = parseFloat(v));
    updateValue('wingSize', v => wingSize = parseFloat(v));
    updateValue('curlIntensity', v => curlIntensity = parseFloat(v));
    updateValue('wingOpacity', v => wingOpacity = parseFloat(v));
    updateValue('colorPicker1', v => {
        color1 = v;
        if (dualTone && !colorImage) {
            colorImageCanvas = createGradientImage(color1, color2);
            colorImageCtx = colorImageCanvas.getContext('2d');
        }
    });
    updateValue('colorPicker2', v => {
        color2 = v;
        if (dualTone && !colorImage) {
            colorImageCanvas = createGradientImage(color1, color2);
            colorImageCtx = colorImageCanvas.getContext('2d');
        }
    });
    updateValue('gradientRatio', v => gradientRatio = parseFloat(v));
    updateValue('bgColor', v => bgColor = v);
    updateValue('colorSamplingMethod', v => colorSamplingMethod = v);

    document.querySelectorAll('.symmetry-option').forEach(option => {
        option.addEventListener('click', function() {
            if (lowPerformanceMode && parseInt(this.getAttribute('data-symmetry')) > 4) return;
            document.querySelectorAll('.symmetry-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            symmetry = parseInt(this.getAttribute('data-symmetry'), 10);
        });
    });

    document.querySelectorAll('.mirror-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.mirror-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            mirrorMode = this.getAttribute('data-mirror');
        });
    });

    document.querySelectorAll('.spiral-option').forEach(option => {
        option.addEventListener('click', function() {
            if (lowPerformanceMode && this.getAttribute('data-spiral') === 'on') return;
            document.querySelectorAll('.spiral-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            spiralMode = this.getAttribute('data-spiral');
        });
    });

    function createGradientImage(color1, color2) {
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 256;
        gradientCanvas.height = 1;
        const gradientCtx = gradientCanvas.getContext('2d');
        
        const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        
        gradientCtx.fillStyle = gradient;
        gradientCtx.fillRect(0, 0, 256, 1);
        
        return gradientCanvas;
    }

    document.getElementById('dualTone').addEventListener('change', e => {
        dualTone = e.target.checked;
        if (dualTone && !colorImage) {
            colorImageCanvas = createGradientImage(color1, color2);
            colorImageCtx = colorImageCanvas.getContext('2d');
            document.getElementById('colorSamplingMethod').value = 'horizontal';
            colorSamplingMethod = 'horizontal';
        } else if (!dualTone && !colorImage) {
            colorImageCanvas = null;
            colorImageCtx = null;
        }
    });

    function setupBrushOptions() {
        const brushSelect = document.getElementById('brushSelect');
        brushSelect.addEventListener('change', function() {
            currentBrush = this.value;
            ['webSettings', 'continuousCircleSettings', 'watercolorSettings', 'curlyWingsSettings'].forEach(id => {
                document.getElementById(id).style.display = currentBrush === id.split('Settings')[0] ? 'flex' : 'none';
            });
            if (currentBrush === 'continuousCircle') {
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
            const reader = new FileReader();
            reader.onload = (event) => {
                bgImage = new Image();
                bgImage.onload = () => {
                    drawBackground(persistentCtx);
                    ctx.drawImage(persistentCanvas, 0, 0);
                };
                bgImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('transparentBg').addEventListener('change', (e) => {
        transparentBg = e.target.checked;
        drawBackground(persistentCtx);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(persistentCanvas, 0, 0);
    });

    document.getElementById('colorImageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                colorImage = new Image();
                colorImage.onload = () => {
                    colorImageCanvas = document.createElement('canvas');
                    colorImageCanvas.width = colorImage.width;
                    colorImageCanvas.height = colorImage.height;
                    colorImageCtx = colorImageCanvas.getContext('2d');
                    colorImageCtx.drawImage(colorImage, 0, 0);
                };
                colorImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('removeColorImage').addEventListener('click', () => {
        colorImage = null;
        colorImageCanvas = null;
        colorImageCtx = null;
        document.getElementById('colorImageUpload').value = '';
        if (dualTone) {
            colorImageCanvas = createGradientImage(color1, color2);
            colorImageCtx = colorImageCanvas.getContext('2d');
        }
    });

    document.getElementById('removeBgImage').addEventListener('click', () => {
        bgImage = null;
        drawBackground(persistentCtx);
        ctx.drawImage(persistentCanvas, 0, 0);
        document.getElementById('bgImageUpload').value = '';
    });

    document.getElementById('performanceMode').addEventListener('change', (e) => {
        lowPerformanceMode = e.target.checked;
        updatePerformanceModeUI();
    });

    function updatePerformanceModeUI() {
        const symmetryOptions = document.querySelectorAll('.symmetry-option');
        const spiralOptions = document.querySelectorAll('.spiral-option');
        if (lowPerformanceMode) {
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

    function drawBackground(context) {
        if (transparentBg) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        } else if (bgImage) {
            context.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            context.fillStyle = bgColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    let lastDrawTime = 0;
    function draw(e) {
        e.preventDefault();
        if (!painting || e.buttons !== 1) return;
        const currentTime = performance.now();
        if (currentTime - lastDrawTime < 16) return;
        lastDrawTime = currentTime;

        const canvasRect = canvas.getBoundingClientRect();
        const resolution = getInternalResolution();
        const scaleX = resolution.width / canvasRect.width;
        const scaleY = resolution.height / canvasRect.height;
        let currentX = (e.clientX - canvasRect.left) * scaleX;
        let currentY = (e.clientY - canvasRect.top) * scaleY;

        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        const adjustedBrushSize = brushSize * (0.2 + 0.8 * pressure);
        const adjustedCircleSize = circleSize * (0.2 + 0.8 * pressure);

        if (!isDrawingStarted) {
            isDrawingStarted = true;
        }

        if (lastX !== undefined && lastY !== undefined) {
            const dx = currentX - lastX;
            const dy = currentY - lastY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            offscreenCtx.globalCompositeOperation = 'lighter';
            for (let i = 0; i <= distance; i += smoothness) {
                const point = i / distance;
                const x = lastX + dx * point;
                const y = lastY + dy * point;
                drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
            }
            persistentCtx.drawImage(offscreenCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(persistentCanvas, 0, 0);
            actions.push({
                imageData: persistentCtx.getImageData(0, 0, canvas.width, canvas.height)
            });
            redoStack = [];
        }
        lastX = currentX;
        lastY = currentY;
    }

    function drawWithSymmetry(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const effectiveSymmetry = lowPerformanceMode ? Math.min(symmetry, 4) : symmetry;
        const effectiveSpiralMode = lowPerformanceMode ? 'off' : spiralMode;

        for (let i = 0; i < effectiveSymmetry; i++) {
            const angle = i * (Math.PI * 2 / effectiveSymmetry);
            const newX = x - centerX;
            const newY = y - centerY;
            const rotatedX = newX * Math.cos(angle) - newY * Math.sin(angle) + centerX;
            const rotatedY = newX * Math.sin(angle) + newY * Math.cos(angle) + centerY;
            const rotatedDx = dx * Math.cos(angle) - dy * Math.sin(angle);
            const rotatedDy = dx * Math.sin(angle) + dy * Math.cos(angle);

            if (effectiveSpiralMode === 'on') {
                const distanceFromCenter = Math.sqrt((rotatedX - centerX) ** 2 + (rotatedY - centerY) ** 2);
                const baseAngle = Math.atan2(rotatedY - centerY, rotatedX - centerX);
                const spiralSteps = 10;
                const maxRadius = distanceFromCenter;

                for (let j = 0; j <= spiralSteps; j++) {
                    const t = j / spiralSteps;
                    const theta = baseAngle + t * Math.PI * 2;
                    const r = maxRadius * t;
                    const spiralX = centerX + r * Math.cos(theta);
                    const spiralY = centerY + r * Math.sin(theta);
                    const spiralDx = rotatedDx * (1 - t);
                    const spiralDy = rotatedDy * (1 - t);

                    if (spiralX >= 0 && spiralX <= canvas.width && spiralY >= 0 && spiralY <= canvas.height) {
                        applyMirrorTransformations(spiralX, spiralY, spiralDx, spiralDy, adjustedBrushSize * (1 - t), adjustedCircleSize * (1 - t));
                    }
                }
            } else {
                applyMirrorTransformations(rotatedX, rotatedY, rotatedDx, rotatedDy, adjustedBrushSize, adjustedCircleSize);
            }
        }
    }

    function applyMirrorTransformations(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
        drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize);
        if (mirrorMode === 'horizontal') {
            drawBrush(x, canvas.height - y, dx, -dy, adjustedBrushSize, adjustedCircleSize);
        } else if (mirrorMode === 'vertical') {
            drawBrush(canvas.width - x, y, -dx, dy, adjustedBrushSize, adjustedCircleSize);
        }
    }

    function drawBrush(x, y, dx, dy, adjustedBrushSize, adjustedCircleSize) {
        const color = getColor(x, y);
        switch (currentBrush) {
            case 'web':
                drawSpiderWeb(offscreenCtx, x, y, adjustedBrushSize, color);
                break;
            case 'continuousCircle':
                drawContinuousCircles(offscreenCtx, x, y, dx, dy, adjustedCircleSize, color);
                break;
            case 'watercolor':
                drawWatercolor(offscreenCtx, x, y, dx, dy, adjustedBrushSize, color);
                break;
            case 'curlyWings':
                drawCurlyWings(offscreenCtx, x, y, dx, dy, adjustedBrushSize, color);
                break;
        }
    }

    function getColor(x, y) {
        if (colorImageCtx) {
            let imgX, imgY;
            switch (colorSamplingMethod) {
                case 'random':
                    imgX = Math.floor(Math.random() * colorImageCanvas.width);
                    imgY = Math.floor(Math.random() * colorImageCanvas.height);
                    break;
                case 'spatial':
                    imgX = Math.floor((x / canvas.width) * colorImageCanvas.width);
                    imgY = Math.floor((y / canvas.height) * colorImageCanvas.height);
                    break;
                case 'horizontal':
                    imgX = Math.floor((x / canvas.width) * colorImageCanvas.width);
                    imgY = 0;
                    break;
                case 'vertical':
                    imgX = Math.floor(colorImageCanvas.width / 2);
                    imgY = Math.floor((y / canvas.height) * colorImageCanvas.height);
                    break;
                case 'radial':
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    const maxDistance = Math.sqrt((canvas.width / 2) ** 2 + (canvas.height / 2) ** 2);
                    const ratio = distance / maxDistance;
                    imgX = Math.floor(ratio * colorImageCanvas.width);
                    imgY = 0;
                    break;
            }
            imgX = Math.min(Math.max(imgX, 0), colorImageCanvas.width - 1);
            imgY = Math.min(Math.max(imgY, 0), colorImageCanvas.height - 1);
            const pixelData = colorImageCtx.getImageData(imgX, imgY, 1, 1).data;
            return `#${((1 << 24) + (pixelData[0] << 16) + (pixelData[1] << 8) + pixelData[2]).toString(16).slice(1)}`;
        }
        return color1;
    }

    function drawSpiderWeb(ctx, x, y, size, color) {
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < webDensity; i++) {
            let angle = Math.random() * Math.PI * 2;
            let endAngle = angle + (Math.random() - 0.5) * Math.PI * webSpread;
            let radius = size * (Math.random() + 0.5);
            let points = [];
            let segments = 10;
            for (let j = 0; j <= segments; j++) {
                let t = j / segments;
                let currentAngle = angle + (endAngle - angle) * t;
                let wiggle = (Math.random() - 0.5) * size * webWiggle;
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
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = borderWidth;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    function drawWatercolor(ctx, x, y, dx, dy, size, color) {
        ctx.globalAlpha = opacity * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * watercolorSpread, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = opacity * watercolorBleed;
        for (let i = 0; i < 5; i++) {
            const offsetX = (Math.random() - 0.5) * size * watercolorSpread;
            const offsetY = (Math.random() - 0.5) * size * watercolorSpread;
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, size * watercolorSpread * (0.5 + Math.random() * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    function drawCurlyWings(ctx, x, y, dx, dy, size, color) {
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();

        ctx.globalAlpha = wingOpacity;
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
            let controlX1 = wingBaseX + Math.cos(perpAngle) * wingSize * 0.3;
            let controlY1 = wingBaseY + Math.sin(perpAngle) * wingSize * 0.3;
            let controlX2 = wingBaseX - Math.cos(angle + curlIntensity) * wingSize * 0.7;
            let controlY2 = wingBaseY - Math.sin(angle + curlIntensity) * wingSize * 0.7;
            let endX = wingBaseX - Math.cos(angle + curlIntensity * 1.5) * wingSize;
            let endY = wingBaseY - Math.sin(angle + curlIntensity * 1.5) * wingSize;
            ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(wingBaseX, wingBaseY);
            controlX1 = wingBaseX - Math.cos(perpAngle) * wingSize * 0.3;
            controlY1 = wingBaseY - Math.sin(perpAngle) * wingSize * 0.3;
            controlX2 = wingBaseX - Math.cos(angle - curlIntensity) * wingSize * 0.7;
            controlY2 = wingBaseY - Math.sin(angle - curlIntensity) * wingSize * 0.7;
            endX = wingBaseX - Math.cos(angle - curlIntensity * 1.5) * wingSize;
            endY = wingBaseY - Math.sin(angle - curlIntensity * 1.5) * wingSize;
            ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    function startPosition(e) {
        e.preventDefault();
        const canvasRect = canvas.getBoundingClientRect();
        const resolution = getInternalResolution();
        const scaleX = resolution.width / canvasRect.width;
        const scaleY = resolution.height / canvasRect.height;
        lastX = (e.clientX - canvasRect.left) * scaleX;
        lastY = (e.clientY - canvasRect.top) * scaleY;
        painting = true;
        if (!isDrawingStarted) {
            isDrawingStarted = true;
        }
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        ctx.globalCompositeOperation = 'source-over';
        drawWithSymmetry(lastX, lastY, 0, 0, brushSize, circleSize);
        persistentCtx.drawImage(offscreenCanvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(persistentCanvas, 0, 0);
        actions.push({
            imageData: persistentCtx.getImageData(0, 0, canvas.width, canvas.height)
        });
        redoStack = [];
    }

    canvas.addEventListener('pointerdown', startPosition);
    canvas.addEventListener('pointermove', draw);
    document.addEventListener('pointerup', () => {
        painting = false;
        lastX = undefined;
        lastY = undefined;
    });

    document.getElementById('clear').addEventListener('click', () => {
        persistentCtx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground(persistentCtx);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(persistentCanvas, 0, 0);
        actions = [];
        redoStack = [];
        isDrawingStarted = false;
    });

    document.getElementById('save').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'brush_pattern_art.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    document.getElementById('undo').addEventListener('click', () => {
        if (actions.length > 1) {
            redoStack.push(actions.pop());
            const lastAction = actions[actions.length - 1];
            persistentCtx.putImageData(lastAction.imageData, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(persistentCanvas, 0, 0);
        }
    });

    document.getElementById('redo').addEventListener('click', () => {
        if (redoStack.length > 0) {
            const action = redoStack.pop();
            persistentCtx.putImageData(action.imageData, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(persistentCanvas, 0, 0);
            actions.push(action);
        }
    });

    document.getElementById('undoAll').addEventListener('click', () => {
        if (actions.length > 1) {
            let frameIndex = actions.length - 1;
            function undoFrame() {
                if (frameIndex > 0) {
                    persistentCtx.putImageData(actions[frameIndex - 1].imageData, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(persistentCanvas, 0, 0);
                    redoStack.push(actions.pop());
                    frameIndex--;
                    setTimeout(undoFrame, 50);
                }
            }
            undoFrame();
        }
    });

    document.getElementById('redoAll').addEventListener('click', () => {
        if (redoStack.length > 0) {
            function redoFrame() {
                if (redoStack.length > 0) {
                    const action = redoStack.pop();
                    persistentCtx.putImageData(action.imageData, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(persistentCanvas, 0, 0);
                    actions.push(action);
                    setTimeout(redoFrame, 50);
                }
            }
            redoFrame();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            document.getElementById('undo').click();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            document.getElementById('toggleFullscreen').click();
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
                tooltip.style.zIndex = '10000'; // Increased from 101 to 1000

                const rect = el.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const spaceAbove = rect.top;
                const spaceBelow = viewportHeight - rect.bottom;

                // Position below if not enough space above
                if (spaceAbove < 40 && spaceBelow > 40) {
                    tooltip.style.top = `${rect.bottom + 5}px`; // 5px below element
                    tooltip.style.left = `${rect.left + rect.width / 2}px`;
                    tooltip.style.transform = 'translateX(-50%)';
                } else {
                    tooltip.style.top = `${rect.top - 30}px`; // Original above
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

    drawBackground(persistentCtx);
    resizeCanvas();
    setupTooltips();
    updatePerformanceModeUI();
});
