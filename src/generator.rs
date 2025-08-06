mod types;

#[cfg(feature = "wasm")]
mod wasm;
#[cfg(feature = "wasm")]
pub use wasm::{set_panic_hook, GraphGeneratorWasm};

#[cfg(test)]
mod tests;

pub(crate) use types::*;
use {
    crate::{
        graph::{dot::Dot, Cell, CssClass, Edge, Subgraph},
        lang,
        lsp_types::{
            CallHierarchyIncomingCall, CallHierarchyItem, CallHierarchyOutgoingCall,
            DocumentSymbol, Location, Position, SymbolKind,
        },
    },
    enumset::EnumSet,
    std::{
        cell::RefCell,
        collections::{hash_map::Entry, BTreeMap, HashMap, HashSet},
        path::{Path, PathBuf},
    },
};

pub struct GraphGenerator {
    // TODO: use a trie map to store files
    root: String,
    files: HashMap<String, FileOutline>,
    next_file_id: u32,

    lang: Box<dyn lang::Language>,

    incoming_calls: HashMap<SymbolLocation, Vec<CallHierarchyIncomingCall>>,
    outgoing_calls: HashMap<SymbolLocation, Vec<CallHierarchyOutgoingCall>>,
    interfaces: HashMap<SymbolLocation, Vec<SymbolLocation>>,

    highlights: HashMap<u32, HashSet<(u32, u32)>>,
}

impl GraphGenerator {
    pub fn new(root: String, lang: &str) -> Self {
        Self {
            root,
            files: HashMap::new(),
            next_file_id: 1,
            incoming_calls: HashMap::new(),
            outgoing_calls: HashMap::new(),
            interfaces: HashMap::new(),
            highlights: HashMap::new(),

            lang: lang::language_handler(lang),
        }
    }

    pub fn should_filter_out_file(&self, file_path: &str) -> bool {
        self.lang.should_filter_out_file(file_path)
    }

    pub fn add_file(&mut self, file_path: String, symbols: Vec<DocumentSymbol>) -> bool {
        if self.lang.should_filter_out_file(&file_path) {
            return false;
        }

        let file = FileOutline {
            id: self.next_file_id,
            path: PathBuf::from(&file_path),
            symbols,
        };

        match self.files.entry(file_path) {
            Entry::Vacant(entry) => {
                entry.insert(file);
                self.next_file_id += 1;
            }
            Entry::Occupied(_) => return false,
        }

        return true;
    }

    // TODO: graph database
    pub fn add_incoming_calls(
        &mut self,
        file_path: String,
        position: Position,
        calls: Vec<CallHierarchyIncomingCall>,
    ) {
        let location = SymbolLocation::new(file_path, &position);
        self.incoming_calls.insert(location, calls);
    }

    pub fn add_outgoing_calls(
        &mut self,
        file_path: String,
        position: Position,
        calls: Vec<CallHierarchyOutgoingCall>,
    ) {
        let location = SymbolLocation::new(file_path, &position);
        self.outgoing_calls.insert(location, calls);
    }

    pub fn highlight(&mut self, file_path: String, position: Position) {
        let file_id = match self.files.get(&file_path) {
            None => return,
            Some(file) => file.id,
        };

        let cell_pos = (position.line, position.character);

        match self.highlights.entry(file_id) {
            Entry::Vacant(entry) => {
                let mut set = HashSet::new();
                set.insert(cell_pos);

                entry.insert(set);
            }
            Entry::Occupied(mut entry) => {
                entry.get_mut().insert(cell_pos);
            }
        }
    }

    pub fn add_interface_implementations(
        &mut self,
        file_path: String,
        position: Position,
        locations: Vec<Location>,
    ) {
        let location = SymbolLocation::new(file_path, &position);
        let implementations = locations
            .into_iter()
            .map(|location| SymbolLocation::new(location.uri.path, &location.range.start))
            .collect();
        self.interfaces.insert(location, implementations);
    }

