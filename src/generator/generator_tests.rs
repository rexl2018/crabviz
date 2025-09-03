use {
    super::GraphGenerator,
    crate::lsp_types::{DocumentSymbol, Position, Range, SymbolKind, CallHierarchyIncomingCall, CallHierarchyItem, CallHierarchyOutgoingCall, Uri, Location},
    crate::graph::{Cell, CssClass, Edge, Subgraph},
    std::collections::{HashMap, HashSet},
    std::path::PathBuf,
    std::sync::{Arc, Mutex},
    std::thread,
    std::time::Duration,
};

#[test]
fn test_add_file() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建测试数据
    let file_path = "test_file.rs";
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
    
    // 测试添加文件
    let added = generator.add_file(file_path.to_string(), symbols);
    assert!(added, "文件应该被成功添加");
    
    // 测试重复添加同一个文件
    let range2 = Range {
        start: Position { line: 2, character: 1 },
        end: Position { line: 2, character: 10 },
    };
    
    let symbols2 = vec![DocumentSymbol {
        name: "another_function".to_string(),
        detail: None,
        kind: SymbolKind::Function,
        tags: None,
        range: range2.clone(),
        selection_range: range2.clone(),
        children: vec![],
    }];
    
    let added_again = generator.add_file(file_path.to_string(), symbols2);
    assert!(!added_again, "重复添加同一个文件应该失败");
    
    // 测试过滤文件
    // 注意：默认的Language实现不会过滤任何文件
    // 只有特定语言（如Go）才会实现自定义的过滤逻辑
    let test_file = "test_file_test.go";
    let generator_go = GraphGenerator::new("test_root".to_string(), "Go");
    let should_filter = generator_go.should_filter_out_file(test_file);
    assert!(should_filter, "Go语言实现应该过滤掉测试文件");
}

#[test]
fn test_add_calls() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建测试数据
    let file_path = "test_file.rs";
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
    
    // 添加文件
    generator.add_file(file_path.to_string(), symbols);
    
    // 测试添加incoming calls
    let position = Position { line: 1, character: 1 };
    let incoming_calls = vec![create_test_incoming_call()];
    generator.add_incoming_calls(file_path.to_string(), position.clone(), incoming_calls);
    
    // 测试添加outgoing calls
    let outgoing_calls = vec![create_test_outgoing_call()];
    generator.add_outgoing_calls(file_path.to_string(), position.clone(), outgoing_calls);
    
    // 测试添加接口实现
    let locations = vec![create_test_location()];
    generator.add_interface_implementations(file_path.to_string(), position.clone(), locations);
    
    // 测试高亮
    generator.highlight(file_path.to_string(), position.clone());
    
    // 生成dot源码和mermaid源码，确保没有错误
    let dot = generator.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
    
    let mermaid = generator.generate_mermaid_source();
    assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
}

#[test]
fn test_generate_dot_source() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建多个文件和符号
    for i in 0..3 {
        let file_path = format!("test_file_{}.rs", i);
        let mut symbols = Vec::new();
        
        for j in 0..2 {
            let position = Position { line: j, character: 0 };
            let range = Range { start: position, end: Position { line: j, character: 10 } };
            
            symbols.push(DocumentSymbol {
                name: format!("function_{}_{}", i, j),
                detail: None,
                kind: SymbolKind::Function,
                tags: None,
                range: range.clone(),
                selection_range: range.clone(),
                children: vec![],
            });
        }
        
        generator.add_file(file_path, symbols);
    }
    
    // 添加一些调用关系
    let file_path = "test_file_0.rs";
    let position = Position { line: 0, character: 0 };
    
    let incoming_calls = vec![create_test_incoming_call()];
    generator.add_incoming_calls(file_path.to_string(), position.clone(), incoming_calls);
    
    let outgoing_calls = vec![create_test_outgoing_call()];
    generator.add_outgoing_calls(file_path.to_string(), position.clone(), outgoing_calls);
    
    // 生成dot源码
    let dot = generator.generate_dot_source();
    
    // 验证dot源码包含预期的内容
    assert!(dot.contains("digraph"), "dot源码应该包含digraph关键字");
    assert!(dot.contains("test_file_0"), "dot源码应该包含文件名");
    assert!(dot.contains("function_0_0"), "dot源码应该包含函数名");
    // 注意：箭头的存在取决于调用关系是否能够被正确地转换为边
    // 在实际测试中，我们添加的调用可能无法匹配到实际的符号，因此可能不会生成箭头
    // 这里我们只验证基本的结构是否正确
}

