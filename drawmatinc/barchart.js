// script.js
const WEBSITE_NAME = 'BarChart Generator';
const HOME_URL = window.location.origin + window.location.pathname;

// Default data
let chartConfig = {
    data: [
        { label: 'Apples', value: 25, color: '#ff6384' },
        { label: 'Oranges', value: 40, color: '#36a2eb' },
        { label: 'Bananas', value: 30, color: '#ffce56' }
    ],
    xAxisTitle: 'Fruits',
    yAxisTitle: 'Quantity',
    orientation: 'vertical',
    showGrid: true,
    enable3d: false,
    backgroundColor: '#ffffff',
    backgroundOpacity: 1,
    barOpacity: 1
};

let chartInstance = null;

function addTableRow(data = { label: '', value: '', color: '#000000' }) {
    const tbody = document.querySelector('#data-table tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="label-input" value="${data.label}"></td>
        <td><input type="number" class="value-input" value="${data.value}"></td>
        <td><input type="color" class="color-input" value="${data.color}"></td>
        <td><button class="remove-row">Remove</button></td>
    `;
    tbody.appendChild(row);

    row.querySelector('.remove-row').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            row.remove();
        } else {
            alert('At least one row is required.');
        }
    });
}

function collectDataFromTable() {
    const rows = document.querySelectorAll('#data-table tbody tr');
    const data = [];
    for (const row of rows) {
        const label = row.querySelector('.label-input').value.trim();
        const value = parseFloat(row.querySelector('.value-input').value);
        const color = row.querySelector('.color-input').value;
        if (label && !isNaN(value)) {
            data.push({ label, value, color });
        }
    }
    if (data.length === 0) {
        alert('Please enter valid data in at least one row.');
        return null;
    }
    return data;
}

function validateData(data) {
    return data.every(item => item.label && !isNaN(item.value) && item.color);
}

function hexToRgba(hex, opacity) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function renderChart(config, isViewOnly = false) {
    let chartType = config.enable3d ? 'cylinder' : (config.orientation === 'horizontal' ? 'bar' : 'column');
    const bgRgba = hexToRgba(config.backgroundColor, config.backgroundOpacity);
    const options = {
        chart: {
            type: chartType,
            height: isViewOnly ? '100%' : 400,
            backgroundColor: bgRgba,
            options3d: config.enable3d ? {
                enabled: true,
                alpha: 15,
                beta: 15,
                depth: 50,
                viewDistance: 25
            } : {},
            inverted: config.orientation === 'horizontal' && !config.enable3d
        },
        title: {
            text: null
        },
        xAxis: {
            categories: config.data.map(d => d.label),
            title: { text: config.xAxisTitle },
            gridLineWidth: config.showGrid ? 1 : 0
        },
        yAxis: {
            title: { text: config.yAxisTitle },
            gridLineWidth: config.showGrid ? 1 : 0
        },
        series: [{
            data: config.data.map(d => ({
                y: d.value,
                color: hexToRgba(d.color, config.barOpacity)
            })),
            name: config.yAxisTitle,
            opacity: config.barOpacity // Global opacity fallback if needed
        }],
        plotOptions: {
            [chartType]: {
                depth: config.enable3d ? 25 : null
            },
            series: {
                opacity: config.barOpacity
            }
        },
        legend: {
            enabled: false
        },
        tooltip: {
            enabled: true
        },
        credits: {
            enabled: false
        },
        exporting: {
            enabled: true,
            chartOptions: {
                credits: {
                    enabled: true,
                    text: WEBSITE_NAME,
                    href: HOME_URL,
                    position: {
                        align: 'right',
                        x: -10,
                        verticalAlign: 'bottom',
                        y: -5
                    },
                    style: {
                        cursor: 'pointer',
                        color: '#909090',
                        fontSize: '9px'
                    }
                }
            }
        }
    };

    chartInstance = Highcharts.chart('bar-chart', options);

    // Add mouse drag for 3D rotation if enabled
    if (config.enable3d) {
        (function (H) {
            H.addEvent(H.Chart, 'afterGetContainer', function () {
                this.container.addEventListener('mousedown', function (e) {
                    e = this.pointer.normalize(e);
                    var posX = e.pageX,
                        posY = e.pageY,
                        alpha = this.options.chart.options3d.alpha,
                        beta = this.options.chart.options3d.beta,
                        newAlpha,
                        newBeta,
                        sensitivity = 5;

                    var mouseMove = function (e) {
                        newBeta = beta + (posX - e.pageX) / sensitivity;
                        newAlpha = alpha + (e.pageY - posY) / sensitivity;
                        this.options.chart.options3d.alpha = newAlpha;
                        this.options.chart.options3d.beta = newBeta;
                        this.redraw(false);
                    }.bind(this);

                    var mouseUp = function () {
                        document.removeEventListener('mousemove', mouseMove);
                        document.removeEventListener('mouseup', mouseUp);
                    };

                    document.addEventListener('mousemove', mouseMove);
                    document.addEventListener('mouseup', mouseUp);
                }.bind(this));
            });
        }(Highcharts));
    }

    document.getElementById('status').textContent = 'Chart updated.';
}

function generateSummary(config) {
    const data = config.data;
    const yTitle = config.yAxisTitle || 'Values';
    const xTitle = config.xAxisTitle || 'Categories';

    if (data.length === 0) return 'No data available for summary.';

    // Calculate stats
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const maxLabel = data.find(d => d.value === maxValue).label;
    const minLabel = data.find(d => d.value === minValue).label;
    const total = values.reduce((sum, v) => sum + v, 0);
    const average = (total / values.length).toFixed(2);

    // Simple trend analysis (assuming labels are in order)
    let trend = '';
    if (data.length > 1) {
        const differences = [];
        for (let i = 1; i < data.length; i++) {
            differences.push(data[i].value - data[i-1].value);
        }
        const avgDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
        if (avgDiff > 0) {
            trend = 'The data shows an overall increasing trend.';
        } else if (avgDiff < 0) {
            trend = 'The data shows an overall decreasing trend.';
        } else {
            trend = 'The data appears stable with no clear trend.';
        }
    }

    // Percentage distribution
    const percentages = data.map(d => ({
        label: d.label,
        perc: (d.value / total * 100).toFixed(2)
    }));

    let percDist = 'Percentage Distribution:\n' + percentages.map(p => `${p.label}: ${p.perc}%`).join('\n') + '\n';

    // Percentage-wise comparisons (pairwise for sorted data)
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    let comparisons = 'Key Percentage Comparisons:\n';
    for (let i = 0; i < sortedData.length - 1; i++) {
        for (let j = i + 1; j < sortedData.length; j++) {
            const diff = ((sortedData[i].value - sortedData[j].value) / sortedData[j].value * 100).toFixed(2);
            if (diff > 0) {
                comparisons += `${sortedData[i].label} is ${diff}% higher than ${sortedData[j].label}.\n`;
            }
        }
    }
    if (sortedData.length < 2) {
        comparisons += 'Not enough data for comparisons.\n';
    }

    // Build summary text
    let summary = `Analytical Summary of the Chart:\n\n`;
    summary += `This chart displays ${data.length} ${xTitle.toLowerCase()} with corresponding ${yTitle.toLowerCase()}.\n`;
    summary += `Highest value: ${maxValue} (${maxLabel})\n`;
    summary += `Lowest value: ${minValue} (${minLabel})\n`;
    summary += `Total ${yTitle.toLowerCase()}: ${total}\n`;
    summary += `Average ${yTitle.toLowerCase()}: ${average}\n`;
    summary += `${trend}\n\n`;
    summary += percDist + '\n';
    summary += comparisons;

    return summary;
}

function updateConfigFromInputs() {
    const data = collectDataFromTable();
    if (!data || !validateData(data)) {
        return false;
    }
    const xAxisTitle = document.getElementById('x-axis-title').value || 'Categories';
    const yAxisTitle = document.getElementById('y-axis-title').value || 'Values';
    const orientation = document.getElementById('orientation').value;
    const showGrid = document.getElementById('show-grid').checked;
    const enable3d = document.getElementById('enable-3d').checked;
    const backgroundColor = document.getElementById('background-color').value;
    const backgroundOpacity = parseFloat(document.getElementById('background-opacity').value);
    const barOpacity = parseFloat(document.getElementById('bar-opacity').value);

    chartConfig = {
        data,
        xAxisTitle,
        yAxisTitle,
        orientation,
        showGrid,
        enable3d,
        backgroundColor,
        backgroundOpacity,
        barOpacity
    };
    return true;
}

function populateInputsFromConfig(config) {
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';
    config.data.forEach(d => addTableRow(d));
    document.getElementById('x-axis-title').value = config.xAxisTitle;
    document.getElementById('y-axis-title').value = config.yAxisTitle;
    document.getElementById('orientation').value = config.orientation;
    document.getElementById('show-grid').checked = config.showGrid;
    document.getElementById('enable-3d').checked = config.enable3d;
    document.getElementById('background-color').value = config.backgroundColor;
    document.getElementById('background-opacity').value = config.backgroundOpacity;
    document.getElementById('bg-opacity-value').textContent = config.backgroundOpacity;
    document.getElementById('bar-opacity').value = config.barOpacity;
    document.getElementById('bar-opacity-value').textContent = config.barOpacity;
}

function serializeConfig(config) {
    return btoa(JSON.stringify(config));
}

function deserializeConfig(encoded) {
    try {
        return JSON.parse(atob(encoded));
    } catch (e) {
        console.error('Invalid config:', e);
        return null;
    }
}

function generateShareLink(encoded) {
    return `${HOME_URL}?config=${encoded}`;
}

function generateEmbedCode(link) {
    return `<iframe src="${link}" width="600" height="400" frameborder="0" allowfullscreen></iframe>`;
}

// Event Listeners
document.getElementById('add-row').addEventListener('click', () => addTableRow());

document.getElementById('generate-chart').addEventListener('click', () => {
    if (updateConfigFromInputs()) {
        renderChart(chartConfig, false);
    }
});

document.getElementById('generate-share').addEventListener('click', () => {
    if (updateConfigFromInputs()) {
        const encoded = serializeConfig(chartConfig);
        const link = generateShareLink(encoded);
        const embed = generateEmbedCode(link);

        document.getElementById('home-link').value = HOME_URL;
        document.getElementById('share-link').value = link;
        document.getElementById('embed-code').value = embed;
        document.getElementById('share-section').style.display = 'block';
    }
});

document.getElementById('copy-home').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('home-link').value);
    alert('Home link copied!');
});

document.getElementById('copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('share-link').value);
    alert('Share link copied!');
});

document.getElementById('copy-embed').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('embed-code').value);
    alert('Embed code copied!');
});

document.getElementById('export-image').addEventListener('click', () => {
    if (chartInstance) {
        chartInstance.exportChartLocal({
            type: 'image/png',
            filename: 'chart'
        });
    } else {
        alert('Generate a chart first.');
    }
});

document.getElementById('reset').addEventListener('click', () => {
    chartConfig = {
        data: [
            { label: 'Apples', value: 25, color: '#ff6384' },
            { label: 'Oranges', value: 40, color: '#36a2eb' },
            { label: 'Bananas', value: 30, color: '#ffce56' }
        ],
        xAxisTitle: 'Fruits',
        yAxisTitle: 'Quantity',
        orientation: 'vertical',
        showGrid: true,
        enable3d: false,
        backgroundColor: '#ffffff',
        backgroundOpacity: 1,
        barOpacity: 1
    };
    populateInputsFromConfig(chartConfig);
    renderChart(chartConfig, false);
    document.getElementById('share-section').style.display = 'none';
    document.getElementById('summary-section').style.display = 'none';
});

document.getElementById('generate-summary').addEventListener('click', () => {
    if (updateConfigFromInputs()) {
        const summary = generateSummary(chartConfig);
        document.getElementById('summary-text').textContent = summary;
        document.getElementById('summary-section').style.display = 'block';
    } else {
        alert('Please generate a chart first.');
    }
});

document.getElementById('copy-summary').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('summary-text').textContent);
    alert('Summary copied!');
});

// Update opacity value displays
document.getElementById('background-opacity').addEventListener('input', (e) => {
    document.getElementById('bg-opacity-value').textContent = e.target.value;
});

document.getElementById('bar-opacity').addEventListener('input', (e) => {
    document.getElementById('bar-opacity-value').textContent = e.target.value;
});

// Load from URL if present
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    const isViewOnly = !!encodedConfig;
    if (isViewOnly) {
        document.body.classList.add('view-only');
        const loadedConfig = deserializeConfig(encodedConfig);
        if (loadedConfig) {
            chartConfig = loadedConfig;
            renderChart(chartConfig, true);
        }
    } else {
        populateInputsFromConfig(chartConfig);
        renderChart(chartConfig, false);
    }
}

// Tutorial Modal Logic
const modal = document.getElementById('tutorial-modal');
const btn = document.getElementById('show-tutorial');
const span = document.getElementById('close-tutorial');

btn.addEventListener('click', () => {
    modal.style.display = 'block';
});

span.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

window.onload = init;