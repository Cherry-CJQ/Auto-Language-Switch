use std::io::{self, BufRead, Write};
use std::collections::HashSet;
use serde::{Deserialize, Serialize};
use windows::core::{GUID, Interface};
use windows::Win32::System::Com::{CoInitialize, CoCreateInstance, CLSCTX_INPROC_SERVER};
use windows::Win32::UI::TextServices::{
    ITfInputProcessorProfiles, CLSID_TF_InputProcessorProfiles, 
    TF_LANGUAGEPROFILE
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyboardLayoutList,
    LoadKeyboardLayoutW, KLF_ACTIVATE, KLF_SUBSTITUTE_OK
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, PostMessageW, WM_INPUTLANGCHANGEREQUEST,
    GetWindowThreadProcessId
};
use windows::Win32::System::Threading::{GetCurrentThreadId, AttachThreadInput};
use windows::Win32::Foundation::{WPARAM, LPARAM, HWND, BOOL};
use windows::Win32::UI::TextServices::HKL;
use windows::Win32::UI::Input::Ime::ImmGetDescriptionW;

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
    data: Option<Vec<LayoutInfo>>,
}

fn parse_guid(s: &str) -> Result<GUID, String> {
    let clean = s.trim_matches(|c| c == '{' || c == '}');
    let parts: Vec<&str> = clean.split('-').collect();
    if parts.len() != 5 {
        return Err("Invalid GUID format".to_string());
    }

    let d1 = u32::from_str_radix(parts[0], 16).map_err(|_| "Invalid d1")?;
    let d2 = u16::from_str_radix(parts[1], 16).map_err(|_| "Invalid d2")?;
    let d3 = u16::from_str_radix(parts[2], 16).map_err(|_| "Invalid d3")?;
    
    let d4_1 = u16::from_str_radix(parts[3], 16).map_err(|_| "Invalid d4_1")?;
    let d4_2 = u64::from_str_radix(parts[4], 16).map_err(|_| "Invalid d4_2")?;
    
    let mut d4 = [0u8; 8];
    d4[0] = (d4_1 >> 8) as u8;
    d4[1] = (d4_1 & 0xFF) as u8;
    
    for i in 0..6 {
        d4[2 + i] = ((d4_2 >> ((5 - i) * 8)) & 0xFF) as u8;
    }

    Ok(GUID::from_values(d1, d2, d3, d4))
}

fn get_target_window() -> Result<HWND, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return Err("No foreground window found".to_string());
        }
        Ok(hwnd)
    }
}

// Helper to identify common IMEs by GUID substring
fn identify_ime_by_guid(guid_str: &str) -> String {
    let upper = guid_str.to_uppercase();
    match upper {
        _ if upper.contains("81D4E9C9") => "Microsoft Pinyin".to_string(),
        _ if upper.contains("E7EA138E") => "Sogou Pinyin".to_string(),
        _ if upper.contains("170462E1") => "Baidu Pinyin".to_string(),
        _ if upper.contains("F3BA9077") => "WeChat Keyboard".to_string(),
        _ if upper.contains("A028AF") => "QQ Pinyin".to_string(), // Common fragment
        _ if upper.contains("6A498709") => "Google Pinyin".to_string(), // Legacy
        _ => {
            // Return a friendly unknown string with first 8 chars of GUID for identification
            let short_id = if upper.len() > 8 { &upper[0..8] } else { &upper };
            format!("IME ({})", short_id)
        }
    }
}

// ---- TSF Implementation ----

fn list_layouts_tsf() -> Result<Vec<LayoutInfo>, String> {
    let mut results = Vec::new();

    unsafe {
        let _ = CoInitialize(None); 

        let profiles_res: Result<ITfInputProcessorProfiles, _> = CoCreateInstance(
            &CLSID_TF_InputProcessorProfiles, 
            None, 
            CLSCTX_INPROC_SERVER
        );

        if let Ok(profiles) = profiles_res {
            let lang_id_all: u16 = 0xFFFF;

            if let Ok(enumerator) = profiles.EnumLanguageProfiles(lang_id_all) {
                loop {
                    let mut profile = [TF_LANGUAGEPROFILE::default(); 1];
                    let mut fetched = 0;
                    if enumerator.Next(&mut profile, &mut fetched).is_err() || fetched == 0 {
                        break;
                    }

                    let p = profile[0];
                    if !p.fActive.as_bool() { continue; }

                    let desc = match profiles.GetLanguageProfileDescription(&p.clsid, p.langid, &p.guidProfile) {
                        Ok(bstr) => bstr.to_string(),
                        Err(_) => String::new()
                    };
                    
                    let name = if desc.trim().is_empty() {
                         // Fallback to GUID matching
                         let guid_str = format!("{:?}", p.clsid); // Simple debug format
                         let ime_name = identify_ime_by_guid(&guid_str);
                         
                         match p.langid {
                            0x0804 => format!("{} (Chinese)", ime_name),
                            0x0409 => "English (US)".to_string(),
                            _ => format!("Language 0x{:04x}", p.langid)
                        }
                    } else {
                        desc
                    };

                    let id = format!("TSF:{}:{:?}:{:?}", p.langid, p.clsid, p.guidProfile);
                    results.push(LayoutInfo { id, name });
                }
            }
        }
    }
    
    Ok(results)
}

