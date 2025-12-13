use std::io::{self, BufRead, Write};
use serde::{Deserialize, Serialize};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    LoadKeyboardLayoutW, GetKeyboardLayoutList, KLF_ACTIVATE, KLF_SUBSTITUTE_OK
};
use windows::Win32::UI::Input::Ime::ImmGetDescriptionW;
use windows::Win32::UI::TextServices::HKL;
use windows::core::PCWSTR;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, PostMessageW, WM_INPUTLANGCHANGEREQUEST
};

#[derive(Serialize, Deserialize, Debug)]
struct Request {
    action: String,
    #[serde(default)]
    payload: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct LayoutInfo {
    id: String,
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct Response {
    status: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Vec<LayoutInfo>>, // 变更为详细对象
}

fn to_pcwstr(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

// 辅助：从 HKL 获取描述
fn get_description(hkl: HKL) -> String {
    unsafe {
        let mut buffer = [0u16; 512];
        // ImmGetDescriptionW 返回拷贝的字符数
        // Windows crate 0.52 signature: (hkl, Option<&mut [u16]>) -> u32
        let len = ImmGetDescriptionW(hkl, Some(&mut buffer));
        if len > 0 {
            String::from_utf16_lossy(&buffer[..len as usize])
        } else {
            // 如果获取失败，尝试硬编码一些已知 ID 的 fallback，或者直接返回 Unknown
            let id_hex = format!("{:08x}", hkl.0);
            match id_hex.as_str() {
                "00000409" | "04090409" => "English (US)".to_string(),
                "00000804" | "08040804" => "Chinese (Simplified) - Default".to_string(),
                _ => "Unknown Layout".to_string()
            }
        }
    }
}

fn list_layouts() -> Result<Vec<LayoutInfo>, String> {
    unsafe {
        let count = GetKeyboardLayoutList(None);
        if count == 0 {
            return Err("No keyboard layouts found".to_string());
        }

        let mut list = vec![HKL(0); count as usize];
        let loaded = GetKeyboardLayoutList(Some(&mut list));
        
        let result = list.iter()
            .take(loaded as usize)
            .map(|hkl| {
                let id = format!("{:08x}", hkl.0);
                let name = get_description(*hkl);
                LayoutInfo { id, name }
            })
            .collect();
            
        Ok(result)
    }
}

fn switch_layout(layout_id: &str) -> Result<(), String> {
    unsafe {
        // 尝试解析 HKL
        let hkl_val = isize::from_str_radix(layout_id, 16);

        let hkl = if let Ok(val) = hkl_val {
            HKL(val)
        } else {
            // Fallback load
            let layout_w = to_pcwstr(layout_id);
            let flags = windows::Win32::UI::Input::KeyboardAndMouse::ACTIVATE_KEYBOARD_LAYOUT_FLAGS(
                KLF_ACTIVATE.0 | KLF_SUBSTITUTE_OK.0
            );
            let hkl_res = LoadKeyboardLayoutW(PCWSTR(layout_w.as_ptr()), flags);
            if let Err(e) = hkl_res {
                return Err(format!("Failed to load layout: {} ({})", layout_id, e));
            }
            hkl_res.unwrap()
        };

        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return Err("No foreground window".to_string());
        }

        let lparam = std::mem::transmute::<_, isize>(hkl);
        
        let success = PostMessageW(
            hwnd, 
            WM_INPUTLANGCHANGEREQUEST, 
            windows::Win32::Foundation::WPARAM(0), 
            windows::Win32::Foundation::LPARAM(lparam)
        );

        if let Err(e) = success {
             return Err(format!("PostMessage failed: {}", e));
        }
        
        Ok(())
    }
}

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    let init_msg = serde_json::to_string(&Response {
        status: "ready".to_string(),
        message: "ALS Sidecar v0.9 (With Names)".to_string(),
        data: None,
    })?;
    writeln!(stdout, "{}", init_msg)?;
    stdout.flush()?;

    for line in stdin.lock().lines() {
        let input = line?;
        if input.trim().is_empty() { continue; }

        if let Ok(req) = serde_json::from_str::<Request>(&input) {
            let mut res = Response {
                status: "ok".to_string(),
                message: "".to_string(),
                data: None,
            };

            match req.action.as_str() {
                "switch" => {
                    match switch_layout(&req.payload) {
                        Ok(_) => {
                            res.message = format!("Switched to {}", req.payload);
                        }
                        Err(e) => {
                            res.status = "error".to_string();
                            res.message = e;
                        }
                    }
                },
                "list" => {
                    match list_layouts() {
                        Ok(list) => {
                            res.message = "Installed Layouts".to_string();
                            res.data = Some(list);
                        },
                        Err(e) => {
                            res.status = "error".to_string();
                            res.message = e;
                        }
                    }
                },
                _ => {
                    res.message = "Unknown command".to_string();
                }
            }

            writeln!(stdout, "{}", serde_json::to_string(&res)?)?;
            stdout.flush()?;
        }
    }
    Ok(())
}