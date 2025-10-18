// XR Work Instructions Application
class XRInstructionsApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.xrSession = null;
        this.referenceSpace = null;
        this.instructionMesh = null;
        this.currentStep = 0;
        
        // Sample work instructions
        this.instructions = [
            {
                title: "Step 1: Safety Check",
                text: "Put on safety glasses and gloves before proceeding"
            },
            {
                title: "Step 2: Locate Components",
                text: "Identify the main assembly unit and verify all parts are present"
            },
            {
                title: "Step 3: Connect Base",
                text: "Attach the base unit to the mounting bracket using 4 screws"
            },
            {
                title: "Step 4: Install Module",
                text: "Insert the control module into the base unit until it clicks"
            },
            {
                title: "Step 5: Power Connection",
                text: "Connect the power cable to the designated port (marked in red)"
            },
            {
                title: "Step 6: Verification",
                text: "Check all connections and ensure LED indicator shows green"
            }
        ];
        
        this.init();
    }
    
    init() {
        // Check WebXR support
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    this.setupXRButton();
                    this.updateStatus('WebXR AR supported');
                } else {
                    this.updateStatus('WebXR AR not supported on this device');
                }
            });
        } else {
            this.updateStatus('WebXR not available');
        }
        
        // Setup Three.js
        this.setupThreeJS();
        
        // Setup UI controls
        this.setupControls();
        
        // Display first instruction
        this.updateInstruction();
    }
    
    setupThreeJS() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Create renderer with XR enabled
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('xr-canvas'),
            alpha: true,
            antialias: true
        });
        this.renderer.xr.enabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Add lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 1, 1);
        this.scene.add(light);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    setupXRButton() {
        const xrButton = document.getElementById('xr-button');
        xrButton.disabled = false;
        xrButton.addEventListener('click', () => {
            if (!this.xrSession) {
                this.startXRSession();
            } else {
                this.endXRSession();
            }
        });
    }
    
    async startXRSession() {
        try {
            // Request AR session with dom-overlay for better UI
            const sessionInit = {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.getElementById('app-container') }
            };
            
            this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
            
            // Setup XR session
            await this.renderer.xr.setSession(this.xrSession);
            
            // Get reference space
            this.referenceSpace = await this.xrSession.requestReferenceSpace('local-floor');
            
            // Update UI
            document.getElementById('xr-button').textContent = 'Exit XR';
            this.updateStatus('In XR Session');
            
            // Create 3D instruction panel
            this.create3DInstructions();
            
            // Start render loop
            this.renderer.setAnimationLoop((time, frame) => {
                this.render(time, frame);
            });
            
            // Handle session end
            this.xrSession.addEventListener('end', () => {
                this.xrSession = null;
                document.getElementById('xr-button').textContent = 'Enter XR';
                this.updateStatus('XR Session ended');
                this.renderer.setAnimationLoop(null);
                
                // Remove 3D instructions
                if (this.instructionMesh) {
                    this.scene.remove(this.instructionMesh);
                    this.instructionMesh = null;
                }
            });
            
        } catch (error) {
            console.error('Failed to start XR session:', error);
            this.updateStatus('Failed to start XR: ' + error.message);
        }
    }
    
    endXRSession() {
        if (this.xrSession) {
            this.xrSession.end();
        }
    }
    
    create3DInstructions() {
        // Create a panel for instructions
        const geometry = new THREE.PlaneGeometry(1, 0.5);
        const material = new THREE.MeshBasicMaterial({
            color: 0x1a1a1a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        
        this.instructionMesh = new THREE.Mesh(geometry, material);
        
        // Position the panel in front of the user
        this.instructionMesh.position.set(0, 1.5, -2);
        
        // Add text (using canvas texture for simplicity)
        this.updateInstructionTexture();
        
        this.scene.add(this.instructionMesh);
        
        // Add navigation buttons as 3D objects
        this.create3DButtons();
    }
    
    updateInstructionTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(this.instructions[this.currentStep].title, 20, 40);
        
        // Text
        ctx.font = '18px Arial';
        const words = this.instructions[this.currentStep].text.split(' ');
        let line = '';
        let y = 80;
        const lineHeight = 25;
        const maxWidth = canvas.width - 40;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, 20, y);
                line = words[i] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 20, y);
        
        // Step indicator
        ctx.font = '16px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`Step ${this.currentStep + 1} of ${this.instructions.length}`, 20, canvas.height - 20);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Update material
        this.instructionMesh.material.map = texture;
        this.instructionMesh.material.needsUpdate = true;
    }
    
    create3DButtons() {
        // Previous button
        const prevGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.05);
        const prevMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
        const prevButton = new THREE.Mesh(prevGeometry, prevMaterial);
        prevButton.position.set(-0.4, 1.1, -2);
        prevButton.name = 'prev-button';
        this.scene.add(prevButton);
        
        // Next button
        const nextGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.05);
        const nextMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const nextButton = new THREE.Mesh(nextGeometry, nextMaterial);
        nextButton.position.set(0.4, 1.1, -2);
        nextButton.name = 'next-button';
        this.scene.add(nextButton);
    }
    
    render(time, frame) {
        if (frame) {
            // Get viewer pose
            const pose = frame.getViewerPose(this.referenceSpace);
            if (pose) {
                // Update camera position based on XR pose
                const view = pose.views[0];
                const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
                this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
                
                this.camera.matrix.fromArray(view.transform.matrix);
                this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                this.camera.updateMatrixWorld(true);
                
                // Handle input sources for interaction
                const inputSources = frame.session.inputSources;
                inputSources.forEach(inputSource => {
                    if (inputSource.gamepad && inputSource.gamepad.buttons[0].pressed) {
                        // Simple interaction - could be improved with raycasting
                        this.handleXRInput(inputSource, frame);
                    }
                });
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    handleXRInput(inputSource, frame) {
        // This is a simplified interaction handler
        // In a real application, you'd implement proper raycasting
        console.log('XR input detected');
    }
    
    setupControls() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        prevBtn.addEventListener('click', () => {
            if (this.currentStep > 0) {
                this.currentStep--;
                this.updateInstruction();
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (this.currentStep < this.instructions.length - 1) {
                this.currentStep++;
                this.updateInstruction();
            }
        });
    }
    
    updateInstruction() {
        // Update 2D UI
        document.getElementById('instruction-title').textContent = this.instructions[this.currentStep].title;
        document.getElementById('instruction-text').textContent = this.instructions[this.currentStep].text;
        document.getElementById('step-indicator').textContent = `Step ${this.currentStep + 1} of ${this.instructions.length}`;
        
        // Update button states
        document.getElementById('prev-btn').disabled = this.currentStep === 0;
        document.getElementById('next-btn').disabled = this.currentStep === this.instructions.length - 1;
        
        // Update 3D instruction if in XR
        if (this.instructionMesh) {
            this.updateInstructionTexture();
        }
    }
    
    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new XRInstructionsApp();
});