    pub fn generate_mermaid_source(&self) -> String {
        let files = &self.files;

        // 构建表格和单元格ID，与generate_dot_source类似
        let mut tables = files
            .values()
            .map(|file| {
                let mut table = self.lang.file_repr(file);
                if let Some(cells) = self.highlights.get(&file.id) {
                    table.highlight_cells(cells);
                }

                (file.id, table)
            })
            .collect::<HashMap<_, _>>();

        let mut cell_ids = HashSet::new();
        tables
            .iter()
            .flat_map(|(_, tbl)| tbl.sections.iter().map(|cell| (tbl.id, cell)))
            .for_each(|(tid, cell)| self.collect_cell_ids(tid, cell, &mut cell_ids));
        let cell_ids_ref = &cell_ids;

        let updated_files = RefCell::new(HashSet::new());
        let updated_files_ref = &updated_files;

        let inserted_symbols = RefCell::new(HashSet::new());
        let inserted_symbols_ref = &inserted_symbols;

        // 收集边，与generate_dot_source类似
        let incoming_calls = self
            .incoming_calls
            .iter()
            .filter_map(|(callee, callers)| {
                let to = callee.location_id(files)?;

                cell_ids.contains(&to).then_some((to, callers))
            })
            .flat_map(|(to, calls)| {
                calls.into_iter().filter_map(move |call| {
                    let from = call.from.location_id(files)?;

                    (cell_ids_ref.contains(&from)
                        || inserted_symbols_ref.borrow().contains(&from)
                        || {
                            let file = files.get(&call.from.uri.path)? as *const FileOutline;

                            let updated = unsafe {
                                self.try_insert_symbol(
                                    &call.from,
                                    file.cast_mut().as_mut().unwrap(),
                                )
                            };

                            if updated {
                                updated_files_ref
                                    .borrow_mut()
                                    .insert(call.from.uri.path.clone());
                                inserted_symbols_ref.borrow_mut().insert(from);
                            }
                            updated
                        })
                    .then_some(Edge {
                        from,
                        to,
                        classes: EnumSet::new(),
                    })
                })
            });

        let outgoing_calls = self
            .outgoing_calls
            .iter()
            .filter_map(|(caller, callees)| {
                let from = caller.location_id(files)?;

                cell_ids.contains(&from).then_some((from, callees))
            })
            .flat_map(|(from, callees)| {
                callees.into_iter().filter_map(move |call| {
                    let to = call.to.location_id(files)?;

                    cell_ids_ref.contains(&to).then_some(Edge {
                        from,
                        to,
                        classes: EnumSet::new(),
                    })
                })
            });

        let implementations = self
            .interfaces
            .iter()
            .filter_map(|(interface, implementations)| {
                let to = interface.location_id(files)?;

                cell_ids.contains(&to).then_some((to, implementations))
            })
            .flat_map(|(to, implementations)| {
                implementations.into_iter().filter_map(move |location| {
                    let from = location.location_id(files)?;

                    cell_ids_ref.contains(&&from).then_some(Edge {
                        from,
                        to,
                        classes: CssClass::Impl.into(),
                    })
                })
            });

        let edges = incoming_calls
            .chain(outgoing_calls)
            .chain(implementations)
            .collect::<HashSet<_>>();

        updated_files.borrow().iter().for_each(|path| {
            let file = files.get(path).unwrap();
            let table = tables.get_mut(&file.id).unwrap();
            *table = self.lang.file_repr(file);
        });

        // 生成Mermaid格式（使用带subgraph的版本）
        self.generate_mermaid_from_graph_with_subgraphs(tables.into_values().collect(), edges.into_iter().collect())
    }

    fn generate_mermaid_from_graph(&self, tables: Vec<crate::graph::TableNode>, edges: Vec<Edge>) -> String {
        // 生成Mermaid流程图
        let mut mermaid = String::from("flowchart LR\n");
        
        // 添加所有节点（不使用subgraph）
        for table in &tables {
            for section in &table.sections {
                self.add_mermaid_cell(table.id, section, &mut mermaid);
            }
        }
        
        // 添加边
        for edge in &edges {
            let from = format!("{}_{}_{}", edge.from.0, edge.from.1, edge.from.2);
            let to = format!("{}_{}_{}", edge.to.0, edge.to.1, edge.to.2);
            mermaid.push_str(&format!("    {} --> {}\n", from, to));
        }
        
        mermaid
    }
    
