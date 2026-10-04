import React, { Suspense, useEffect, useRef } from 'react';
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
    onRotationUpdate: (initialRotationX: number, initialRotationY: number) => void;
}

function Model({ url, onModelLoaded }: { url: string, onModelLoaded: (size: number, center: THREE.Vector3) => void }) {
    const assetUrl = convertFileSrc(url);
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

function SceneSetup({ bgType, bgColor, bgImage }: { bgType: 'color' | 'image', bgColor: string, bgImage: string | null }) {
    const { scene } = useThree();

    useEffect(() => {
        if (bgType === 'color') {
            scene.background = new THREE.Color(bgColor);
        } else if (bgType === 'image' && bgImage) {
            const assetUrl = convertFileSrc(bgImage);
            new THREE.TextureLoader().load(assetUrl, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                scene.background = tex;
            });
        }
    }, [bgType, bgColor, bgImage, scene]);

    return null;
}

function CameraControls({ onRotationUpdate, modelSize, modelCenter, zoomFactor, offsetX, offsetY, rotationFactor, enableVerticalRotation }: {
    onRotationUpdate: PreviewCanvasProps['onRotationUpdate'],
    modelSize: number,
    modelCenter: THREE.Vector3 | null,
    zoomFactor: number,
    offsetX: number,
    offsetY: number,
    rotationFactor: number,
    enableVerticalRotation: boolean
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
            camera.position.z += modelSize * (1.0 / zoomFactor);

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

                // Apply rotation directly to the scene children (our model)
                // We rotate around the world origin (0,0,0) just like the backend does.
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
                if (isDragging) {
                    onRotationUpdate(targetRot.current.x, targetRot.current.y);
                }
                isDragging = false;
                dom.releasePointerCapture(e.pointerId);
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

export default function PreviewCanvas({ modelPath, bgType, bgColor, bgImage, zoomFactor, offsetX, offsetY, onRotationUpdate, enableVerticalRotation, rotationFactor }: PreviewCanvasProps) {
    const [modelSize, setModelSize] = React.useState(0);
    const [modelCenter, setModelCenter] = React.useState<THREE.Vector3 | null>(null);

    const handleModelLoaded = React.useCallback((size: number, center: THREE.Vector3) => {
        setModelSize(size);
        setModelCenter(center);
    }, []);

    return (
        <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', backgroundColor: '#000', marginBottom: '1.5rem' }}>
            <Canvas camera={{ position: [0, 0, 3], fov: 75 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[0, 0, 1]} intensity={1.2} />
                <SceneSetup bgType={bgType} bgColor={bgColor} bgImage={bgImage} />

                <Suspense fallback={null}>
                    {modelPath && <Model url={modelPath} onModelLoaded={handleModelLoaded} />}
                </Suspense>

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

            <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: '4px', color: '#fff', fontSize: '12px', pointerEvents: 'none' }}>
                <strong>Left Click:</strong> Rotate
            </div>

            {!modelPath && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
                    Select a 3D model to preview
                </div>
            )}
        </div>
    );
}
