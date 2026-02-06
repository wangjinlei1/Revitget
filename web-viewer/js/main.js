import { Viewer } from './Viewer.js';

// Configuration
const CONFIG = {
    modelPath: './assets/models/model.glb',
    envMapPath: './assets/env/hdr/rural_asphalt_road/rural_asphalt_road_1k.hdr', // Ensure this file exists or change to available one
    // Fallback if the specific HDR path structure is different, we might need to adjust.
};

// UI Elements
const ui = {
    loadingScreen: document.getElementById('loading-screen'),
    progressBar: document.getElementById('progress-bar'),
    loadingText: document.querySelector('.loading-text'),
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
    btnCloseError: document.getElementById('btn-close-error'),
    btnReset: document.getElementById('btn-reset'),
    btnRotate: document.getElementById('btn-rotate'),
};

// Initialize
async function main() {
    const container = document.getElementById('viewer-container');
    const viewer = new Viewer(container);

    // Load Environment
    // We try to find a valid HDR. If the specific one doesn't exist, it will just fail to load env map (console error) but scene works.
    // Based on file listing, we expect: assets/env/rural_asphalt_road/rural_asphalt_road_1k.hdr
    viewer.loadEnvironment(CONFIG.envMapPath);

    // Load Model
    loadModel(viewer);

    // Setup UI Events
    setupUI(viewer);
}

function loadModel(viewer) {
    ui.loadingScreen.classList.remove('fade-out');
    ui.progressBar.style.width = '0%';
    
    viewer.loadModel(
        CONFIG.modelPath,
        (xhr) => {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total) * 100;
                ui.progressBar.style.width = percent + '%';
                ui.loadingText.textContent = `Loading Model... ${Math.round(percent)}%`;
            } else {
                // If total is unknown, just show some activity or 100 when done
                if (xhr.loaded === 100 && xhr.total === 100) {
                     // Completion call
                     setTimeout(() => {
                        ui.loadingScreen.classList.add('fade-out');
                     }, 500);
                }
            }
        },
        (error) => {
            console.error(error);
            showError('Failed to load model. See console for details.');
            ui.loadingScreen.classList.add('fade-out');
        }
    );
}

function setupUI(viewer) {
    ui.btnReset.addEventListener('click', () => {
        viewer.resetView();
    });

    ui.btnRotate.addEventListener('click', () => {
        viewer.toggleAutoRotate();
        ui.btnRotate.classList.toggle('active');
    });

    ui.btnCloseError.addEventListener('click', () => {
        ui.errorToast.classList.add('hidden');
    });
}

function showError(msg) {
    ui.errorMessage.textContent = msg;
    ui.errorToast.classList.remove('hidden');
    setTimeout(() => {
        ui.errorToast.classList.add('hidden');
    }, 5000);
}

// Start
main();