    fn generate_mermaid_from_graph_with_subgraphs(&self, tables: Vec<crate::graph::TableNode>, edges: Vec<Edge>) -> String {
        // 生成Mermaid流程图
        let mut mermaid = String::from("flowchart LR\n");
        
        // 创建文件到表格的映射
        let mut file_tables: HashMap<String, Vec<&crate::graph::TableNode>> = HashMap::new();
        let mut orphan_tables = Vec::new();
        
        // 将表格按文件分组
        for table in &tables {
            let file_path = self.files.iter()
                .find(|(_, file)| file.id == table.id)
                .map(|(path, _)| path.clone());
            
            if let Some(path) = file_path {
                file_tables.entry(path).or_default().push(table);
            } else {
                orphan_tables.push(table);
            }
        }
        
        // 创建目录到文件的映射
        let mut dir_files: HashMap<PathBuf, Vec<(String, Vec<&crate::graph::TableNode>)>> = HashMap::new();
        
        // 将文件按目录分组
        for (file_path, tables) in &file_tables {
            let path = Path::new(file_path);
            if let Some(parent) = path.parent() {
                let parent_path = parent.to_path_buf();
                dir_files.entry(parent_path).or_default().push((file_path.clone(), tables.clone()));
            } else {
                // 如果文件没有父目录，将其放入根目录组
                dir_files.entry(PathBuf::from("")).or_default().push((file_path.clone(), tables.clone()));
            }
        }
        
        // 为每个目录创建一个subgraph，然后在其中为每个文件创建一个subgraph
        let mut dir_index = 0;
        let root_path = Path::new(&self.root);
        
        for (dir_path, dir_files) in &dir_files {
            // 使用相对于项目根目录的目录路径作为subgraph标题，确保以"/"开头
            let dir_title = if dir_path.as_os_str().is_empty() {
                "/".to_string() // 根目录使用"/"作为标题
            } else if let Ok(relative) = dir_path.strip_prefix(root_path) {
                let rel_str = relative.to_string_lossy().to_string();
                if rel_str.is_empty() {
                    "/".to_string()
                } else {
                    format!("/{}" , rel_str)
                }
            } else {
                format!("/{}" , dir_path.to_string_lossy())
            };
            
            // 添加目录级subgraph开始标记 - 确保ID格式正确
            mermaid.push_str(&format!("    subgraph dir{} [\"{}\"]\n", dir_index, dir_title));
            
            // 为目录中的每个文件创建一个subgraph
            let mut file_index = 0;
            for (file_path, file_tables) in dir_files {
                // 使用相对于项目根目录的文件路径作为subgraph标题
                let path = Path::new(file_path);
                let file_title = if let Ok(relative) = path.strip_prefix(root_path) {
                    relative.to_string_lossy()
                } else {
                    path.to_string_lossy()
                };
                
                // 添加文件级subgraph开始标记 - 确保ID格式正确
                mermaid.push_str(&format!("        subgraph file{}_{} [\"{}\"]\n", dir_index, file_index, file_title));
                
                // 添加当前文件中的所有节点
                for table in file_tables {
                    for section in &table.sections {
                        self.add_mermaid_cell(table.id, section, &mut mermaid);
                    }
                }
                
                // 添加文件级subgraph结束标记
                mermaid.push_str("        end\n");
                
                file_index += 1;
            }
            
            // 添加目录级subgraph结束标记
            mermaid.push_str("    end\n");
            
            dir_index += 1;
        }
        
        // 添加未包含在任何文件中的节点
        for table in &orphan_tables {
            for section in &table.sections {
                self.add_mermaid_cell(table.id, section, &mut mermaid);
            }
        }
        
        // 添加边
        for edge in &edges {
            let from = format!("{}_{}_{}", edge.from.0, edge.from.1, edge.from.2);
            let to = format!("{}_{}_{}", edge.to.0, edge.to.1, edge.to.2);
            mermaid.push_str(&format!("    {} --> {}\n", from, to));
        }
        
        mermaid
    }
    