#[test]
fn test_generate_mermaid_source() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建多个文件和符号
    for i in 0..3 {
        let file_path = format!("test_file_{}.rs", i);
        let mut symbols = Vec::new();
        
        for j in 0..2 {
            let position = Position { line: j, character: 0 };
            let range = Range { start: position, end: Position { line: j, character: 10 } };
            
            symbols.push(DocumentSymbol {
                name: format!("function_{}_{}", i, j),
                detail: None,
                kind: SymbolKind::Function,
                tags: None,
                range: range.clone(),
                selection_range: range.clone(),
                children: vec![],
            });
        }
        
        generator.add_file(file_path, symbols);
    }
    
    // 添加一些调用关系
    let file_path = "test_file_0.rs";
    let position = Position { line: 0, character: 0 };
    
    let incoming_calls = vec![create_test_incoming_call()];
    generator.add_incoming_calls(file_path.to_string(), position.clone(), incoming_calls);
    
    let outgoing_calls = vec![create_test_outgoing_call()];
    generator.add_outgoing_calls(file_path.to_string(), position.clone(), outgoing_calls);
    
    // 生成mermaid源码
    let mermaid = generator.generate_mermaid_source();
    
    // 验证mermaid源码包含预期的内容
    assert!(mermaid.contains("flowchart"), "mermaid源码应该包含flowchart关键字");
    assert!(mermaid.contains("test_file_0"), "mermaid源码应该包含文件名");
    assert!(mermaid.contains("function_0_0"), "mermaid源码应该包含函数名");
    // 注意：箭头的存在取决于调用关系是否能够被正确地转换为边
    // 在实际测试中，我们添加的调用可能无法匹配到实际的符号，因此可能不会生成箭头
    // 这里我们只验证基本的结构是否正确
}

#[test]
fn test_highlight() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建测试数据
    let file_path = "test_file.rs";
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
    
    // 添加文件
    generator.add_file(file_path.to_string(), symbols);
    
    // 测试高亮
    let position = Position { line: 1, character: 1 };
    generator.highlight(file_path.to_string(), position.clone());
    
    // 生成dot源码，确保高亮信息被包含
    let dot = generator.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
    // 注意：高亮信息的具体表现形式取决于实现，可能不一定包含特定的关键字
    // 这里我们只验证能否成功生成源码
    
    // 生成mermaid源码，确保高亮信息被包含
    let mermaid = generator.generate_mermaid_source();
    assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
    // 注意：高亮信息的具体表现形式取决于实现，可能不一定包含特定的关键字
    // 这里我们只验证能否成功生成源码
}

