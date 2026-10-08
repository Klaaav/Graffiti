import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Play, Square, Upload, AlertTriangle, Info, Image as ImageIcon, RotateCcw, Move, ZoomIn } from 'lucide-react';
import { importWebAsset, startWebWallpaper, stopWebWallpaper } from '../ipc';
import { saveActiveSession } from '../store';
import PreviewCanvas from './PreviewCanvas';

export default function WebWallpaper() {
    const [modelPath, setModelPath] = useState<string | null>(null);
    const [bgType, setBgType] = useState<'color' | 'image'>('color');
    const [bgColor, setBgColor] = useState<string>('#1a1a2e');
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [rotationFactor, setRotationFactor] = useState<number>(0.2);
    const [zoomFactor, setZoomFactor] = useState<number>(1.0);
    const [offsetX, setOffsetX] = useState<number>(0.0);
    const [offsetY, setOffsetY] = useState<number>(0.0);
    const [initialRotationX, setInitialRotationX] = useState<number>(0.0);
    const [initialRotationY, setInitialRotationY] = useState<number>(0.0);
    const [enableVerticalRotation, setEnableVerticalRotation] = useState<boolean>(true);

    const handleRotationUpdate = (rotX: number, rotY: number) => {
        setInitialRotationX(rotX);
        setInitialRotationY(rotY);
    };

    const handleImportModel = async () => {
        const selected = await open({
            filters: [{ name: '3D Models', extensions: ['glb'] }],
            multiple: false,
        });
        if (typeof selected === 'string') {
            try {
                const importedPath = await importWebAsset(selected);
                setModelPath(importedPath);
            } catch (e) {
                console.error("Failed to import model:", e);
                alert("Failed to import model");
            }
        }
    };

    const handleImportBg = async () => {
        const selected = await open({
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
            multiple: false,
        });
        if (typeof selected === 'string') {
            try {
                const importedPath = await importWebAsset(selected);
                setBgImage(importedPath);
                setBgType('image');
            } catch (e) {
                console.error("Failed to import background image:", e);
                alert("Failed to import image: " + e);
            }
        }
    };

    const handleApply = async () => {
        if (!modelPath) {
            alert("Please select a 3D model first.");
            return;
        }
        setIsLoading(true);
        try {
            await startWebWallpaper(
                modelPath,
                bgType,
                bgColor,
                bgImage || undefined,
                rotationFactor,
                zoomFactor,
                offsetX,
                offsetY,
                enableVerticalRotation,
                initialRotationX,
                initialRotationY
            );
            await saveActiveSession({ effect: 'web-wallpaper', layerA: '', layerB: '' });
        } catch (e) {
            console.error("Failed to start Web Wallpaper:", e);
            alert("Failed to start Web Wallpaper: " + e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        try {
            await stopWebWallpaper();
        } catch (e) {
            console.error("Failed to stop Web Wallpaper:", e);
        } finally {
            await saveActiveSession(null);
        }
    };

    return (
        <div className="web3d-layout">
            <div className="web3d-sidebar">
                <div className="page-header" style={{ marginBottom: '20px' }}>
                    <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        3D Wallpapers
                        <span className="web3d-badge">Beta</span>
                    </h2>
                </div>

                <div className="web3d-section animate-fade-in">
                    <div className="section-label">Model</div>
                    <button
                        className={`web3d-import-btn ${modelPath ? 'has-file' : ''}`}
                        onClick={handleImportModel}
                        disabled={isLoading}
                    >
                        <Upload size={16} />
                        <span>{modelPath ? modelPath.split('\\').pop() : 'Select .glb model'}</span>
                    </button>
                </div>

                <div className="web3d-section animate-fade-in" style={{ animationDelay: '0.05s' }}>
                    <div className="section-label">Background</div>
                    <div className="chip-group" style={{ marginBottom: '10px' }}>
                        <button className={bgType === 'color' ? 'active' : ''} onClick={() => setBgType('color')}>Color</button>
                        <button className={bgType === 'image' ? 'active' : ''} onClick={() => setBgType('image')}>Image</button>
                    </div>
                    {bgType === 'color' ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="color"
                                value={bgColor}
                                onChange={(e) => setBgColor(e.target.value)}
                                disabled={isLoading}
                                style={{ width: '36px', height: '28px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent' }}
                            />
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{bgColor}</span>
                        </div>
                    ) : (
                        <button
                            className={`web3d-import-btn ${bgImage ? 'has-file' : ''}`}
                            onClick={handleImportBg}
                            disabled={isLoading}
                        >
                            <ImageIcon size={16} />
                            <span>{bgImage ? bgImage.split('\\').pop() : 'Select background'}</span>
                        </button>
                    )}
                </div>

                <div className="web3d-section animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="section-label">Transform</div>
                    <div className="web3d-slider-row">
                        <ZoomIn size={14} className="web3d-slider-icon" />
                        <div className="control-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Zoom ({zoomFactor.toFixed(1)}x)</label>
                            <input type="range" min="0.1" max="5.0" step="0.1" value={zoomFactor} onChange={e => setZoomFactor(parseFloat(e.target.value))} />
                        </div>
                    </div>
                    <div className="web3d-slider-row">
                        <Move size={14} className="web3d-slider-icon" />
                        <div className="control-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>H. Offset ({offsetX.toFixed(2)})</label>
                            <input type="range" min="-2.0" max="2.0" step="0.05" value={offsetX} onChange={e => setOffsetX(parseFloat(e.target.value))} />
                        </div>
                    </div>
                    <div className="web3d-slider-row">
                        <Move size={14} className="web3d-slider-icon" style={{ transform: 'rotate(90deg)' }} />
                        <div className="control-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>V. Offset ({offsetY.toFixed(2)})</label>
                            <input type="range" min="-2.0" max="2.0" step="0.05" value={offsetY} onChange={e => setOffsetY(parseFloat(e.target.value))} />
                        </div>
                    </div>
                    <div className="web3d-slider-row">
                        <RotateCcw size={14} className="web3d-slider-icon" />
                        <div className="control-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Sensitivity ({rotationFactor.toFixed(1)}x)</label>
                            <input type="range" min="0" max="2" step="0.1" value={rotationFactor} onChange={e => setRotationFactor(parseFloat(e.target.value))} />
                        </div>
                    </div>
                    <div className="web3d-toggle-row">
                        <span>Vertical rotation</span>
                        <button
                            className={`toggle ${enableVerticalRotation ? 'on' : 'off'}`}
                            onClick={() => setEnableVerticalRotation(!enableVerticalRotation)}
                            style={{ padding: '4px 12px', fontSize: '0.75rem', minWidth: '48px' }}
                        >
                            {enableVerticalRotation ? 'On' : 'Off'}
                        </button>
                    </div>
                </div>

                <div className="web3d-warning animate-fade-in" style={{ animationDelay: '0.15s' }}>
                    <AlertTriangle size={14} />
                    <span>Uses ~250-350MB RAM via WebView2</span>
                </div>
            </div>

            <div className="web3d-preview">
                <PreviewCanvas
                    modelPath={modelPath}
                    bgType={bgType}
                    bgColor={bgColor}
                    bgImage={bgImage}
                    enableVerticalRotation={enableVerticalRotation}
                    rotationFactor={rotationFactor}
                    zoomFactor={zoomFactor}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    onRotationUpdate={handleRotationUpdate}
                />

                <div className="web3d-action-bar">
                    <button
                        className="web3d-apply-btn"
                        onClick={handleApply}
                        disabled={!modelPath || isLoading}
                    >
                        {isLoading ? (
                            <><span className="spinner" /> Loading</>
                        ) : (
                            <><Play size={16} /> Apply</>
                        )}
                    </button>
                    <button className="web3d-stop-btn" onClick={handleStop}>
                        <Square size={16} /> Stop
                    </button>
                </div>

                {!modelPath && (
                    <div className="web3d-empty-state">
                        <Upload size={28} />
                        <p>Import a .glb model to preview</p>
                    </div>
                )}

                <div className="web3d-hint">
                    <Info size={12} />
                    <span>Web wallpapers will stop any active native effects</span>
                </div>
            </div>
        </div>
    );
}
