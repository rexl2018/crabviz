use {
    super::GraphGenerator,
    crate::lsp_types::{
        CallHierarchyIncomingCall, CallHierarchyOutgoingCall, DocumentSymbol, Location, Position,
    },
    std::cell::RefCell,
    wasm_bindgen::prelude::*,
};

// 导入wee_alloc用于WebAssembly内存分配
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
use wee_alloc;

#[cfg(feature = "vscode")]
use web_sys::console;

#[wasm_bindgen]
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    pub(crate) fn log(s: String);
}

#[wasm_bindgen(js_name = GraphGenerator)]
pub struct GraphGeneratorWasm {
    inner: RefCell<GraphGenerator>,
}

#[wasm_bindgen(js_class = GraphGenerator)]
impl GraphGeneratorWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(root: String, lang: String) -> Self {
        Self {
            inner: RefCell::new(GraphGenerator::new(root, &lang)),
        }
    }

    pub fn should_filter_out_file(&self, file_path: String) -> bool {
        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow() {
                Ok(inner) => {
                    return inner.should_filter_out_file(&file_path); // 成功处理后返回结果
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for should_filter_out_file after multiple attempts: BorrowError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for should_filter_out_file: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
        false // 默认不过滤，作为错误情况的回退
    }

    pub fn add_file(&self, file_path: String, symbols: JsValue) -> bool {
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let symbols = match serde_wasm_bindgen::from_value::<Vec<DocumentSymbol>>(symbols) {
            Ok(s) => s,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize symbols: {:?}", err)));
                return false;
            }
        };

        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow_mut() {
                Ok(mut inner) => {
                    return inner.add_file(file_path.clone(), symbols.clone()); // 成功处理后返回结果
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for add_file after multiple attempts: BorrowMutError"));
                        return false;
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for add_file: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
        false // 如果所有尝试都失败，返回false
    }

    pub fn add_incoming_calls(&self, file_path: String, position: JsValue, calls: JsValue) {
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let position = match serde_wasm_bindgen::from_value::<Position>(position) {
            Ok(pos) => pos,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize position: {:?}", err)));
                return;
            }
        };
        
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let calls = match serde_wasm_bindgen::from_value::<Vec<CallHierarchyIncomingCall>>(calls) {
            Ok(c) => c,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize incoming calls: {:?}", err)));
                return;
            }
        };

        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow_mut() {
                Ok(mut inner) => {
                    inner.add_incoming_calls(file_path, position.clone(), calls.clone());
                    return; // 成功处理后返回
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for add_incoming_calls after multiple attempts: BorrowMutError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for add_incoming_calls: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
    }

    pub fn add_outgoing_calls(&self, file_path: String, position: JsValue, calls: JsValue) {
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let position = match serde_wasm_bindgen::from_value::<Position>(position) {
            Ok(pos) => pos,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize position: {:?}", err)));
                return;
            }
        };
        
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let calls = match serde_wasm_bindgen::from_value::<Vec<CallHierarchyOutgoingCall>>(calls) {
            Ok(c) => c,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize outgoing calls: {:?}", err)));
                return;
            }
        };

        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow_mut() {
                Ok(mut inner) => {
                    inner.add_outgoing_calls(file_path, position.clone(), calls.clone());
                    return; // 成功处理后返回
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for add_outgoing_calls after multiple attempts: BorrowMutError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for add_outgoing_calls: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
    }

    pub fn add_interface_implementations(
        &self,
        file_path: String,
        position: JsValue,
        locations: JsValue,
    ) {
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let position = match serde_wasm_bindgen::from_value::<Position>(position) {
            Ok(pos) => pos,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize position: {:?}", err)));
                return;
            }
        };
        
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let locations = match serde_wasm_bindgen::from_value::<Vec<Location>>(locations) {
            Ok(loc) => loc,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize locations: {:?}", err)));
                return;
            }
        };

        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow_mut() {
                Ok(mut inner) => {
                    inner.add_interface_implementations(file_path, position.clone(), locations.clone());
                    return; // 成功处理后返回
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for add_interface_implementations after multiple attempts: BorrowMutError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for add_interface_implementations: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
    }

    pub fn highlight(&self, file_path: String, position: JsValue) {
        // 使用match处理反序列化可能的错误，避免unwrap导致的panic
        let position = match serde_wasm_bindgen::from_value::<Position>(position) {
            Ok(pos) => pos,
            Err(err) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str(&format!("Failed to deserialize position: {:?}", err)));
                return;
            }
        };

        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow_mut() {
                Ok(mut inner) => {
                    inner.highlight(file_path, position.clone());
                    return; // 成功处理后返回
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for highlight after multiple attempts: BorrowMutError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for highlight: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
    }

    pub fn generate_dot_source(&self) -> String {
        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow() {
                Ok(inner) => {
                    return inner.generate_dot_source(); // 成功处理后返回结果
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for generate_dot_source after multiple attempts: BorrowError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for generate_dot_source: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
        String::new() // 如果所有尝试都失败，返回空字符串
    }

    pub fn generate_mermaid_source(&self) -> String {
        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow() {
                Ok(inner) => {
                    return inner.generate_mermaid_source(); // 成功处理后返回结果
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for generate_mermaid_source after multiple attempts: BorrowError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for generate_mermaid_source: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
        String::new() // 如果所有尝试都失败，返回空字符串
    }

    pub fn generate_graph(&self) -> JsValue {
        // 尝试最多3次借用，以处理可能的临时借用冲突
        for attempt in 0..3 {
            match self.inner.try_borrow() {
                Ok(inner) => {
                    let graph = inner.generate_graph();
                    return serde_wasm_bindgen::to_value(&graph).unwrap_or(JsValue::NULL);
                },
                Err(_) => {
                    if attempt == 2 { // 最后一次尝试失败
                        #[cfg(feature = "vscode")]
                        console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for generate_graph after multiple attempts: BorrowError"));
                    } else {
                        // 短暂等待后重试
                        #[cfg(feature = "vscode")]
                        console::warn_1(&JsValue::from_str(&format!("Retry borrowing GraphGenerator for generate_graph: attempt {}", attempt + 1)));
                        // 在WebAssembly环境中模拟短暂延迟
                        let mut i = 0;
                        while i < 1000000 { i += 1; } // 简单的忙等待循环
                    }
                }
            }
        }
        JsValue::NULL // 如果所有尝试都失败，返回NULL
    }
    
    pub fn search_symbols(&self, query: String, case_sensitive: bool) -> JsValue {
        match self.inner.try_borrow() {
            Ok(inner) => {
                let graph = inner.generate_graph();
                let results = graph.search_symbols(&query, case_sensitive);
                serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::NULL)
            },
            Err(_) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for search_symbols"));
                JsValue::NULL
            }
        }
    }
    
    pub fn search_files(&self, query: String, case_sensitive: bool) -> JsValue {
        match self.inner.try_borrow() {
            Ok(inner) => {
                let graph = inner.generate_graph();
                let results = graph.search_files(&query, case_sensitive);
                serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::NULL)
            },
            Err(_) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for search_files"));
                JsValue::NULL
            }
        }
    }
    
    pub fn search_by_symbol_kind(&self, kind: u8) -> JsValue {
        use crate::graph_model::SymbolKind;
        
        let symbol_kind = match kind {
            1 => SymbolKind::File,
            2 => SymbolKind::Module,
            3 => SymbolKind::Namespace,
            4 => SymbolKind::Package,
            5 => SymbolKind::Class,
            6 => SymbolKind::Method,
            7 => SymbolKind::Property,
            8 => SymbolKind::Field,
            9 => SymbolKind::Constructor,
            10 => SymbolKind::Enum,
            11 => SymbolKind::Interface,
            12 => SymbolKind::Function,
            13 => SymbolKind::Variable,
            14 => SymbolKind::Constant,
            15 => SymbolKind::String,
            16 => SymbolKind::Number,
            17 => SymbolKind::Boolean,
            18 => SymbolKind::Array,
            19 => SymbolKind::Object,
            20 => SymbolKind::Key,
            21 => SymbolKind::Null,
            22 => SymbolKind::EnumMember,
            23 => SymbolKind::Struct,
            24 => SymbolKind::Event,
            25 => SymbolKind::Operator,
            26 => SymbolKind::TypeParameter,
            _ => return JsValue::NULL,
        };
        
        match self.inner.try_borrow() {
            Ok(inner) => {
                let graph = inner.generate_graph();
                let results = graph.search_by_symbol_kind(symbol_kind);
                serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::NULL)
            },
            Err(_) => {
                #[cfg(feature = "vscode")]
                console::error_1(&JsValue::from_str("Failed to borrow GraphGenerator for search_by_symbol_kind"));
                JsValue::NULL
            }
        }
    }
}
