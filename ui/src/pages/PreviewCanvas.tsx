import React, { Suspense, useEffect, useRef, useState, useCallback, Component } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';

interface PreviewCanvasProps {
    modelPath: string | null;
    bgType: 'color' | 'image';
    bgColor: string;
    bgImage: string | null;
    enableVerticalRotation: boolean;
    rotationFactor: number;
    zoomFactor: number;
    offsetX: number;
    offsetY: number;
    onRotationUpdate?: (initialRotationX: number, initialRotationY: number) => void;
    style?: React.CSSProperties;
    className?: string;
}

function safeAssetUrl(path: string | null): string {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('data:') || path.startsWith('/')) {
        return path;
    }
    try {
        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
            return convertFileSrc(path);
        }
    } catch {
        // Fallback in browser
    }
    return path;
}

class ModelErrorBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err: any) {
        console.warn('3D Model failed to render:', err);
    }
    componentDidUpdate(prevProps: { children: React.ReactNode }) {
        if (prevProps.children !== this.props.children && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

function Model({ url, onModelLoaded }: { url: string; onModelLoaded: (size: number, center: THREE.Vector3) => void }) {
    const assetUrl = safeAssetUrl(url);
    const { scene } = useGLTF(assetUrl);

    useEffect(() => {
        if (scene) {
            const box = new THREE.Box3().setFromObject(scene);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());
            onModelLoaded(size, center);
        }
    }, [scene, onModelLoaded]);

    return <primitive object={scene} />;
}

function SceneSetup({ bgType, bgColor, bgImage }: { bgType: 'color' | 'image'; bgColor: string; bgImage: string | null }) {
    const { scene } = useThree();

    useEffect(() => {
        if (bgType === 'color') {
            scene.background = new THREE.Color(bgColor || '#111311');
        } else if (bgType === 'image' && bgImage) {
            const assetUrl = safeAssetUrl(bgImage);
            const loader = new THREE.TextureLoader();
            loader.load(
                assetUrl,
                (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    scene.background = tex;
                },
                undefined,
                () => {
                    scene.background = new THREE.Color(bgColor || '#111311');
                }
            );
        } else {
            scene.background = new THREE.Color(bgColor || '#111311');
        }
    }, [bgType, bgColor, bgImage, scene]);

    return null;
}

function CameraControls({
    onRotationUpdate,
    modelSize,
    modelCenter,
    zoomFactor,
    offsetX,
    offsetY,
    rotationFactor,
    enableVerticalRotation,
}: {
    onRotationUpdate?: (rx: number, ry: number) => void;
    modelSize: number;
    modelCenter: THREE.Vector3 | null;
    zoomFactor: number;
    offsetX: number;
    offsetY: number;
    rotationFactor: number;
    enableVerticalRotation: boolean;
}) {
    const { camera, scene, gl } = useThree();
    const targetRot = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (modelSize > 0 && modelCenter) {
            camera.near = modelSize / 100;
            camera.far = modelSize * 100;
            camera.updateProjectionMatrix();

            const xOffsetVal = offsetX * modelSize * 0.5;
            const yOffsetVal = offsetY * modelSize * 0.5;

            camera.position.copy(modelCenter);
            camera.position.x -= xOffsetVal;
            camera.position.y -= yOffsetVal;
            camera.position.z += modelSize * (1.0 / (zoomFactor || 1.0));

            const target = modelCenter.clone();
            target.x -= xOffsetVal;
            target.y -= yOffsetVal;
            camera.lookAt(target);
        }
    }, [modelSize, modelCenter, camera, zoomFactor, offsetX, offsetY]);

    useEffect(() => {
        const dom = gl.domElement;
        let isDragging = false;
        let prevMouse = { x: 0, y: 0 };

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 0) {
                isDragging = true;
                prevMouse = { x: e.clientX, y: e.clientY };
                dom.setPointerCapture(e.pointerId);
            }
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (isDragging) {
                const deltaX = e.clientX - prevMouse.x;
                const deltaY = e.clientY - prevMouse.y;

                targetRot.current.y += deltaX * 0.01 * rotationFactor;
                if (enableVerticalRotation) {
                    targetRot.current.x += deltaY * 0.01 * rotationFactor;
                }

                scene.children.forEach(child => {
                    if (child.type === 'Group' || child.type === 'Scene') {
                        child.rotation.x = targetRot.current.x;
                        child.rotation.y = targetRot.current.y;
                    }
                });

                prevMouse = { x: e.clientX, y: e.clientY };
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (e.button === 0) {
                if (isDragging && onRotationUpdate) {
                    onRotationUpdate(targetRot.current.x, targetRot.current.y);
                }
                isDragging = false;
                try {
                    dom.releasePointerCapture(e.pointerId);
                } catch {
                    // Ignore release error if capture was lost
                }
            }
        };

        dom.addEventListener('pointerdown', handlePointerDown);
        dom.addEventListener('pointermove', handlePointerMove);
        dom.addEventListener('pointerup', handlePointerUp);
        dom.addEventListener('pointercancel', handlePointerUp);

        return () => {
            dom.removeEventListener('pointerdown', handlePointerDown);
            dom.removeEventListener('pointermove', handlePointerMove);
            dom.removeEventListener('pointerup', handlePointerUp);
            dom.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [gl, rotationFactor, enableVerticalRotation, scene, onRotationUpdate]);

    return null;
}