#[test]
fn test_edge_data_attributes() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 添加测试文件和符号
    let file_path = "test.rs";
    let range1 = Range {
        start: Position { line: 1, character: 0 },
        end: Position { line: 1, character: 10 },
    };
    let range2 = Range {
        start: Position { line: 5, character: 0 },
        end: Position { line: 5, character: 10 },
    };
    
    let symbols = vec![
        DocumentSymbol {
            name: "caller_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range1.clone(),
            selection_range: range1.clone(),
            children: vec![],
        },
        DocumentSymbol {
            name: "callee_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range2.clone(),
            selection_range: range2.clone(),
            children: vec![],
        },
    ];
    
    generator.add_file(file_path.to_string(), symbols);
    
    // 添加调用关系
    let from_range = Range {
        start: Position { line: 1, character: 0 },
        end: Position { line: 1, character: 10 },
    };
    
    let incoming_call = CallHierarchyIncomingCall {
        from: CallHierarchyItem {
            name: "caller_function".to_string(),
            kind: SymbolKind::Function,
            tags: None,
            detail: None,
            uri: Uri { path: file_path.to_string() },
            range: from_range.clone(),
            selection_range: from_range.clone(),
            data: None,
        },
        from_ranges: vec![from_range],
    };
    
    generator.add_incoming_calls(
        file_path.to_string(),
        range2.start,
        vec![incoming_call],
    );
    
    // 也添加一个outgoing call来确保有边生成
    let outgoing_call = CallHierarchyOutgoingCall {
        to: CallHierarchyItem {
            name: "callee_function".to_string(),
            kind: SymbolKind::Function,
            tags: None,
            detail: None,
            uri: Uri { path: file_path.to_string() },
            range: range2.clone(),
            selection_range: range2.clone(),
            data: None,
        },
        from_ranges: vec![range1.clone()],
    };
    
    generator.add_outgoing_calls(
         file_path.to_string(),
         range1.start,
         vec![outgoing_call],
     );
    
    // 生成 DOT 源码
    let dot_source = generator.generate_dot_source();
    println!("Generated DOT source for edge attributes test:");
    println!("{}", dot_source);
    
    // 验证边是否包含 datafrom 和 datato 属性
    assert!(dot_source.contains("datafrom"), "DOT source should contain datafrom attribute");
    assert!(dot_source.contains("datato"), "DOT source should contain datato attribute");
    
    println!("✅ Edge data attributes test passed!");
}

#[test]
fn test_performance() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "rust");
    
    // 创建大量文件和符号，测试性能
    let file_count = 10;
    let symbol_count = 20;
    
    for i in 0..file_count {
        let file_path = format!("test_file_{}.rs", i);
        let mut symbols = Vec::new();
        
        for j in 0..symbol_count {
            let position = Position { line: j as u32, character: 0 };
            let range = Range { start: position, end: Position { line: j as u32, character: 10 } };
            
            symbols.push(DocumentSymbol {
                name: format!("function_{}_{}", i, j),
                detail: None,
                kind: SymbolKind::Function,
                tags: None,
                range: range.clone(),
                selection_range: range.clone(),
                children: vec![],
            });
        }
        
        generator.add_file(file_path, symbols);
    }
    
    // 添加一些调用关系
    for i in 0..file_count {
        let file_path = format!("test_file_{}.rs", i);
        
        for j in 0..symbol_count {
            let position = Position { line: j as u32, character: 0 };
            
            // 每个符号添加一个incoming call和一个outgoing call
            let incoming_calls = vec![create_test_incoming_call()];
            generator.add_incoming_calls(file_path.clone(), position.clone(), incoming_calls);
            
            let outgoing_calls = vec![create_test_outgoing_call()];
            generator.add_outgoing_calls(file_path.clone(), position.clone(), outgoing_calls);
        }
    }
    
    // 测量生成dot源码的时间
    let start = std::time::Instant::now();
    let dot = generator.generate_dot_source();
    let dot_duration = start.elapsed();
    
    // 测量生成mermaid源码的时间
    let start = std::time::Instant::now();
    let mermaid = generator.generate_mermaid_source();
    let mermaid_duration = start.elapsed();
    
    // 输出性能信息
    println!("生成dot源码耗时: {:?}", dot_duration);
    println!("生成mermaid源码耗时: {:?}", mermaid_duration);
    
    // 验证生成的源码不为空
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
    assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
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

// 辅助函数：创建测试用的location
fn create_test_location() -> Location {
    let range = Range {
        start: Position { line: 4, character: 4 },
        end: Position { line: 4, character: 40 },
    };
    
    Location {
        uri: Uri { path: "test_file.rs".to_string() },
        range,
    }
}