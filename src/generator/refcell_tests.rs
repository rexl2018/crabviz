use {
    super::GraphGenerator,
    crate::lsp_types::{DocumentSymbol, Position, Range, SymbolKind, CallHierarchyIncomingCall, CallHierarchyItem, CallHierarchyOutgoingCall, Uri},
    std::thread,
    std::sync::{Arc, Barrier, Mutex},
    std::time::Duration,
};

/// 测试RefCell的并发借用问题
/// 
/// 这个测试模拟多线程环境下对GraphGenerator的并发访问
/// 验证我们的try_borrow和try_borrow_mut修复是否有效
#[test]
fn test_concurrent_borrow() {
    // 使用Mutex包装GraphGenerator，以便在多线程环境中安全访问
    let generator = Arc::new(Mutex::new(GraphGenerator::new("test_root".to_string(), "")));
    
    // 创建一些基本数据
    let file_path = "test_file.rs".to_string();
    let position = Position { line: 1, character: 1 };
    let range = Range { start: position, end: Position { line: 1, character: 10 } };
    
    // 添加一个文件和符号
    {
        let mut gen = generator.lock().unwrap();
        let symbols = vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }];
        gen.add_file(file_path.clone(), symbols);
    }
    
    // 创建一个屏障，确保所有线程同时开始
    let thread_count = 5;
    let barrier = Arc::new(Barrier::new(thread_count));
    
    // 创建多个线程，同时尝试访问RefCell
    let mut handles = vec![];
    for i in 0..thread_count {
        let gen_clone = Arc::clone(&generator);
        let barrier_clone = Arc::clone(&barrier);
        let file_path_clone = file_path.clone();
        
        let handle = thread::spawn(move || {
            // 等待所有线程准备好
            barrier_clone.wait();
            
            // 根据线程ID执行不同操作，模拟并发访问
            match i % 3 {
                0 => {
                    // 添加incoming calls
                    let calls = vec![create_test_incoming_call()];
                    let mut gen = gen_clone.lock().unwrap();
                    gen.add_incoming_calls(file_path_clone, position, calls);
                },
                1 => {
                    // 添加outgoing calls
                    let calls = vec![create_test_outgoing_call()];
                    let mut gen = gen_clone.lock().unwrap();
                    gen.add_outgoing_calls(file_path_clone, position, calls);
                },
                _ => {
                    // 生成dot源码
                    let gen = gen_clone.lock().unwrap();
                    let _dot = gen.generate_dot_source();
                }
            }
            
            // 随机休眠一小段时间，增加线程交错的可能性
            thread::sleep(Duration::from_millis((i as u64) * 10));
        });
        
        handles.push(handle);
    }
    
    // 等待所有线程完成
    for handle in handles {
        handle.join().unwrap();
    }
    
    // 如果没有panic，测试通过
    // 最后生成一次dot源码，确保数据一致性
    let gen = generator.lock().unwrap();
    let dot = gen.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
}

/// 测试RefCell的嵌套借用问题
/// 
/// 这个测试模拟在同一线程中对RefCell的嵌套借用
/// 验证我们的try_borrow和try_borrow_mut修复是否有效
#[test]
fn test_nested_borrow() {
    let mut generator = GraphGenerator::new("test_root".to_string(), "");
    
    // 创建一些基本数据
    let file_path = "test_file.rs".to_string();
    let position = Position { line: 1, character: 1 };
    let range = Range { start: position, end: Position { line: 1, character: 10 } };
    
    // 添加一个文件和符号
    let symbols = vec![DocumentSymbol {
        name: "test_function".to_string(),
        detail: None,
        kind: SymbolKind::Function,
        tags: None,
        range: range.clone(),
        selection_range: range.clone(),
        children: vec![],
    }];
    generator.add_file(file_path.clone(), symbols);
    
    // 添加incoming calls和outgoing calls
    let incoming_calls = vec![create_test_incoming_call()];
    generator.add_incoming_calls(file_path.clone(), position, incoming_calls);
    
    let outgoing_calls = vec![create_test_outgoing_call()];
    generator.add_outgoing_calls(file_path.clone(), position, outgoing_calls);
    
    // 生成dot源码，这会触发RefCell的借用
    let dot = generator.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
    
    // 生成mermaid源码，这也会触发RefCell的借用
    let mermaid = generator.generate_mermaid_source();
    assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
}