export default function PreviewCanvas({
    modelPath,
    bgType,
    bgColor,
    bgImage,
    zoomFactor,
    offsetX,
    offsetY,
    onRotationUpdate,
    enableVerticalRotation = true,
    rotationFactor = 0.2,
    style,
    className,
}: PreviewCanvasProps) {
    const [modelSize, setModelSize] = useState(0);
    const [modelCenter, setModelCenter] = useState<THREE.Vector3 | null>(null);

    const handleModelLoaded = useCallback((size: number, center: THREE.Vector3) => {
        setModelSize(size);
        setModelCenter(center);
    }, []);

    return (
        <div
            className={className}
            style={{
                width: '100%',
                height: '100%',
                minHeight: '360px',
                borderRadius: '22px',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: bgType === 'color' ? bgColor : '#111311',
                boxShadow: 'inset 0 0 0 1px var(--border-soft)',
                ...style,
            }}
        >
            <Canvas camera={{ position: [0, 0, 3], fov: 60 }}>
                <ambientLight intensity={0.9} />
                <directionalLight position={[5, 8, 5]} intensity={1.5} />
                <directionalLight position={[-5, -4, -3]} intensity={0.5} />
                <SceneSetup bgType={bgType} bgColor={bgColor} bgImage={bgImage} />

                <ModelErrorBoundary fallback={null}>
                    <Suspense fallback={null}>
                        {modelPath && <Model key={modelPath} url={modelPath} onModelLoaded={handleModelLoaded} />}
                    </Suspense>
                </ModelErrorBoundary>

                <CameraControls
                    onRotationUpdate={onRotationUpdate}
                    modelSize={modelSize}
                    modelCenter={modelCenter}
                    zoomFactor={zoomFactor}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    rotationFactor={rotationFactor}
                    enableVerticalRotation={enableVerticalRotation}
                />
            </Canvas>

            {/* Hint Badge */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    backgroundColor: 'rgba(17, 19, 17, 0.85)',
                    backdropFilter: 'blur(6px)',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    color: '#f4f6f4',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--highlight)' }} />
                <span>Drag to Orbit · Scroll to Zoom</span>
            </div>

            {/* Empty State */}
            {!modelPath && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-dark)',
                        pointerEvents: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(2px)',
                    }}
                >
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                        No 3D Model Selected
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Import a .glb / .gltf file to preview
                    </p>
                </div>
            )}
        </div>
    );
}
