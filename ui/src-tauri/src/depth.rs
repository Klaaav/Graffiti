use image::{imageops::FilterType, Luma};
use imageproc::filter::gaussian_blur_f32;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use std::fs;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static ONNX_INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();
static DEPTH_SESSION: OnceLock<Mutex<Option<Session>>> = OnceLock::new();

const INFERENCE_SIZE: u32 = 518;
const INFERENCE_PIXELS: usize = (INFERENCE_SIZE as usize) * (INFERENCE_SIZE as usize);
const MAX_SOURCE_WIDTH: u32 = 12_288;
const MAX_SOURCE_HEIGHT: u32 = 12_288;
const MAX_SOURCE_PIXELS: u64 = 32 * 1024 * 1024;

fn init_ort() -> Result<(), String> {
    ONNX_INITIALIZED
        .get_or_init(|| {
            // ort 2.0.0-rc.12 returns a bool from commit(): false means an
            // environment was already committed, which is safe for this
            // process-global initialization path.
            let _ = ort::init().with_name("Graffiti").commit();
            Ok(())
        })
        .clone()
}

fn resolve_model_path() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // Tauri resources can be placed beside the executable or under a
            // resources directory depending on the bundle target.
            candidates.push(exe_dir.join("depth_model.onnx"));
            candidates.push(exe_dir.join("resources").join("depth_model.onnx"));
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("depth_model.onnx"));
    }

    // Development fallback for the repository's documented Windows checkout.
    candidates.push(PathBuf::from(r"C:\My_Proj\InteractWall\depth_model.onnx"));

    if let Some(path) = candidates.iter().find(|path| path.is_file()) {
        return Ok(path.clone());
    }

    let searched = candidates
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("; ");
    Err(format!("ONNX model not found. Searched: {}", searched))
}

fn depth_session(model_path: &Path) -> Result<std::sync::MutexGuard<'static, Option<Session>>, String> {
    let session_mutex = DEPTH_SESSION.get_or_init(|| Mutex::new(None));
    let mut session = session_mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    if session.is_none() {
        let built = Session::builder()
            .map_err(|e| format!("Session build error: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Optimization error: {}", e))?
            // Depth generation is a background utility. Keep the ONNX
            // runtime from creating a large CPU thread pool for each request.
            .with_intra_threads(1)
            .map_err(|e| format!("Thread configuration error: {}", e))?
            .with_inter_threads(1)
            .map_err(|e| format!("Graph thread configuration error: {}", e))?
            .with_parallel_execution(false)
            .map_err(|e| format!("Execution mode configuration error: {}", e))?
            .commit_from_file(model_path)
            .map_err(|e| {
                format_runtime_error(
                    &format!("loading the ONNX model '{}'", model_path.display()),
                    e,
                )
            })?;
        *session = Some(built);
    }

    Ok(session)
}

fn format_runtime_error(stage: &str, error: impl std::fmt::Display) -> String {
    let detail = error.to_string();
    let lower = detail.to_ascii_lowercase();
    if lower.contains("capacity")
        || lower.contains("allocate")
        || lower.contains("allocation")
        || lower.contains("out of memory")
        || lower.contains("memory")
    {
        return format!(
            concat!(
                "Depth generation ran out of available memory while {}. ",
                "The request was kept at the bounded 518x518 model input; close other ",
                "depth-generation attempts or GPU/CPU-heavy apps and retry. Details: {}"
            ),
            stage, detail
        );
    }
    format!("Depth generation failed while {}: {}", stage, detail)
}

