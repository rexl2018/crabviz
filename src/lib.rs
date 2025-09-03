mod generator;
mod graph;
mod graph_model;
mod lang;
mod lsp_types;

pub use generator::GraphGenerator;
pub use graph_model::{
    Graph, GraphBuilder, File, Symbol, Relation, RelationKind, GlobalPosition,
    SearchResult, FileSearchResult, MatchType, FileMatchType
};

// 当编译目标是wasm32时，使用wee_alloc作为全局分配器
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;
