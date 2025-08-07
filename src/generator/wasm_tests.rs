use {
    super::{GraphGenerator, GraphGeneratorWasm},
    crate::lsp_types::{DocumentSymbol, Position, Range, SymbolKind, Location, Uri, CallHierarchyIncomingCall, CallHierarchyOutgoingCall, CallHierarchyItem},
    wasm_bindgen::prelude::*,
    wasm_bindgen_test::*,
};

#[cfg(test)]
#[cfg(feature = "wasm")]
mod wasm_tests {
    use super::*;

    // 测试WebAssembly绑定的基本功能
    #[wasm_bindgen_test]
    fn test_wasm_basic_functionality() {
        // 初始化panic hook
        super::set_panic_hook();
        
        // 创建GraphGeneratorWasm实例
        let generator = GraphGeneratorWasm::new("test_root".to_string(), "rust".to_string());
        
        // 测试should_filter_out_file方法
        // 注意：默认的Language实现不会过滤任何文件
        // 只有特定语言（如Go）才会实现自定义的过滤逻辑
        let generator_go = GraphGeneratorWasm::new("test_root".to_string(), "Go".to_string());
        let should_filter = generator_go.should_filter_out_file("test_file_test.go".to_string());
        assert!(should_filter, "Go语言实现应该过滤掉测试文件");
        
        // 测试add_file方法
        let range = Range {
            start: Position { line: 1, character: 1 },
            end: Position { line: 1, character: 10 },
        };
        
        let symbols = vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }];
        
        // 将symbols转换为JsValue
        let symbols_js = serde_wasm_bindgen::to_value(&symbols).unwrap();
        
        // 添加文件
        let added = generator.add_file("test_file.rs".to_string(), symbols_js);
        assert!(added, "文件应该被成功添加");
        
        // 测试generate_dot_source方法
        let dot = generator.generate_dot_source();
        assert!(!dot.is_empty(), "生成的dot源码不应为空");
    }

    // 测试错误处理
    #[wasm_bindgen_test]
    fn test_wasm_error_handling() {
        // 创建GraphGeneratorWasm实例
        let generator = GraphGeneratorWasm::new("test_root".to_string(), "rust".to_string());
        
        // 测试传入无效的JsValue
        let invalid_js_value = JsValue::NULL;
        
        // 添加文件应该失败，但不应panic
        let added = generator.add_file("test_file.rs".to_string(), invalid_js_value);
        assert!(!added, "使用无效的JsValue添加文件应该失败");
        
        // 测试传入无效的Position
        let invalid_position = JsValue::NULL;
        let calls = JsValue::NULL;
        
        // 调用方法应该不会panic
        generator.add_incoming_calls("test_file.rs".to_string(), invalid_position.clone(), calls.clone());
        generator.add_outgoing_calls("test_file.rs".to_string(), invalid_position.clone(), calls.clone());
        generator.add_interface_implementations("test_file.rs".to_string(), invalid_position.clone(), calls.clone());
        generator.highlight("test_file.rs".to_string(), invalid_position);
        
        // 生成源码应该返回空字符串，而不是panic
        let dot = generator.generate_dot_source();
        assert!(dot.is_empty(), "使用无效数据生成的dot源码应为空");
        
        let mermaid = generator.generate_mermaid_source();
        assert!(mermaid.is_empty(), "使用无效数据生成的mermaid源码应为空");
    }

    // 测试并发借用
    #[wasm_bindgen_test]
    fn test_wasm_concurrent_borrow() {
        // 创建GraphGeneratorWasm实例
        let generator = GraphGeneratorWasm::new("test_root".to_string(), "rust".to_string());
        
        // 添加一个文件
        let range = Range {
            start: Position { line: 1, character: 1 },
            end: Position { line: 1, character: 10 },
        };
        
        let symbols = vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }];
        
        let symbols_js = serde_wasm_bindgen::to_value(&symbols).unwrap();
        generator.add_file("test_file.rs".to_string(), symbols_js);
        
        // 创建Position和Calls
        let position = Position { line: 1, character: 1 };
        let position_js = serde_wasm_bindgen::to_value(&position).unwrap();
        
        // 在WebAssembly环境中，我们不能直接测试多线程，但可以测试RefCell的借用行为
        // 这里我们连续调用多个方法，模拟并发借用的情况
        
        // 添加incoming calls
        let incoming_calls = vec![create_test_incoming_call()];
        let incoming_calls_js = serde_wasm_bindgen::to_value(&incoming_calls).unwrap();
        generator.add_incoming_calls("test_file.rs".to_string(), position_js.clone(), incoming_calls_js);
        
        // 添加outgoing calls
        let outgoing_calls = vec![create_test_outgoing_call()];
        let outgoing_calls_js = serde_wasm_bindgen::to_value(&outgoing_calls).unwrap();
        generator.add_outgoing_calls("test_file.rs".to_string(), position_js.clone(), outgoing_calls_js);
        
        // 生成dot源码
        let dot = generator.generate_dot_source();
        assert!(!dot.is_empty(), "生成的dot源码不应为空");
        
        // 生成mermaid源码
        let mermaid = generator.generate_mermaid_source();
        assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
    }
}

// 辅助函数：创建测试用的incoming call
fn create_test_incoming_call() -> CallHierarchyIncomingCall {
    let from_range = Range {
        start: Position { line: 2, character: 2 },
        end: Position { line: 2, character: 20 },
    };
    
    CallHierarchyIncomingCall {
        from: CallHierarchyItem {
            name: "caller_function".to_string(),
            kind: SymbolKind::Function,
            tags: None,
            detail: None,
            uri: Uri { path: "test_file.rs".to_string() },
            range: from_range.clone(),
            selection_range: from_range,
            data: None,
        },
        from_ranges: vec![from_range],
    }
}

// 辅助函数：创建测试用的outgoing call
fn create_test_outgoing_call() -> CallHierarchyOutgoingCall {
    let to_range = Range {
        start: Position { line: 3, character: 3 },
        end: Position { line: 3, character: 30 },
    };
    
    CallHierarchyOutgoingCall {
        to: CallHierarchyItem {
            name: "callee_function".to_string(),
            kind: SymbolKind::Function,
            tags: None,
            detail: None,
            uri: Uri { path: "test_file.rs".to_string() },
            range: to_range.clone(),
            selection_range: to_range,
            data: None,
        },
        from_ranges: vec![to_range],
    }
}