    fn add_mermaid_cell(&self, table_id: u32, cell: &Cell, mermaid: &mut String) {
        let id = format!("{}_{}_{}", table_id, cell.range_start.0, cell.range_start.1);
        let label = cell.title.replace('"', "\\\"").replace('[', "\\[").replace(']', "\\]");
        
        mermaid.push_str(&format!("    {}[\"{}\"]", id, label));
        
        // 添加样式
        if !cell.style.classes.is_empty() {
            let style_class = format!("{:?}", cell.style.classes.iter().next().unwrap()).to_lowercase();
            mermaid.push_str(&format!(":::{}\n", style_class));
        } else {
            mermaid.push_str("\n");
        }
        
        // 递归处理子节点
        for child in &cell.children {
            self.add_mermaid_cell(table_id, child, mermaid);
        }
    }
    


    pub fn generate_dot_source(&self) -> String {
        let files = &self.files;

        // TODO: it's better to construct tables before fetching call hierarchy, so that we can skip the filtered out symbols.
        let mut tables = files
            .values()
            .map(|file| {
                let mut table = self.lang.file_repr(file);
                if let Some(cells) = self.highlights.get(&file.id) {
                    table.highlight_cells(cells);
                }

                (file.id, table)
            })
            .collect::<HashMap<_, _>>();

        let mut cell_ids = HashSet::new();
        tables
            .iter()
            .flat_map(|(_, tbl)| tbl.sections.iter().map(|cell| (tbl.id, cell)))
            .for_each(|(tid, cell)| self.collect_cell_ids(tid, cell, &mut cell_ids));
        let cell_ids_ref = &cell_ids;

        let updated_files = RefCell::new(HashSet::new());
        let updated_files_ref = &updated_files;

        let inserted_symbols = RefCell::new(HashSet::new());
        let inserted_symbols_ref = &inserted_symbols;

        let incoming_calls = self
            .incoming_calls
            .iter()
            .filter_map(|(callee, callers)| {
                let to = callee.location_id(files)?;

                cell_ids.contains(&to).then_some((to, callers))
            })
            .flat_map(|(to, calls)| {
                calls.into_iter().filter_map(move |call| {
                    let from = call.from.location_id(files)?;

                    // incoming calls may start from nested functions, which may not be included in file symbols in some lsp server implementations.
                    // in that case, we add the missing nested symbol to the symbol list.
                    // another approach would be to modify edges to make them start from the outter functions, which is not so accurate

                    (cell_ids_ref.contains(&from)
                        || inserted_symbols_ref.borrow().contains(&from)
                        || {
                            let file = files.get(&call.from.uri.path)? as *const FileOutline;

                            let updated = unsafe {
                                self.try_insert_symbol(
                                    &call.from,
                                    file.cast_mut().as_mut().unwrap(),
                                )
                            };

                            if updated {
                                updated_files_ref
                                    .borrow_mut()
                                    .insert(call.from.uri.path.clone());
                                inserted_symbols_ref.borrow_mut().insert(from);
                            }
                            updated
                        })
                    .then_some(Edge {
                        from,
                        to,
                        classes: EnumSet::new(),
                    })
                })
            });

        let outgoing_calls = self
            .outgoing_calls
            .iter()
            .filter_map(|(caller, callees)| {
                let from = caller.location_id(files)?;

                cell_ids.contains(&from).then_some((from, callees))
            })
            .flat_map(|(from, callees)| {
                callees.into_iter().filter_map(move |call| {
                    let to = call.to.location_id(files)?;

                    cell_ids_ref.contains(&to).then_some(Edge {
                        from,
                        to,
                        classes: EnumSet::new(),
                    })
                })
            });

        let implementations = self
            .interfaces
            .iter()
            .filter_map(|(interface, implementations)| {
                let to = interface.location_id(files)?;

                cell_ids.contains(&to).then_some((to, implementations))
            })
            .flat_map(|(to, implementations)| {
                implementations.into_iter().filter_map(move |location| {
                    let from = location.location_id(files)?;

                    cell_ids_ref.contains(&&from).then_some(Edge {
                        from,
                        to,
                        classes: CssClass::Impl.into(),
                    })
                })
            });

        let edges = incoming_calls
            .chain(outgoing_calls)
            .chain(implementations)
            .collect::<HashSet<_>>();

        updated_files.borrow().iter().for_each(|path| {
            let file = files.get(path).unwrap();
            let table = tables.get_mut(&file.id).unwrap();
            *table = self.lang.file_repr(file);
        });

        let subgraphs = self.subgraphs(files.iter().map(|(_, f)| f));

        Dot::generate_dot_source(tables.into_values(), edges.into_iter(), &subgraphs)
    }

