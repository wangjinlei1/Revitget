import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Main 3D Viewer Class
 * Handles Three.js initialization, rendering, and model loading.
 */
export class Viewer {
    /**
     * @param {HTMLElement} container - The DOM element to append the canvas to.
     * @param {Object} options - Configuration options.
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        this.mixers = []; // For animations
        
        this.init();
    }

    /**
     * Initialize Three.js scene, camera, renderer, and controls.
     */
    init() {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);

        // 2. Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(10, 10, 10);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 4. Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 500;

        // 5. Lights (Default fallback)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // 6. Events
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Start Loop
        this.animate();
    }

    /**
     * Load an environment map (HDR).
     * @param {string} url - Path to the HDR file.
     */
    loadEnvironment(url) {
        new RGBELoader()
            .load(url, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.background = texture;
                this.scene.environment = texture;
            });
    }

    /**
     * Load a GLTF/GLB model.
     * @param {string} url - Path to the model file.
     * @param {Function} onProgress - Callback for loading progress (0-100).
     * @param {Function} onError - Callback for errors.
     */
    loadModel(url, onProgress, onError) {
        const loader = new GLTFLoader();

        // Setup Draco
        const dracoLoader = new DRACOLoader();
        // Point to a CDN or local path for Draco decoders
        // Since we copied them to assets/lib/draco, we use that.
        // Assuming relative path from index.html
        dracoLoader.setDecoderPath('./assets/lib/draco/');
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            url,
            (gltf) => {
                const model = gltf.scene;
                this.scene.add(model);

                // Auto-center and scale
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                // Center model
                model.position.x += (model.position.x - center.x);
                model.position.y += (model.position.y - center.y);
                model.position.z += (model.position.z - center.z);

                // Adjust camera to fit
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = this.camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)); // rough est
                cameraZ *= 2.5; // Zoom out a bit
                
                this.camera.position.set(cameraZ, cameraZ / 2, cameraZ);
                this.camera.lookAt(0, 0, 0);
                this.controls.target.set(0, 0, 0);
                this.controls.update();

                // Handle animations if any
                if (gltf.animations && gltf.animations.length) {
                    const mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        mixer.clipAction(clip).play();
                    });
                    this.mixers.push(mixer);
                }

                // Call success callback (implicit via promise or just finish)
                if (onProgress) onProgress({ loaded: 100, total: 100 });
            },
            (xhr) => {
                if (onProgress) onProgress(xhr);
            },
            (error) => {
                console.error('An error occurred loading the model:', error);
                if (onError) onError(error);
            }
        );
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        
        if (this.mixers.length > 0) {
            this.mixers.forEach(mixer => mixer.update(delta));
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Toggle auto-rotation of the camera.
     */
    toggleAutoRotate() {
        this.controls.autoRotate = !this.controls.autoRotate;
    }
    
    /**
     * Reset camera view.
     */
    resetView() {
        this.controls.reset();
    }
}
