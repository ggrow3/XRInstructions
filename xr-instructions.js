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
        
        // Hand tracking properties
        this.hands = {
            left: { 
                inputSource: null, 
                mesh: null, 
                joints: {},
                pinching: false,
                lastPinchTime: 0
            },
            right: { 
                inputSource: null, 
                mesh: null, 
                joints: {},
                pinching: false,
                lastPinchTime: 0
            }
        };
        this.handModels = new Map();
        this.interactableObjects = [];
        this.grabbedObject = null;
        this.grabOffset = new THREE.Vector3();
        this.handRays = { left: null, right: null };
        
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
            // Request AR session with dom-overlay and hand tracking
            const sessionInit = {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['dom-overlay', 'hand-tracking'],
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
            
            // Initialize hand tracking if available
            this.initializeHandTracking();
            
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
                
                // Clean up hand tracking
                this.cleanupHandTracking();
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
        const prevMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x444444,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });
        const prevButton = new THREE.Mesh(prevGeometry, prevMaterial);
        prevButton.position.set(-0.4, 1.1, -2);
        prevButton.name = 'prev-button';
        this.scene.add(prevButton);
        
        // Next button
        const nextGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.05);
        const nextMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });
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
                    // Handle hand tracking
                    if (inputSource.hand) {
                        this.updateHandTracking(inputSource, frame);
                    }
                    // Handle controller input
                    else if (inputSource.gamepad && inputSource.gamepad.buttons[0].pressed) {
                        this.handleXRInput(inputSource, frame);
                    }
                });
                
                // Update hand interactions
                this.updateHandInteractions();
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
    
    // Hand tracking methods
    initializeHandTracking() {
        // Make instruction panel and buttons interactable
        if (this.instructionMesh) {
            this.interactableObjects.push(this.instructionMesh);
        }
        
        // Add buttons to interactable objects
        this.scene.traverse((child) => {
            if (child.name === 'prev-button' || child.name === 'next-button') {
                this.interactableObjects.push(child);
            }
        });
        
        // Create hand rays for pointing
        const rayGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -2)
        ]);
        const rayMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            linewidth: 2,
            transparent: true,
            opacity: 0.5
        });
        
        this.handRays.left = new THREE.Line(rayGeometry, rayMaterial);
        this.handRays.right = new THREE.Line(rayGeometry, rayMaterial);
        this.handRays.left.visible = false;
        this.handRays.right.visible = false;
        
        this.scene.add(this.handRays.left);
        this.scene.add(this.handRays.right);
    }
    
    updateHandTracking(inputSource, frame) {
        const handedness = inputSource.handedness;
        if (handedness !== 'left' && handedness !== 'right') return;
        
        const hand = this.hands[handedness];
        hand.inputSource = inputSource;
        
        // Create hand visualization if not exists
        if (!hand.mesh) {
            this.createHandMesh(handedness);
        }
        
        // Update joint positions
        if (inputSource.hand) {
            for (const jointSpace of inputSource.hand.values()) {
                const jointPose = frame.getJointPose(jointSpace, this.referenceSpace);
                if (jointPose) {
                    const jointName = jointSpace.jointName;
                    if (!hand.joints[jointName]) {
                        // Create joint sphere
                        const jointGeometry = new THREE.SphereGeometry(0.008);
                        const jointMaterial = new THREE.MeshBasicMaterial({ 
                            color: handedness === 'left' ? 0xff0000 : 0x0000ff 
                        });
                        hand.joints[jointName] = new THREE.Mesh(jointGeometry, jointMaterial);
                        this.scene.add(hand.joints[jointName]);
                    }
                    
                    // Update joint position
                    const position = jointPose.transform.position;
                    hand.joints[jointName].position.set(position.x, position.y, position.z);
                    hand.joints[jointName].visible = true;
                }
            }
            
            // Check for pinch gesture
            this.detectPinchGesture(handedness, frame);
        }
    }
    
    createHandMesh(handedness) {
        const hand = this.hands[handedness];
        
        // Create a simple hand visualization with lines connecting joints
        const material = new THREE.LineBasicMaterial({ 
            color: handedness === 'left' ? 0xff0000 : 0x0000ff,
            linewidth: 2
        });
        
        hand.mesh = new THREE.Group();
        this.scene.add(hand.mesh);
    }
    
    detectPinchGesture(handedness, frame) {
        const hand = this.hands[handedness];
        const inputSource = hand.inputSource;
        
        if (!inputSource.hand) return;
        
        // Get thumb tip and index finger tip positions
        let thumbTip = null;
        let indexTip = null;
        
        for (const [jointSpace, joint] of inputSource.hand) {
            const jointPose = frame.getJointPose(jointSpace, this.referenceSpace);
            if (jointPose) {
                if (jointSpace.jointName === 'thumb-tip') {
                    thumbTip = new THREE.Vector3(
                        jointPose.transform.position.x,
                        jointPose.transform.position.y,
                        jointPose.transform.position.z
                    );
                } else if (jointSpace.jointName === 'index-finger-tip') {
                    indexTip = new THREE.Vector3(
                        jointPose.transform.position.x,
                        jointPose.transform.position.y,
                        jointPose.transform.position.z
                    );
                }
            }
        }
        
        // Calculate pinch distance
        if (thumbTip && indexTip) {
            const pinchDistance = thumbTip.distanceTo(indexTip);
            const isPinching = pinchDistance < 0.02; // 2cm threshold
            
            // Handle pinch state changes
            if (isPinching && !hand.pinching) {
                hand.pinching = true;
                hand.lastPinchTime = Date.now();
                this.handlePinchStart(handedness, indexTip);
            } else if (!isPinching && hand.pinching) {
                hand.pinching = false;
                this.handlePinchEnd(handedness);
            } else if (isPinching && hand.pinching) {
                this.handlePinchMove(handedness, indexTip);
            }
            
            // Update ray visibility
            if (this.handRays[handedness]) {
                this.handRays[handedness].visible = isPinching || this.grabbedObject !== null;
                if (this.handRays[handedness].visible) {
                    this.updateHandRay(handedness, indexTip);
                }
            }
        }
    }
    
    updateHandRay(handedness, origin) {
        const ray = this.handRays[handedness];
        if (!ray) return;
        
        // Position ray at hand position
        ray.position.copy(origin);
        
        // Point ray forward from hand
        const direction = new THREE.Vector3(0, 0, -1);
        ray.lookAt(origin.clone().add(direction));
    }
    
    handlePinchStart(handedness, position) {
        // Cast ray from hand position
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3(0, 0, -1);
        raycaster.set(position, direction);
        
        // Check for intersections with interactable objects
        const intersects = raycaster.intersectObjects(this.interactableObjects);
        
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            
            // Check if it's a button
            if (intersected.name === 'prev-button' || intersected.name === 'next-button') {
                this.handleButtonPress(intersected.name);
            } 
            // Check if it's the instruction panel
            else if (intersected === this.instructionMesh) {
                this.grabbedObject = intersected;
                this.grabOffset = intersected.position.clone().sub(position);
            }
        }
    }
    
    handlePinchMove(handedness, position) {
        if (this.grabbedObject) {
            // Move the grabbed object with the hand
            this.grabbedObject.position.copy(position.clone().add(this.grabOffset));
        }
    }
    
    handlePinchEnd(handedness) {
        this.grabbedObject = null;
    }
    
    handleButtonPress(buttonName) {
        if (buttonName === 'prev-button' && this.currentStep > 0) {
            this.currentStep--;
            this.updateInstruction();
            this.animateButton(buttonName);
        } else if (buttonName === 'next-button' && this.currentStep < this.instructions.length - 1) {
            this.currentStep++;
            this.updateInstruction();
            this.animateButton(buttonName);
        }
    }
    
    animateButton(buttonName) {
        const button = this.scene.getObjectByName(buttonName);
        if (button) {
            // Simple scale animation
            const originalScale = button.scale.clone();
            button.scale.multiplyScalar(0.9);
            setTimeout(() => {
                button.scale.copy(originalScale);
            }, 100);
        }
    }
    
    updateHandInteractions() {
        // Update visual feedback for interactable objects
        this.interactableObjects.forEach(object => {
            if (object.material) {
                // Reset emissive color
                if (object.material.emissive) {
                    object.material.emissive = new THREE.Color(0x000000);
                }
            }
        });
        
        // Highlight objects being pointed at
        ['left', 'right'].forEach(handedness => {
            const hand = this.hands[handedness];
            if (hand.pinching && this.handRays[handedness].visible) {
                const raycaster = new THREE.Raycaster();
                const origin = this.handRays[handedness].position;
                const direction = new THREE.Vector3(0, 0, -1);
                raycaster.set(origin, direction);
                
                const intersects = raycaster.intersectObjects(this.interactableObjects);
                if (intersects.length > 0 && intersects[0].object.material) {
                    // Add glow effect to hovered object
                    if (intersects[0].object.material.emissive) {
                        intersects[0].object.material.emissive = new THREE.Color(0x444444);
                    }
                }
            }
        });
    }
    
    cleanupHandTracking() {
        // Remove hand joints and meshes
        ['left', 'right'].forEach(handedness => {
            const hand = this.hands[handedness];
            
            // Remove joints
            Object.values(hand.joints).forEach(joint => {
                if (joint) {
                    this.scene.remove(joint);
                }
            });
            hand.joints = {};
            
            // Remove hand mesh
            if (hand.mesh) {
                this.scene.remove(hand.mesh);
                hand.mesh = null;
            }
            
            // Remove hand ray
            if (this.handRays[handedness]) {
                this.scene.remove(this.handRays[handedness]);
                this.handRays[handedness] = null;
            }
            
            // Reset hand state
            hand.inputSource = null;
            hand.pinching = false;
        });
        
        // Clear interactable objects
        this.interactableObjects = [];
        this.grabbedObject = null;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new XRInstructionsApp();
});