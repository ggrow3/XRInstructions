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
        this.completedSteps = new Set(); // Track completed steps
        
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
        // Initialize drag functionality
        this.initDragFunctionality();
        
        // Initialize checklist
        this.initChecklist();
        
        // Load saved state
        this.loadChecklistState();
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
        
        // Completion indicator
        if (this.completedSteps.has(this.currentStep)) {
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('✓ Completed', canvas.width - 150, 40);
        } else {
            ctx.fillStyle = '#888888';
            ctx.font = '16px Arial';
            ctx.fillText('☐ Not completed', canvas.width - 150, 40);
        }
        
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
        
        // Update checkbox state for current step
        const checkbox = document.getElementById('current-step-checkbox');
        checkbox.checked = this.completedSteps.has(this.currentStep);
        
        // Update 3D instruction if in XR
        if (this.instructionMesh) {
            this.updateInstructionTexture();
        }
    }
    
    initDragFunctionality() {
        const draggableElement = document.getElementById('instructions-2d');
        const dragHandle = draggableElement.querySelector('.drag-handle');
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        // Set initial position (centered)
        const rect = draggableElement.getBoundingClientRect();
        const parentRect = draggableElement.parentElement.getBoundingClientRect();
        xOffset = (parentRect.width - rect.width) / 2;
        yOffset = 100; // Start 100px from top
        draggableElement.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        
        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            
            if (e.target === dragHandle || dragHandle.contains(e.target)) {
                isDragging = true;
            }
        }
        
        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                
                xOffset = currentX;
                yOffset = currentY;
                
                // Keep element within viewport bounds
                const rect = draggableElement.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                xOffset = Math.max(0, Math.min(xOffset, maxX));
                yOffset = Math.max(0, Math.min(yOffset, maxY));
                
                draggableElement.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
            }
        }
        
        // Mouse events
        dragHandle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        // Touch events
        dragHandle.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);
    }
    
    initChecklist() {
        // Initialize checklist summary
        this.updateChecklistSummary();
        
        // Add event listener for current step checkbox
        const checkbox = document.getElementById('current-step-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.completedSteps.add(this.currentStep);
            } else {
                this.completedSteps.delete(this.currentStep);
            }
            this.updateChecklistSummary();
            this.saveChecklistState();
        });
    }
    
    updateChecklistSummary() {
        const checklistItems = document.getElementById('checklist-items');
        checklistItems.innerHTML = '';
        
        this.instructions.forEach((instruction, index) => {
            const item = document.createElement('div');
            item.className = 'checklist-summary-item';
            if (this.completedSteps.has(index)) {
                item.classList.add('completed');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.completedSteps.has(index);
            checkbox.disabled = true;
            
            const label = document.createElement('span');
            label.textContent = instruction.title;
            
            item.appendChild(checkbox);
            item.appendChild(label);
            checklistItems.appendChild(item);
        });
    }
    
    saveChecklistState() {
        localStorage.setItem('xr-instructions-completed', JSON.stringify([...this.completedSteps]));
    }
    
    loadChecklistState() {
        const saved = localStorage.getItem('xr-instructions-completed');
        if (saved) {
            try {
                const completed = JSON.parse(saved);
                this.completedSteps = new Set(completed);
                this.updateChecklistSummary();
            } catch (e) {
                console.error('Failed to load saved checklist state:', e);
            }
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