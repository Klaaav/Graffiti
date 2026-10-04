import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Box, Play, Square, Upload, AlertTriangle, Info, Image as ImageIcon, Loader2 } from 'lucide-react';
import { importWebAsset, startWebWallpaper, stopWebWallpaper } from '../ipc';
import { saveActiveSession } from '../store';
import PreviewCanvas from './PreviewCanvas';

export default function WebWallpaper() {
    const [modelPath, setModelPath] = useState<string | null>(null);
    const [bgType, setBgType] = useState<'color' | 'image'>('color');
    const [bgColor, setBgColor] = useState<string>('#1a1a2e');
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // New model adjustment states
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
        <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Box /> 3D Model Wallpapers <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--accent-color)', color: 'white', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>Beta</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Render interactive 3D models (.glb) directly on your desktop background using the web rendering engine.
                </p>
            </div>

            <div style={{
                backgroundColor: 'rgba(255, 170, 0, 0.1)',
                border: '1px solid rgba(255, 170, 0, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '2rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start'
            }}>
                <AlertTriangle color="#ffaa00" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                    <h3 style={{ color: '#ffaa00', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>High Resource Usage Warning</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        This mode uses a full web rendering engine (WebView2) to display 3D models. It typically uses
                        <strong> ~250-350MB of RAM</strong>, which is significantly heavier than Graffiti's standard native effects (~10-35MB).
                        It will automatically pause to save resources when your screen is locked, occluded, or on battery power.
                    </p>
                </div>
            </div>

            <div className="settings-section" style={{ marginBottom: '2rem', backgroundColor: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Configuration</h2>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>3D Model (.glb)</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button className="primary-btn" onClick={handleImportModel} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={16} /> Select Model
                        </button>
                        <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {modelPath ? modelPath.split('\\').pop() : 'No model selected'}
                        </span>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Background Type</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                checked={bgType === 'color'}
                                onChange={() => setBgType('color')}
                                disabled={isLoading}
                                style={{ accentColor: 'var(--accent-color)' }}
                            /> Solid Color
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                checked={bgType === 'image'}
                                onChange={() => setBgType('image')}
                                disabled={isLoading}
                                style={{ accentColor: 'var(--accent-color)' }}
                            /> Image
                        </label>
                    </div>
                </div>

                {bgType === 'color' && (
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Background Color</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <input
                                type="color"
                                value={bgColor}
                                onChange={(e) => setBgColor(e.target.value)}
                                disabled={isLoading}
                                style={{
                                    width: '50px',
                                    height: '30px',
                                    padding: '0',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    background: 'transparent'
                                }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>{bgColor}</span>
                        </div>
                    </div>
                )}

                {bgType === 'image' && (
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Background Image</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button className="secondary-btn" onClick={handleImportBg} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                                <ImageIcon size={16} /> Select Image
                            </button>
                            <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                {bgImage ? bgImage.split('\\').pop() : 'No image selected'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="settings-section" style={{ marginBottom: '2rem', backgroundColor: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Position & Rotation Preview</span>
                </h2>

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

                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Zoom <span>{zoomFactor.toFixed(2)}x</span>
                        </label>
                        <input
                            type="range"
                            min="0.1" max="5.0" step="0.1"
                            value={zoomFactor}
                            onChange={e => setZoomFactor(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Adjust the size of the 3D model.</span>
                    </div>
                    <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Horizontal Offset <span>{offsetX.toFixed(2)}</span>
                        </label>
                        <input
                            type="range"
                            min="-2.0" max="2.0" step="0.05"
                            value={offsetX}
                            onChange={e => setOffsetX(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Move the model left or right.</span>
                    </div>
                    <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Vertical Offset <span>{offsetY.toFixed(2)}</span>
                        </label>
                        <input
                            type="range"
                            min="-2.0" max="2.0" step="0.05"
                            value={offsetY}
                            onChange={e => setOffsetY(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Move the model up or down.</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Mouse Rotation Sensitivity <span>{rotationFactor.toFixed(2)}x</span>
                        </label>
                        <input
                            type="range"
                            min="0" max="2" step="0.1"
                            value={rotationFactor}
                            onChange={e => setRotationFactor(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>How much the wallpaper reacts to cursor movement.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <label style={{ fontWeight: 500, display: 'block' }}>Enable Vertical Mouse Rotation</label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allow the model to pitch up/down with the cursor.</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={enableVerticalRotation}
                            onChange={e => setEnableVerticalRotation(e.target.checked)}
                            style={{ accentColor: 'var(--accent-color)', width: '20px', height: '20px', marginTop: '2px' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    className="primary-btn"
                    onClick={handleApply}
                    disabled={!modelPath || isLoading}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        opacity: (!modelPath || isLoading) ? 0.5 : 1,
                        cursor: (!modelPath || isLoading) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Loading Engine...
                        </>
                    ) : (
                        <>
                            <Play size={20} /> Apply Web Wallpaper
                        </>
                    )}
                </button>
                <button
                    className="secondary-btn"
                    onClick={handleStop}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1rem 2rem',
                        fontSize: '1.1rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        borderRadius: '6px'
                    }}
                >
                    <Square size={20} /> Stop
                </button>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', alignItems: 'center' }}>
                <Info size={16} />
                <span>Note: Applying a Web Wallpaper will automatically stop any active native effects.</span>
            </div>
        </div>
    );
}