fn switch_layout_tsf(id_str: &str) -> Result<(), String> {
    let parts: Vec<&str> = id_str.split(':').collect();
    if parts.len() != 4 {
        return Err("Invalid TSF ID format".to_string());
    }

    let langid = parts[1].parse::<u16>().map_err(|_| "Invalid LangID")?;
    let clsid = parse_guid(parts[2]).map_err(|e| format!("Invalid CLSID: {}", e))?;
    let profile_guid = parse_guid(parts[3]).map_err(|e| format!("Invalid Profile GUID: {}", e))?;

    unsafe {
        let _ = CoInitialize(None);
        let profiles: ITfInputProcessorProfiles = CoCreateInstance(
            &CLSID_TF_InputProcessorProfiles, 
            None, 
            CLSCTX_INPROC_SERVER
        ).map_err(|e| format!("Failed to create TSF: {}", e))?;

        if let Err(e) = profiles.SetDefaultLanguageProfile(langid, &clsid, &profile_guid) {
             return Err(format!("Failed to SetDefaultLanguageProfile: {}", e));
        }
        
        let hkl = HKL(langid as isize); 
        if let Ok(hwnd) = get_target_window() {
             let _ = PostMessageW(
                hwnd, 
                WM_INPUTLANGCHANGEREQUEST, 
                WPARAM(0), 
                LPARAM(hkl.0)
            );
        }
    }
    Ok(())
}

// ---- Legacy Implementation (Fallback) ----

fn get_legacy_description(hkl: HKL) -> String {
    unsafe {
        let mut buffer = [0u16; 512];
        let len = ImmGetDescriptionW(hkl, Some(&mut buffer));
        if len > 0 {
            String::from_utf16_lossy(&buffer[..len as usize])
        } else {
            let id_hex = format!("{:08x}", hkl.0);
            match id_hex.as_str() {
                "00000409" | "04090409" => "English (US) - Legacy".to_string(),
                "00000804" | "08040804" => "Chinese (Simplified) - Default".to_string(),
                _ => format!("Legacy Layout {:08x}", hkl.0)
            }
        }
    }
}

fn list_layouts_legacy() -> Result<Vec<LayoutInfo>, String> {
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
                let name = get_legacy_description(*hkl);
                LayoutInfo { id, name }
            })
            .collect();
        Ok(result)
    }
}

fn switch_layout_legacy(layout_id: &str) -> Result<(), String> {
     unsafe {
        let hkl_val = isize::from_str_radix(layout_id, 16).map_err(|_| "Invalid Hex")?;
        let hkl = HKL(hkl_val);

        if let Ok(hwnd) = get_target_window() {
            let success = PostMessageW(
                hwnd, 
                WM_INPUTLANGCHANGEREQUEST, 
                WPARAM(0), 
                LPARAM(hkl.0)
            );
            
             match success {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("PostMessage failed: {}", e))
            }
        } else {
            Err("No foreground window".to_string())
        }
    }
}

// ---- PowerShell Fallback ----

fn list_layouts_powershell() -> Result<Vec<LayoutInfo>, String> {
    let output = std::process::Command::new("powershell")
        .args(&["-NoProfile", "-Command", "Get-WinUserLanguageList | ForEach-Object { Write-Output ($_.LanguageTag + '::' + $_.InputMethodTips) }"])
        .output()
        .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    let mut results = Vec::new();
    
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        
        // Pattern: XXXX:{...}
        if line.len() > 5 && &line[4..5] == ":" {
            if let Ok(lid) = u16::from_str_radix(&line[0..4], 16) {
                let rest = &line[5..];
                
                let lang_name = match lid {
                    0x0804 => "Chinese (Simplified)",
                    0x0409 => "English (US)",
                    _ => "Other Language"
                };

                if rest.starts_with('{') {
                     // Use shared helper
                     let name = identify_ime_by_guid(rest);
                     
                     if rest.contains("}{") {
                         let guids: Vec<&str> = rest.split("}{").collect();
                         if guids.len() == 2 {
                             let clsid = guids[0].trim_matches('{');
                             let profile = guids[1].trim_matches('}');
                             
                             let id = format!("TSF:{}:{}:{}", lid, clsid, profile);
                             let full_name = format!("{} ({})", name, lang_name);
                             results.push(LayoutInfo { id, name: full_name });
                         }
                     }
                } else {
                    let name = if lid == 0x0409 { "English (US)" } else { "Legacy IME" };
                    if rest.len() == 8 {
                        let id = rest.to_string();
                        let full_name = format!("{} ({})", name, lang_name);
                        results.push(LayoutInfo { id, name: full_name });
                    }
                }
            }
        }
    }
    
    Ok(results)
}

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    let init_msg = serde_json::to_string(&Response {
        status: "ready".to_string(),
        message: "ALS Sidecar v1.6 (Better Names)".to_string(),
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
                    let result = if req.payload.starts_with("TSF:") {
                        switch_layout_tsf(&req.payload)
                    } else {
                        switch_layout_legacy(&req.payload)
                    };
                    
                    match result {
                        Ok(_) => res.message = format!("Switched to {}", req.payload),
                        Err(e) => {
                            res.status = "error".to_string();
                            res.message = e;
                        }
                    }
                },
                "list" => {
                    let mut final_list = Vec::new();
                    let mut seen_ids = HashSet::new();

                    if let Ok(tsf_list) = list_layouts_tsf() {
                        for item in tsf_list {
                            if seen_ids.insert(item.id.clone()) {
                                final_list.push(item);
                            }
                        }
                    }

                    if let Ok(ps_list) = list_layouts_powershell() {
                        for item in ps_list {
                             if seen_ids.insert(item.id.clone()) {
                                 final_list.push(item);
                             }
                        }
                    }

                    if let Ok(legacy_list) = list_layouts_legacy() {
                        for item in legacy_list {
                            if seen_ids.insert(item.id.clone()) {
                                final_list.push(item);
                            }
                        }
                    }

                    if final_list.is_empty() {
                         res.status = "error".to_string();
                         res.message = "No layouts found".to_string();
                    } else {
                        res.data = Some(final_list);
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
