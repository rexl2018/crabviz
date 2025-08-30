//! Graph model data structures for structured call graph representation
//! This module provides an alternative to DOT-based generation for better frontend interaction

use {
    crate::lsp_types,
    serde::Serialize,
    serde_repr::Serialize_repr,
    std::hash::{Hash, Hasher},
};

/// Serializable position structure for graph model
#[derive(Debug, Serialize, Clone)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

impl From<lsp_types::Position> for Position {
    fn from(pos: lsp_types::Position) -> Self {
        Self {
            line: pos.line,
            character: pos.character,
        }
    }
}

/// Serializable range structure for graph model
#[derive(Debug, Serialize, Clone)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

impl From<lsp_types::Range> for Range {
    fn from(range: lsp_types::Range) -> Self {
        Self {
            start: Position::from(range.start),
            end: Position::from(range.end),
        }
    }
}

/// Serializable symbol kind for graph model
#[derive(Debug, Serialize, Clone, Copy)]
#[repr(u8)]
pub enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26,
}

impl From<lsp_types::SymbolKind> for SymbolKind {
    fn from(kind: lsp_types::SymbolKind) -> Self {
        match kind {
            lsp_types::SymbolKind::File => SymbolKind::File,
            lsp_types::SymbolKind::Module => SymbolKind::Module,
            lsp_types::SymbolKind::Namespace => SymbolKind::Namespace,
            lsp_types::SymbolKind::Package => SymbolKind::Package,
            lsp_types::SymbolKind::Class => SymbolKind::Class,
            lsp_types::SymbolKind::Method => SymbolKind::Method,
            lsp_types::SymbolKind::Property => SymbolKind::Property,
            lsp_types::SymbolKind::Field => SymbolKind::Field,
            lsp_types::SymbolKind::Constructor => SymbolKind::Constructor,
            lsp_types::SymbolKind::Enum => SymbolKind::Enum,
            lsp_types::SymbolKind::Interface => SymbolKind::Interface,
            lsp_types::SymbolKind::Function => SymbolKind::Function,
            lsp_types::SymbolKind::Variable => SymbolKind::Variable,
            lsp_types::SymbolKind::Constant => SymbolKind::Constant,
            lsp_types::SymbolKind::String => SymbolKind::String,
            lsp_types::SymbolKind::Number => SymbolKind::Number,
            lsp_types::SymbolKind::Boolean => SymbolKind::Boolean,
            lsp_types::SymbolKind::Array => SymbolKind::Array,
            lsp_types::SymbolKind::Object => SymbolKind::Object,
            lsp_types::SymbolKind::Key => SymbolKind::Key,
            lsp_types::SymbolKind::Null => SymbolKind::Null,
            lsp_types::SymbolKind::EnumMember => SymbolKind::EnumMember,
            lsp_types::SymbolKind::Struct => SymbolKind::Struct,
            lsp_types::SymbolKind::Event => SymbolKind::Event,
            lsp_types::SymbolKind::Operator => SymbolKind::Operator,
            lsp_types::SymbolKind::TypeParameter => SymbolKind::TypeParameter,
        }
    }
}

/// Main graph structure containing files and their relationships
#[derive(Debug, Serialize, Clone)]
pub struct Graph {
    pub files: Vec<File>,
    pub relations: Vec<Relation>,
}

/// Represents a source file with its symbols
#[derive(Debug, Serialize, Clone)]
pub struct File {
    pub id: u32,
    pub path: String,
    pub symbols: Vec<Symbol>,
}

/// Represents a symbol (function, class, etc.) within a file
#[derive(Debug, Serialize, Clone)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub range: Range,
    pub children: Vec<Symbol>,
    pub global_position: GlobalPosition,
}

/// Represents a relationship between two symbols
#[derive(Debug, Clone, Serialize)]
pub struct Relation {
    pub from: GlobalPosition,
    pub to: GlobalPosition,
    pub kind: RelationKind,
}

impl Hash for Relation {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.from.hash(state);
        self.to.hash(state);
    }
}

impl PartialEq for Relation {
    fn eq(&self, other: &Self) -> bool {
        self.from == other.from && self.to == other.to
    }
}

impl Eq for Relation {}

/// Types of relationships between symbols
#[derive(Debug, Clone, Serialize_repr)]
#[repr(u8)]
pub enum RelationKind {
    Call = 1,
    Impl = 2,
    Inherit = 3,
}

/// Global position that uniquely identifies a symbol across files
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalPosition {
    pub file_id: u32,
    pub line: u32,
    pub character: u32,
}

impl GlobalPosition {
    pub fn new(file_id: u32, position: lsp_types::Position) -> Self {
        Self {
            file_id,
            line: position.line,
            character: position.character,
        }
    }
    
    pub fn from_range_start(file_id: u32, range: &lsp_types::Range) -> Self {
        Self::new(file_id, range.start)
    }
}

/// Graph builder for constructing graph models from generator data
pub struct GraphBuilder {
    files: Vec<File>,
    relations: Vec<Relation>,
    file_id_map: std::collections::HashMap<String, u32>,
    next_file_id: u32,
}

impl GraphBuilder {
    pub fn new() -> Self {
        Self {
            files: Vec::new(),
            relations: Vec::new(),
            file_id_map: std::collections::HashMap::new(),
            next_file_id: 1,
        }
    }
    
    pub fn add_file(&mut self, path: String, symbols: Vec<crate::lsp_types::DocumentSymbol>) -> u32 {
        let file_id = self.next_file_id;
        self.next_file_id += 1;
        
        let graph_symbols = self.convert_symbols(file_id, &symbols);
        
        let file = File {
            id: file_id,
            path: path.clone(),
            symbols: graph_symbols,
        };
        
        self.files.push(file);
        self.file_id_map.insert(path, file_id);
        
        file_id
    }
    
