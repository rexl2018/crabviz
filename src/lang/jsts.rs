use {
    super::Language,
    crate::lsp_types::{DocumentSymbol, SymbolKind},
};

pub(crate) struct Jsts;

impl Language for Jsts {
    fn filter_symbol(&self, symbol: &DocumentSymbol) -> bool {
        match symbol.kind {
            SymbolKind::Constant | SymbolKind::Variable | SymbolKind::EnumMember => false,
            SymbolKind::Function => {
                // Filter out callback functions and anonymous functions
                !(symbol.name.ends_with(" callback") || symbol.name == "<function>")
            }
            _ => true,
        }
    }
}