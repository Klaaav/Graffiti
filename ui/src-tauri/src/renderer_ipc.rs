use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::time::{sleep, timeout, Instant};

const ERROR_PIPE_BUSY: i32 = 231;
const MAX_MESSAGE_BYTES: usize = 4095;

// A successful open is the real connection. Never open and discard a probe:
// the renderer serves one client, so a probe steals the next request's slot.
async fn connect(
    pipe_name: &str,
    start_renderer: Option<fn() -> Result<(), String>>,
) -> Result<NamedPipeClient, String> {
    let mut next_start_check = Instant::now();
    loop {
        match ClientOptions::new().open(pipe_name) {
            Ok(client) => return Ok(client),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                if let Some(start) = start_renderer {
                    if Instant::now() >= next_start_check {
                        tauri::async_runtime::spawn_blocking(start)
                            .await
                            .map_err(|e| format!("Renderer startup task failed: {}", e))??;
                        next_start_check = Instant::now() + Duration::from_millis(250);
                    }
                }
            }
            Err(error) if error.raw_os_error() == Some(ERROR_PIPE_BUSY) => {}
            Err(error) => return Err(format!("Cannot connect to renderer: {}", error)),
        }
        sleep(Duration::from_millis(10)).await;
    }
}

pub async fn request(
    pipe_name: &str,
    message: &Value,
    start_renderer: Option<fn() -> Result<(), String>>,
    connect_timeout: Duration,
    response_timeout: Duration,
) -> Result<String, String> {
    let command = message
        .get("cmd")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let payload = message.to_string() + "\n";
    if payload.len() > MAX_MESSAGE_BYTES {
        return Err(format!(
            "Renderer command '{}' exceeds the pipe message limit",
            command
        ));
    }
    let mut client = timeout(connect_timeout, connect(pipe_name, start_renderer))
        .await
        .map_err(|_| format!("Renderer connection timed out for '{}'", command))??;

    // Do not reconnect/replay after writing: an expired acknowledgement may
    // still correspond to a command already accepted by the renderer.
    timeout(response_timeout, async {
        client
            .write_all(payload.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        let mut response = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            let count = client.read(&mut buffer).await.map_err(|e| e.to_string())?;
            if count == 0 {
                return Err(format!(
                    "Renderer disconnected before acknowledging '{}'",
                    command
                ));
            }
            response.extend_from_slice(&buffer[..count]);
            if response.len() > MAX_MESSAGE_BYTES {
                return Err("Renderer response exceeds the pipe message limit".to_string());
            }
            if response.contains(&b'\n') {
                let text = std::str::from_utf8(&response)
                    .map_err(|e| e.to_string())?
                    .trim();
                let value: Value = serde_json::from_str(text)
                    .map_err(|e| format!("Invalid renderer response: {}", e))?;
                if let Some(error) = value.get("error") {
                    return Err(format!("Renderer rejected '{}': {}", command, error));
                }
                return Ok(text.to_string());
            }
        }
    })
    .await
    .map_err(|_| format!("Renderer acknowledgement timed out for '{}'", command))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::net::windows::named_pipe::ServerOptions;

    static NEXT_PIPE: AtomicUsize = AtomicUsize::new(0);

    fn pipe_name() -> String {
        format!(
            r"\\.\pipe\Graffiti-test-{}-{}",
            std::process::id(),
            NEXT_PIPE.fetch_add(1, Ordering::Relaxed)
        )
    }

    #[tokio::test(flavor = "current_thread")]
    async fn requests_reach_the_server_without_empty_probe_connections() {
        let name = pipe_name();
        let mut server = ServerOptions::new().create(&name).unwrap();
        let receiver = tokio::spawn(async move {
            server.connect().await.unwrap();
            let mut buffer = [0u8; 4096];
            let count = server.read(&mut buffer).await.unwrap();
            let received: Value = serde_json::from_slice(&buffer[..count]).unwrap();
            server
                .write_all(b"{\"status\":\"queued\"}\n")
                .await
                .unwrap();
            received
        });
        let message = json!({"cmd": "set_setting", "key": "brushSize", "value": 120});
        request(
            &name,
            &message,
            None,
            Duration::from_secs(1),
            Duration::from_secs(1),
        )
        .await
        .unwrap();
        assert_eq!(receiver.await.unwrap(), message);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn busy_pipe_retries_yield_to_other_tasks_and_reuse_the_real_connection() {
        let name = pipe_name();
        let mut busy = ServerOptions::new().max_instances(1).create(&name).unwrap();
        let first_client = ClientOptions::new().open(&name).unwrap();
        busy.connect().await.unwrap();
        let receiver = tokio::spawn(async move {
            sleep(Duration::from_millis(60)).await;
            drop(first_client);
            busy.disconnect().unwrap();
            busy.connect().await.unwrap();
            let mut buffer = [0u8; 4096];
            let count = busy.read(&mut buffer).await.unwrap();
            assert!(
                count > 0,
                "client consumed the connection without a request"
            );
            busy
                .write_all(b"{\"status\":\"queued\"}\n")
                .await
                .unwrap();
        });
        request(
            &name,
            &json!({"cmd": "set_effect", "plugin": "depth_parallax"}),
            None,
            Duration::from_secs(1),
            Duration::from_secs(1),
        )
        .await
        .unwrap();
        receiver.await.unwrap();
    }

    #[tokio::test(flavor = "current_thread")]
    async fn missing_pipe_and_unresponsive_server_have_bounded_waits() {
        let name = pipe_name();
        let message = json!({"cmd": "get_status"});
        let error = request(
            &name,
            &message,
            None,
            Duration::from_millis(30),
            Duration::from_millis(30),
        )
        .await
        .unwrap_err();
        assert!(error.contains("connection timed out"));

        let mut server = ServerOptions::new().create(&name).unwrap();
        let receiver = tokio::spawn(async move {
            server.connect().await.unwrap();
            let mut buffer = [0u8; 4096];
            let count = server.read(&mut buffer).await.unwrap();
            assert!(count > 0);
            sleep(Duration::from_millis(150)).await;
        });
        let error = request(
            &name,
            &message,
            None,
            Duration::from_secs(1),
            Duration::from_millis(30),
        )
        .await
        .unwrap_err();
        assert!(error.contains("acknowledgement timed out"));
        receiver.await.unwrap();
    }
}