    pub fn add_relation(&mut self, from: GlobalPosition, to: GlobalPosition, kind: RelationKind) {
        let relation = Relation { from, to, kind };
        if !self.relations.contains(&relation) {
            self.relations.push(relation);
        }
    }
    
    pub fn build(self) -> Graph {
        Graph {
            files: self.files,
            relations: self.relations,
        }
    }
    
    pub fn get_file_id(&self, path: &str) -> Option<u32> {
        self.file_id_map.get(path).copied()
    }
    
    fn convert_symbols(&self, file_id: u32, symbols: &[crate::lsp_types::DocumentSymbol]) -> Vec<Symbol> {
        symbols.iter().map(|symbol| self.convert_symbol(file_id, symbol)).collect()
    }
    
    fn convert_symbol(&self, file_id: u32, symbol: &lsp_types::DocumentSymbol) -> Symbol {
        let global_position = GlobalPosition::from_range_start(file_id, &symbol.selection_range);
        
        Symbol {
            name: symbol.name.clone(),
            kind: SymbolKind::from(symbol.kind),
            range: Range::from(symbol.range),
            children: self.convert_symbols(file_id, &symbol.children),
            global_position,
        }
    }
}

impl Default for GraphBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Search functionality for Graph model
impl Graph {
    /// Search for symbols by name with optional filters
    pub fn search_symbols(&self, query: &str, case_sensitive: bool) -> Vec<SearchResult> {
        let mut results = Vec::new();
        let search_query = if case_sensitive { query.to_string() } else { query.to_lowercase() };
        
        for file in &self.files {
            self.search_symbols_in_file(file, &search_query, case_sensitive, &mut results);
        }
        
        results
    }
    
    /// Search for symbols by type
    pub fn search_by_symbol_kind(&self, kind: SymbolKind) -> Vec<SearchResult> {
        let mut results = Vec::new();
        
        for file in &self.files {
            self.search_by_kind_in_file(file, kind, &mut results);
        }
        
        results
    }
    
    /// Search for files by path
    pub fn search_files(&self, query: &str, case_sensitive: bool) -> Vec<FileSearchResult> {
        let search_query = if case_sensitive { query.to_string() } else { query.to_lowercase() };
        
        self.files.iter()
            .filter(|file| {
                let file_path = if case_sensitive { file.path.clone() } else { file.path.to_lowercase() };
                file_path.contains(&search_query)
            })
            .map(|file| FileSearchResult {
                file_id: file.id,
                file_path: file.path.clone(),
                match_type: FileMatchType::Path,
            })
            .collect()
    }
    
    /// Get all relations involving a specific symbol
    pub fn get_symbol_relations(&self, global_pos: GlobalPosition) -> Vec<&Relation> {
        self.relations.iter()
            .filter(|relation| relation.from == global_pos || relation.to == global_pos)
            .collect()
    }
    
    fn search_symbols_in_file(&self, file: &File, query: &str, case_sensitive: bool, results: &mut Vec<SearchResult>) {
        for symbol in &file.symbols {
            self.search_symbol_recursive(file, symbol, query, case_sensitive, results);
        }
    }
    
    fn search_symbol_recursive(&self, file: &File, symbol: &Symbol, query: &str, case_sensitive: bool, results: &mut Vec<SearchResult>) {
        let symbol_name = if case_sensitive { symbol.name.clone() } else { symbol.name.to_lowercase() };
        
        if symbol_name.contains(query) {
            results.push(SearchResult {
                file_id: file.id,
                file_path: file.path.clone(),
                symbol_name: symbol.name.clone(),
                symbol_kind: symbol.kind,
                global_position: symbol.global_position,
                match_type: MatchType::SymbolName,
                range: symbol.range.clone(),
            });
        }
        
        // Search in child symbols
        for child in &symbol.children {
            self.search_symbol_recursive(file, child, query, case_sensitive, results);
        }
    }
    
    fn search_by_kind_in_file(&self, file: &File, target_kind: SymbolKind, results: &mut Vec<SearchResult>) {
        for symbol in &file.symbols {
            self.search_by_kind_recursive(file, symbol, target_kind, results);
        }
    }
    
    fn search_by_kind_recursive(&self, file: &File, symbol: &Symbol, target_kind: SymbolKind, results: &mut Vec<SearchResult>) {
        if std::mem::discriminant(&symbol.kind) == std::mem::discriminant(&target_kind) {
            results.push(SearchResult {
                file_id: file.id,
                file_path: file.path.clone(),
                symbol_name: symbol.name.clone(),
                symbol_kind: symbol.kind,
                global_position: symbol.global_position,
                match_type: MatchType::SymbolKind,
                range: symbol.range.clone(),
            });
        }
        
        // Search in child symbols
        for child in &symbol.children {
            self.search_by_kind_recursive(file, child, target_kind, results);
        }
    }
}

/// Search result for symbols
#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub file_id: u32,
    pub file_path: String,
    pub symbol_name: String,
    pub symbol_kind: SymbolKind,
    pub global_position: GlobalPosition,
    pub match_type: MatchType,
    pub range: Range,
}

/// Search result for files
#[derive(Debug, Serialize, Clone)]
pub struct FileSearchResult {
    pub file_id: u32,
    pub file_path: String,
    pub match_type: FileMatchType,
}

/// Type of match found in search
#[derive(Debug, Serialize, Clone)]
pub enum MatchType {
    SymbolName,
    SymbolKind,
    FilePath,
}

/// Type of file match
#[derive(Debug, Serialize, Clone)]
pub enum FileMatchType {
    Path,
    Name,
}