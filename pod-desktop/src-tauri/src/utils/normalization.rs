// Normalization utilities migrated from NodeJS `server.js`
use regex::Regex;

pub fn normalize_text(text: &str) -> String {
    let re = Regex::new(r"[\x00-\x1F\x7F\u{200B}-\u{200D}\u{FEFF}]").expect("Regex compile failed");
    let cleaned = re.replace_all(text.trim(), "");
    let space_re = Regex::new(r"\s+").expect("Regex compile failed");
    space_re.replace_all(&cleaned, " ").trim().to_string()
}

pub fn normalize_waybill(waybill: &str) -> String {
    let re = Regex::new(r"[^A-Z0-9]").expect("Regex compile failed");
    re.replace_all(&waybill.trim().to_uppercase(), "").to_string()
}

pub fn normalize_drop_point(dp: &str) -> String {
    let re = Regex::new(r"[^A-Z0-9_]").expect("Regex compile failed");
    re.replace_all(&dp.trim().to_uppercase(), "").to_string()
}

pub fn normalize_name(name: &str) -> String {
    let cleaned = normalize_text(name);
    // Keep only letters, numbers, and single spaces
    let re = Regex::new(r"[^a-zA-Z0-9\s]").expect("Regex compile failed");
    let alphanumeric_only = re.replace_all(&cleaned, " ");
    let space_re = Regex::new(r"\s+").expect("Regex compile failed");
    let re_cleaned = space_re.replace_all(&alphanumeric_only, " ").trim().to_string();
    
    if re_cleaned.is_empty() { return "-".to_string(); }

    re_cleaned
        .split_whitespace()
        .map(|word| {
            let mut c = word.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str().to_lowercase().as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

pub fn extract_sprinter_code(input: &str) -> String {
    if input.is_empty() { return String::new(); }
    
    // Pattern 1: Look for code inside parentheses e.g. "NAME (S001)"
    let re_paren = Regex::new(r"[\(\[{(]([^\)\]}]+)[\)\]})]").expect("Regex compile failed");
    if let Some(cap) = re_paren.captures(input) {
        return cap.get(1).map_or(String::new(), |m| m.as_str().trim().to_uppercase());
    }
    
    // Pattern 2: Look for pattern "NAME - CODE" or "NAME-CODE"
    let re_dash = Regex::new(r"-\s*([A-Z0-9]{3,20})$").expect("Regex compile failed");
    if let Some(cap) = re_dash.captures(input) {
        return cap.get(1).map_or(String::new(), |m| m.as_str().trim().to_uppercase());
    }

    // Pattern 3: If the input itself looks like a code (alphanumeric, no spaces, short)
    let re_code = Regex::new(r"^[A-Z0-9]{3,25}$").expect("Regex compile failed");
    let cleaned = input.trim().to_uppercase();
    if re_code.is_match(&cleaned) {
        return cleaned;
    }

    String::new()
}

pub fn sanitize_filename(filename: &str) -> String {
    // 1. Remove any path components (get just the basename)
    let path = std::path::Path::new(filename);
    let base = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(filename);
    
    // 2. Remove ".." and other suspicious characters
    let re = Regex::new(r"[^a-zA-Z0-9._\-]").expect("Regex compile failed");
    re.replace_all(base, "_").to_string()
}

