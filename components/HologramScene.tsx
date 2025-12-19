import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { TelemetryData, InteractionMode } from '../types';

interface HologramSceneProps {
  onTelemetryUpdate: (data: TelemetryData) => void;
  onLoadingChange: (loading: boolean, msg?: string) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  backgroundColor: string;
}

// Global ref accessible to helper functions outside the component if strictly necessary, 
// but we will try to keep everything encapsulated.
const HologramScene: React.FC<HologramSceneProps> = ({ 
  onTelemetryUpdate, 
  onLoadingChange, 
  videoRef,
  backgroundColor 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  
  // State variables for the animation loop
  const stateRef = useRef({
    targetRotation: { x: 0, y: 0 },
    currentRotation: { x: 0, y: 0 },
    targetZoom: 5,
    currentZoom: 5,
    lastVideoTime: -1,
    lastHandPos: null as { x: number, y: number } | null,
    webcamRunning: false,
    mode: InteractionMode.IDLE,
    isMouseDragging: false,
    mousePos: { x: 0, y: 0 },
    frameCount: 0
  });

  // Expose upload function
  useEffect(() => {
    // Add a custom event listener for file uploads to bridge component separation
    const handleUploadEvent = (e: CustomEvent<File>) => {
      loadModel(e.detail);
    };
    window.addEventListener('hologram-upload' as any, handleUploadEvent as any);
    return () => window.removeEventListener('hologram-upload' as any, handleUploadEvent as any);
  }, []);

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
        // Update fog to match background for seamless depth
        sceneRef.current.fog = new THREE.FogExp2(new THREE.Color(backgroundColor), 0.02);
    }
    // Renderer clear color is handled by CSS on the body/canvas usually if alpha: true,
    // but we can enforce scene background if we want standard opaque rendering.
    // However, with alpha:true, the CSS background shines through.
  }, [backgroundColor]);


  // Initialize System
  useEffect(() => {
    if (!containerRef.current || !videoRef.current) return;

    let animationFrameId: number;

    const init = async () => {
      onLoadingChange(true, "INITIALIZING CORE SYSTEMS...");

      // --- THREE JS SETUP ---
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x000000, 0.02);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      containerRef.current?.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // --- LIGHTS ---
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 2);
      dirLight.position.set(5, 3, 5);
      scene.add(dirLight);

      // --- EARTH GROUP ---
      const earthGroup = new THREE.Group();
      scene.add(earthGroup);
      earthGroupRef.current = earthGroup;

      createDefaultEarth(earthGroup, scene);
      createStars(scene);

      // --- MEDIAPIPE SETUP ---
      onLoadingChange(true, "LOADING VISION MODEL...");
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        handLandmarkerRef.current = landmarker;
        
        // Start Webcam
        onLoadingChange(true, "CONNECTING OPTICAL SENSORS...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", () => {
                stateRef.current.webcamRunning = true;
                onLoadingChange(false);
                startAnimationLoop();
            });
        }
      } catch (err) {
        console.error("Camera/MediaPipe Error:", err);
        onLoadingChange(false);
        // Fallback to just 3D without hands
        startAnimationLoop();
      }

      // --- MOUSE EVENTS ---
      setupMouseControls(renderer.domElement);
      window.addEventListener('resize', handleResize);
    };

    const createDefaultEarth = (group: THREE.Group, scene: THREE.Scene) => {
        // Core Occlusion Sphere
        const sphereGeo = new THREE.SphereGeometry(1.5, 64, 64);
        const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const blackSphere = new THREE.Mesh(sphereGeo, blackMat);
        group.add(blackSphere);

        // Wireframe Hologram
        const wireframeMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        });
        const earthMesh = new THREE.Mesh(sphereGeo, wireframeMat);
        group.add(earthMesh);

        // Procedural Continents (Dots)
        const pointsGeo = new THREE.BufferGeometry();
        const count = 3500;
        const positions = [];
        const sph = new THREE.Spherical();
        const vec3 = new THREE.Vector3();

        for(let i=0; i<count; i++) {
            const phi = Math.acos( -1 + ( 2 * i ) / count );
            const theta = Math.sqrt( count * Math.PI ) * phi;
            // Simple noise-like grouping for "continents"
            if (Math.sin(phi*5) * Math.cos(theta*5) > -0.2) {
                sph.set(1.51, phi, theta);
                vec3.setFromSpherical(sph);
                positions.push(vec3.x, vec3.y, vec3.z);
            }
        }
        pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const pointsMat = new THREE.PointsMaterial({
            color: 0x0088ff,
            size: 0.02,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const continents = new THREE.Points(pointsGeo, pointsMat);
        group.add(continents);

        // Atmosphere Glow
        const atmoGeo = new THREE.SphereGeometry(1.7, 64, 64);
        const atmoMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
                    gl_FragColor = vec4(0.0, 0.8, 1.0, 1.0) * intensity * 1.5;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const atmo = new THREE.Mesh(atmoGeo, atmoMat);
        scene.add(atmo);
        atmosphereRef.current = atmo;
    };

    const createStars = (scene: THREE.Scene) => {
        const starsGeo = new THREE.BufferGeometry();
        const starPos = [];
        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 200;
            const y = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            starPos.push(x, y, z);
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.8 });
        const stars = new THREE.Points(starsGeo, starsMat);
        scene.add(stars);
        starsRef.current = stars;
    };

    const setupMouseControls = (dom: HTMLCanvasElement) => {
        const handleMouseDown = (e: MouseEvent) => {
            stateRef.current.isMouseDragging = true;
            stateRef.current.mousePos = { x: e.clientX, y: e.clientY };
            stateRef.current.mode = InteractionMode.MOUSE;
            dom.style.cursor = 'grabbing';
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (stateRef.current.isMouseDragging) {
                const deltaX = e.clientX - stateRef.current.mousePos.x;
                const deltaY = e.clientY - stateRef.current.mousePos.y;
                const sensitivity = 0.005;
                
                stateRef.current.targetRotation.y += deltaX * sensitivity;
                stateRef.current.targetRotation.x += deltaY * sensitivity;
                stateRef.current.mousePos = { x: e.clientX, y: e.clientY };
            }
        };
        const handleMouseUp = () => {
            stateRef.current.isMouseDragging = false;
            dom.style.cursor = 'default';
        };
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomSensitivity = 0.005;
            stateRef.current.targetZoom += e.deltaY * zoomSensitivity;
            stateRef.current.targetZoom = Math.max(2.5, Math.min(15, stateRef.current.targetZoom));
            stateRef.current.mode = e.deltaY < 0 ? InteractionMode.ZOOM_IN : InteractionMode.ZOOM_OUT;
            
            // Reset mode text after delay
            setTimeout(() => {
                if (!stateRef.current.isMouseDragging) stateRef.current.mode = InteractionMode.IDLE;
            }, 1000);
        };

        dom.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        dom.addEventListener('wheel', handleWheel, { passive: false });
    };

    const startAnimationLoop = () => {
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const state = stateRef.current;
            const now = Date.now();

            // --- VISION PROCESSING ---
            let results: HandLandmarkerResult | undefined;
            if (state.webcamRunning && handLandmarkerRef.current && videoRef.current) {
                if (videoRef.current.currentTime !== state.lastVideoTime) {
                    state.lastVideoTime = videoRef.current.currentTime;
                    results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
                }
            }

            // --- LOGIC ---
            if (results && results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                const cx = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
                const cy = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3;

                // Rotation (Drag)
                if (state.lastHandPos) {
                    const deltaX = cx - state.lastHandPos.x;
                    const deltaY = cy - state.lastHandPos.y;
                    const sensitivity = 5.0;
                    state.targetRotation.y -= deltaX * sensitivity;
                    state.targetRotation.x += deltaY * sensitivity;
                }
                state.lastHandPos = { x: cx, y: cy };

                // Zoom (Pinch)
                const thumb = landmarks[4];
                const index = landmarks[8];
                const dist = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));

                if (dist < 0.05) {
                    state.mode = InteractionMode.ZOOM_IN;
                    state.targetZoom = Math.max(2.5, state.targetZoom - 0.1);
                } else if (dist > 0.2) {
                    state.mode = InteractionMode.ZOOM_OUT;
                    state.targetZoom = Math.min(10, state.targetZoom + 0.1);
                } else {
                    state.mode = InteractionMode.ROTATING;
                }
            } else {
                state.lastHandPos = null;
                if (!state.isMouseDragging) {
                    state.mode = InteractionMode.IDLE;
                    state.targetRotation.y += 0.002; // Auto-rotate
                }
            }

            // --- INTERPOLATION ---
            if (earthGroupRef.current) {
                const earth = earthGroupRef.current;
                earth.rotation.y += (state.targetRotation.y - earth.rotation.y) * 0.1;
                earth.rotation.x += (state.targetRotation.x - earth.rotation.x) * 0.1;
                
                state.currentZoom += (state.targetZoom - state.currentZoom) * 0.1;
                if (cameraRef.current) {
                    cameraRef.current.position.z = state.currentZoom;
                }
            }

            // --- VISUALS ---
            if (atmosphereRef.current) atmosphereRef.current.rotation.y -= 0.002;
            if (starsRef.current) starsRef.current.rotation.y += 0.0005;

            // --- RENDER ---
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }

            // --- UI UPDATE THROTTLE ---
            state.frameCount++;
            if (state.frameCount % 5 === 0) { // Update UI every 5 frames (~12fps)
                onTelemetryUpdate({
                    rotationSpeed: earthGroupRef.current ? (earthGroupRef.current.rotation.y * 10).toFixed(1) + " UNIT" : "0.0",
                    zoomLevel: (10 - state.currentZoom).toFixed(1) + "x",
                    mode: state.mode,
                    handDetected: !!(results && results.landmarks.length > 0)
                });
            }
        };
        animate();
    };

    const handleResize = () => {
        if (!cameraRef.current || !rendererRef.current) return;
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    init();

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current && containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
        }
        if (stateRef.current.webcamRunning && videoRef.current && videoRef.current.srcObject) {
             const stream = videoRef.current.srcObject as MediaStream;
             stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []); // Run once on mount

  // Helper to load models
  const loadModel = (file: File) => {
    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    
    // Simple visual feedback in HUD handled by parent usually, but we can do logic here
    
    loader.load(url, (gltf) => {
        const model = gltf.scene;
        const group = earthGroupRef.current;
        const scene = sceneRef.current;
        
        if (!group || !scene) return;

        // Remove atmosphere for custom models
        if (atmosphereRef.current) {
            scene.remove(atmosphereRef.current);
            atmosphereRef.current = null;
        }

        // clear previous
        while(group.children.length > 0){ 
            group.remove(group.children[0]); 
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        model.position.sub(center); // center it
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3.0 / maxDim;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Apply Hologram Shader/Material
        const meshes: THREE.Mesh[] = [];
        model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
        });

        meshes.forEach(child => {
            const geo = child.geometry;
            child.material = new THREE.MeshBasicMaterial({
                color: 0x000510,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
            
            const wireframe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                wireframe: true,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            }));
            child.add(wireframe);
        });

        group.add(model);
        URL.revokeObjectURL(url);
    });
  };

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

export default HologramScene;