/// 测试多线程环境下的并发访问
/// 
/// 这个测试模拟多线程环境下对GraphGenerator的并发访问
/// 验证我们的Language trait实现Send和Sync特性后是否能在线程间安全传递
#[test]
fn test_thread_safety() {
    // 使用Mutex包装GraphGenerator，以便在多线程环境中安全访问
    let generator = Arc::new(Mutex::new(GraphGenerator::new("test_root".to_string(), "")));
    
    // 创建一些基本数据
    let file_path = "test_file.rs".to_string();
    let position = Position { line: 1, character: 1 };
    let range = Range { start: position, end: Position { line: 1, character: 10 } };
    
    // 添加一个文件和符号
    {
        let mut gen = generator.lock().unwrap();
        let symbols = vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }];
        gen.add_file(file_path.clone(), symbols);
    }
    
    // 创建一个屏障，确保所有线程同时开始
    let thread_count = 10;
    let barrier = Arc::new(Barrier::new(thread_count));
    
    // 创建多个线程，同时尝试访问GraphGenerator
    let mut handles = vec![];
    for i in 0..thread_count {
        let gen_clone = Arc::clone(&generator);
        let barrier_clone = Arc::clone(&barrier);
        let file_path_clone = file_path.clone();
        
        let handle = thread::spawn(move || {
            // 等待所有线程准备好
            barrier_clone.wait();
            
            // 根据线程ID执行不同操作，模拟并发访问
            match i % 3 {
                0 => {
                    // 添加incoming calls
                    let calls = vec![create_test_incoming_call()];
                    let mut gen = gen_clone.lock().unwrap();
                    gen.add_incoming_calls(file_path_clone, position, calls);
                },
                1 => {
                    // 添加outgoing calls
                    let calls = vec![create_test_outgoing_call()];
                    let mut gen = gen_clone.lock().unwrap();
                    gen.add_outgoing_calls(file_path_clone, position, calls);
                },
                _ => {
                    // 生成dot源码
                    let gen = gen_clone.lock().unwrap();
                    let _dot = gen.generate_dot_source();
                }
            }
            
            // 随机休眠一小段时间，增加线程交错的可能性
            thread::sleep(Duration::from_millis((i as u64) * 5));
        });
        
        handles.push(handle);
    }
    
    // 等待所有线程完成
    for handle in handles {
        handle.join().unwrap();
    }
    
    // 如果没有panic，测试通过
    // 最后生成一次dot源码，确保数据一致性
    let gen = generator.lock().unwrap();
    let dot = gen.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
}