fn generate_depth_map_blocking(source_path: String) -> Result<String, String> {
    init_ort()?;

    let source = Path::new(&source_path);
    if !source.is_file() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    let model_path = resolve_model_path()?;
    // Inspect the header before decoding the full source. A very large image
    // can otherwise consume hundreds of MB before ONNX even starts, which is
    // the main path behind the reported capacity/allocation failure.
    let (orig_width, orig_height) = image::image_dimensions(source)
        .map_err(|e| format!("Failed to inspect image '{}': {}", source.display(), e))?;
    if orig_width == 0 || orig_height == 0 {
        return Err("Source image has no pixels".to_string());
    }
    let source_pixels = u64::from(orig_width) * u64::from(orig_height);
    if orig_width > MAX_SOURCE_WIDTH
        || orig_height > MAX_SOURCE_HEIGHT
        || source_pixels > MAX_SOURCE_PIXELS
    {
        return Err(format!(
            concat!(
                "Image is too large for on-device depth generation ({}x{} = {} pixels). ",
                "Resize it below {}x{} and {} megapixels, then try again."
            ),
            orig_width,
            orig_height,
            source_pixels,
            MAX_SOURCE_WIDTH,
            MAX_SOURCE_HEIGHT,
            MAX_SOURCE_PIXELS / 1_000_000
        ));
    }

    let img = image::open(source)
        .map_err(|e| format!("Failed to open image '{}': {}", source.display(), e))?;

    // Depth Anything V2's default square inference size. The bundled model
    // accepts dynamic height/width but emits a 518x518 map for this input.
    let resized = img
        .resize_exact(INFERENCE_SIZE, INFERENCE_SIZE, FilterType::Triangle)
        .into_rgb8();

    let mut input_vec = vec![0.0f32; 3 * INFERENCE_PIXELS];
    let mean = [0.485, 0.456, 0.406];
    let std = [0.229, 0.224, 0.225];

    for (x, y, pixel) in resized.enumerate_pixels() {
        let x = x as usize;
        let y = y as usize;
        for c in 0..3 {
            let val = (pixel[c] as f32 / 255.0 - mean[c]) / std[c];
            input_vec[c * INFERENCE_PIXELS + y * INFERENCE_SIZE as usize + x] = val;
        }
    }

    let input_tensor = ort::value::Tensor::from_array(
        (vec![1, 3, INFERENCE_SIZE as usize, INFERENCE_SIZE as usize], input_vec),
    )
    .map_err(|e| format!("Tensor creation failed: {}", e))?;

    // Session::run requires mutable access in ort rc.12. Keeping one session
    // behind a mutex both prevents overlapping inference and avoids repeatedly
    // allocating the 99 MB model plus its execution arena.
    let mut session = depth_session(&model_path)?;
    // Convert the borrowed ONNX output into owned data inside this scope. The
    // session must not be reset while SessionOutputs still borrows it.
    let inference_result = (|| -> Result<Vec<f32>, String> {
        let session_ref = session
            .as_mut()
            .ok_or_else(|| "Depth session was not initialized".to_string())?;
        let outputs = session_ref
            .run(ort::inputs![input_tensor])
            .map_err(|e| format_runtime_error("running the ONNX model", e))?;

        let output_val = outputs
            .values()
            .next()
            .ok_or_else(|| "Depth model returned no output tensor".to_string())?;
        let (_, data) = output_val
            .try_extract_tensor::<f32>()
            .map_err(|e| format_runtime_error("reading the ONNX output", e))?;
        if data.len() < INFERENCE_PIXELS {
            return Err(format!(
                "Depth model output is too small: expected at least {} values, received {}",
                INFERENCE_PIXELS,
                data.len()
            ));
        }
        Ok(data[..INFERENCE_PIXELS].to_vec())
    })();

    let data = match inference_result {
        Ok(data) => data,
        Err(error) => {
            // Release a damaged or allocation-starved session so the next
            // request gets a clean execution arena instead of repeating the
            // same exhausted state forever.
            *session = None;
            return Err(error);
        }
    };
    drop(session);

    let mut min_val = f32::INFINITY;
    let mut max_val = f32::NEG_INFINITY;
    for &val in data.iter() {
        if val.is_finite() {
            min_val = min_val.min(val);
            max_val = max_val.max(val);
        }
    }
    if !min_val.is_finite() || !max_val.is_finite() {
        return Err("Depth model returned no finite values".to_string());
    }

    let mut depth_img = image::ImageBuffer::new(INFERENCE_SIZE, INFERENCE_SIZE);
    let range = max_val - min_val;
    for y in 0..INFERENCE_SIZE {
        for x in 0..INFERENCE_SIZE {
            let index = y as usize * INFERENCE_SIZE as usize + x as usize;
            let val = data[index];
            let normalized = if val.is_finite() && range > f32::EPSILON {
                (val - min_val) / range
            } else {
                0.0
            };
            let luma = (normalized * 255.0).clamp(0.0, 255.0) as u8;
            depth_img.put_pixel(x, y, Luma([luma]));
        }
    }

    let blurred = gaussian_blur_f32(&depth_img, 3.0);

    // Preserve the source aspect ratio. The previous independent 1920x1080
    // caps distorted portrait and ultrawide sources, so their depth texture no
    // longer lined up with the wallpaper texture in the shader.
    let scale = (1920.0 / orig_width as f32)
        .min(1920.0 / orig_height as f32)
        .min(1.0);
    let target_width = ((orig_width as f32 * scale).round() as u32).max(1);
    let target_height = ((orig_height as f32 * scale).round() as u32).max(1);
    let final_depth = image::DynamicImage::ImageLuma8(blurred).resize_exact(
        target_width,
        target_height,
        FilterType::Triangle,
    );

    let file_stem = source
        .file_stem()
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string_lossy();
    let output_stem = if file_stem.chars().count() > 160 {
        let mut hasher = DefaultHasher::new();
        source.to_string_lossy().hash(&mut hasher);
        format!("depth_{:016x}", hasher.finish())
    } else {
        file_stem.to_string()
    };
    let target_dir = source
        .parent()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let target_path = target_dir.join(format!("{}_depth.png", output_stem));
    let temp_path = target_dir.join(format!(".{}_depth.tmp.png", output_stem));

    final_depth
        .save(&temp_path)
        .map_err(|e| format!("Failed to save temporary depth map: {}", e))?;
    if target_path.exists() {
        fs::remove_file(&target_path)
            .map_err(|e| format!("Failed to replace existing depth map: {}", e))?;
    }
    fs::rename(&temp_path, &target_path)
        .map_err(|e| format!("Failed to finalize depth map: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn generate_depth_map(source_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || generate_depth_map_blocking(source_path))
        .await
        .map_err(|e| format!("Depth generation task failed: {}", e))?
}
