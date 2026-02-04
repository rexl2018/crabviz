#[cfg(test)]
mod test {
    use crate::{
        generator::GraphGenerator,
        types::lsp::{DocumentSymbol, Position, Range, SymbolKind, CallHierarchyIncomingCall, CallHierarchyItem, Uri},
    };

#[test]
fn test_edge_data_attributes() {
    let mut generator = GraphGenerator::new("test".to_string(), "rust");

    // 添加一个简单的文件和符号
    let range = Range {
        start: Position { line: 1, character: 0 },
        end: Position { line: 1, character: 10 },
    };

    generator.add_file(
        "test.rs".to_string(),
        vec![DocumentSymbol {
            name: "test_function".to_string(),
            detail: None,
            kind: SymbolKind::Function,
            tags: None,
            range: range.clone(),
            selection_range: range.clone(),
            children: vec![],
        }],
    );

    // 添加一个调用关系
    let caller = CallHierarchyItem {
        name: "caller".to_string(),
        kind: SymbolKind::Function,
        tags: None,
        detail: None,
        uri: Uri { path: "test.rs".to_string() },
        range: range.clone(),
        selection_range: range.clone(),
        data: None,
    };

    let callee_range = Range {
        start: Position { line: 5, character: 0 },
        end: Position { line: 5, character: 10 },
    };

    let _callee = CallHierarchyItem {
        name: "callee".to_string(),
        kind: SymbolKind::Function,
        tags: None,
        detail: None,
        uri: Uri { path: "test.rs".to_string() },
        range: callee_range.clone(),
        selection_range: callee_range.clone(),
        data: None,
    };

    generator.add_incoming_calls(
        "test.rs".to_string(),
        Position { line: 5, character: 0 },
        vec![CallHierarchyIncomingCall {
            from: caller,
            from_ranges: vec![range],
        }],
    );

    // 生成 DOT 源码并打印
    let dot_source = generator.generate_dot_source();
    println!("Generated DOT source:");
    println!("{}", dot_source);

    // 检查是否包含 data-from 和 data-to 属性
    if dot_source.contains("data-from") && dot_source.contains("data-to") {
        println!("\n✅ SUCCESS: Edge data attributes are present!");
    } else {
        println!("\n❌ FAILED: Edge data attributes are missing!");
        if !dot_source.contains("data-from") {
            println!("   Missing: data-from attribute");
        }
        if !dot_source.contains("data-to") {
            println!("   Missing: data-to attribute");
        }
    }
}
}