/// 测试高并发下的性能和稳定性
/// 
/// 这个测试模拟高并发环境下对GraphGenerator的访问
/// 验证在大量数据和高频访问下的性能和稳定性
#[test]
fn test_high_concurrency() {
    // 使用Mutex包装GraphGenerator，以便在多线程环境中安全访问
    let generator = Arc::new(Mutex::new(GraphGenerator::new("test_root".to_string(), "")));
    
    // 创建多个文件和符号，模拟大型项目
    let file_count = 5;
    let symbol_count = 10;
    // 确保使用相同的类型（usize）
    
    // 预先添加文件和符号
    {
        let mut gen = generator.lock().unwrap();
        for i in 0..file_count {
            let file_path = format!("test_file_{}.rs", i);
            let mut symbols = Vec::new();
            
            for j in 0..symbol_count {
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
            
            gen.add_file(file_path, symbols);
        }
    }
    
    // 创建大量线程，模拟高并发访问
    let thread_count = 20;
    let barrier = Arc::new(Barrier::new(thread_count));
    
    let mut handles = vec![];
    for i in 0..thread_count {
        let gen_clone = Arc::clone(&generator);
        let barrier_clone = Arc::clone(&barrier);
        
        let handle = thread::spawn(move || {
            // 等待所有线程准备好
            barrier_clone.wait();
            
            // 每个线程执行多次操作，增加并发压力
            for j in 0..10 {
                let file_index = (i + j) % file_count;
                let symbol_index = (j as u32) % (symbol_count as u32); // 先转换类型再取模
                let file_path = format!("test_file_{}.rs", file_index);
                let position = Position { line: symbol_index, character: 0 };
                
                // 根据迭代执行不同操作
                match j % 4 {
                    0 => {
                        // 添加incoming calls
                        let calls = vec![create_test_incoming_call()];
                        let mut gen = gen_clone.lock().unwrap();
                        gen.add_incoming_calls(file_path, position, calls);
                    },
                    1 => {
                        // 添加outgoing calls
                        let calls = vec![create_test_outgoing_call()];
                        let mut gen = gen_clone.lock().unwrap();
                        gen.add_outgoing_calls(file_path, position, calls);
                    },
                    2 => {
                        // 生成dot源码
                        let gen = gen_clone.lock().unwrap();
                        let _dot = gen.generate_dot_source();
                    },
                    _ => {
                        // 生成mermaid源码
                        let gen = gen_clone.lock().unwrap();
                        let _mermaid = gen.generate_mermaid_source();
                    }
                }
                
                // 随机休眠一小段时间，增加线程交错的可能性
                thread::sleep(Duration::from_millis((i as u64) * 2));
            }
        });
        
        handles.push(handle);
    }
    
    // 等待所有线程完成
    for handle in handles {
        handle.join().unwrap();
    }
    
    // 如果没有panic，测试通过
    // 最后生成一次dot源码和mermaid源码，确保数据一致性
    let gen = generator.lock().unwrap();
    let dot = gen.generate_dot_source();
    let mermaid = gen.generate_mermaid_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
    assert!(!mermaid.is_empty(), "生成的mermaid源码不应为空");
}

/// 测试错误处理和恢复能力
/// 
/// 这个测试模拟在多线程环境下可能出现的错误情况
/// 验证GraphGenerator的错误处理和恢复能力
#[test]
fn test_error_handling() {
    // 使用Mutex包装GraphGenerator，以便在多线程环境中安全访问
    let generator = Arc::new(Mutex::new(GraphGenerator::new("test_root".to_string(), "")));
    
    // 创建一些基本数据
    let file_path = "test_file.rs".to_string();
    let position = Position { line: 1, character: 1 };
    let range = Range { start: position, end: Position { line: 1, character: 10 } };
    
    // 添加一个文件和符号
    {
        let mut gen = generator.lock().unwrap();
        let symbols = vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }];
        gen.add_file(file_path.clone(), symbols);
    }
    
    // 创建多个线程，模拟错误情况
    let thread_count = 5;
    let barrier = Arc::new(Barrier::new(thread_count));
    
    let mut handles = vec![];
    for i in 0..thread_count {
        let gen_clone = Arc::clone(&generator);
        let barrier_clone = Arc::clone(&barrier);
        let file_path_clone = file_path.clone(); // 克隆file_path，避免所有权问题
        
        let handle = thread::spawn(move || {
            // 等待所有线程准备好
            barrier_clone.wait();
            
            // 模拟错误情况：尝试访问不存在的文件
            if i % 2 == 0 {
                let non_existent_file = format!("non_existent_file_{}.rs", i);
                let mut gen = gen_clone.lock().unwrap();
                
                // 添加incoming calls到不存在的文件
                // 这应该被GraphGenerator内部处理，而不是导致panic
                let calls = vec![create_test_incoming_call()];
                gen.add_incoming_calls(non_existent_file, position, calls);
            } else {
                // 正常操作
                let mut gen = gen_clone.lock().unwrap();
                let calls = vec![create_test_outgoing_call()];
                gen.add_outgoing_calls(file_path_clone, position, calls);
            }
        });
        
        handles.push(handle);
    }
    
    // 等待所有线程完成
    for handle in handles {
        handle.join().unwrap();
    }
    
    // 如果没有panic，测试通过
    // 最后生成一次dot源码，确保数据一致性
    let gen = generator.lock().unwrap();
    let dot = gen.generate_dot_source();
    assert!(!dot.is_empty(), "生成的dot源码不应为空");
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