    fn subgraphs<'a, I>(&'a self, files: I) -> Vec<Subgraph>
    where
        I: Iterator<Item = &'a FileOutline>,
    {
        let mut dirs = BTreeMap::new();
        for f in files {
            let parent = f.path.parent().unwrap();
            dirs.entry(parent)
                .or_insert(Vec::new())
                .push(f.path.clone());
        }

        let mut subgraphs: Vec<Subgraph> = vec![];

        dirs.iter().for_each(|(dir, files)| {
            let nodes = files
                .iter()
                .map(|path| {
                    self.files
                        .get(path.to_str().unwrap())
                        .unwrap()
                        .id
                        .to_string()
                })
                .collect::<Vec<_>>();

            let dir = dir.strip_prefix(&self.root).unwrap_or(dir);
            self.add_subgraph(dir, nodes, &mut subgraphs);
        });

        subgraphs
    }

    fn add_subgraph<'a, 'b, 'c>(
        &'a self,
        dir: &'b Path,
        nodes: Vec<String>,
        subgraphs: &'c mut Vec<Subgraph>,
    ) {
        let ancestor = subgraphs.iter_mut().find(|g| dir.starts_with(&g.title));

        match ancestor {
            None => subgraphs.push(Subgraph {
                title: dir.to_str().unwrap().into(),
                nodes,
                subgraphs: vec![],
            }),
            Some(ancestor) => {
                let dir = dir.strip_prefix(&ancestor.title).unwrap();
                self.add_subgraph(dir, nodes, &mut ancestor.subgraphs);
            }
        }
    }

    fn collect_cell_ids(&self, table_id: u32, cell: &Cell, ids: &mut HashSet<(u32, u32, u32)>) {
        ids.insert((table_id, cell.range_start.0, cell.range_start.1));
        cell.children
            .iter()
            .for_each(|child| self.collect_cell_ids(table_id, child, ids));
    }

    fn try_insert_symbol(&self, item: &CallHierarchyItem, file: &mut FileOutline) -> bool {
        let mut symbols = &mut file.symbols;
        let mut is_subsymbol = false;

        loop {
            let i = match symbols
                .binary_search_by_key(&item.range.start, |symbol| symbol.range.start)
            {
                Ok(_) => return true, // should be unreachable
                Err(i) => i,
            };

            if i > 0 {
                let symbol = symbols.get(i - 1).unwrap();

                if symbol.range.end > item.range.end {
                    // we just deal with nested functions here
                    if !matches!(symbol.kind, SymbolKind::Function | SymbolKind::Method) {
                        return false;
                    }
                    is_subsymbol = true;

                    // fight the borrow checker
                    symbols = &mut symbols.get_mut(i - 1).unwrap().children;

                    continue;
                }
            }

            if is_subsymbol {
                let mut children = vec![];

                if let Some(next_symbol) = symbols.get(i) {
                    if next_symbol.range.start > item.range.start
                        && next_symbol.range.end < item.range.end
                    {
                        let next_symbol = symbols.remove(i);
                        children.push(next_symbol);
                    }
                }

                symbols.insert(
                    i,
                    DocumentSymbol {
                        name: item.name.clone(),
                        detail: item.detail.clone(),
                        kind: item.kind,
                        tags: item.tags.clone(),
                        range: item.range,
                        selection_range: item.selection_range,
                        children,
                    },
                );
            }

            return is_subsymbol;
        }
    }
}
