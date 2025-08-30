use {
    super::CssClass,
    crate::graph::{Cell, Edge, Subgraph, TableNode},
    enumset::EnumSet,
    std::iter,
};

pub(crate) fn escape_html(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("\"", "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
}
const EMPTY_STRING: String = String::new();

// Color scheme from crabviz-ref
const BG_COLOR: &str = "#f5fffa";
const SELECTED_COLOR: &str = "#4fe1f4";

const EDGE_COLOR: &str = "#548f9e";
const EDGE_INCOMING_COLOR: &str = "#698b69";
const EDGE_OUTGOING_COLOR: &str = "#008acd";
const EDGE_INCOMING_OUTGOING_COLOR: &str = "#2c3e50";

const CLUSTER_LABEL_BG_COLOR: &str = "#f8f9fa";

const NODE_BG_COLOR: &str = "#f4f5f1";

const SYMBOL_DEFAULT_BG_COLOR: &str = NODE_BG_COLOR;
const SYMBOL_DEFAULT_BORDER_COLOR: &str = "#6c757d";
const SYMBOL_DEFAULT_TEXT_COLOR: &str = "#363636";

const INTERFACE_BG_COLOR: &str = "#fff8dc";
const INTERFACE_BORDER_COLOR: &str = "#a69348";

const MODULE_BG_COLOR: &str = "#ffebcd";
const MODULE_BORDER_COLOR: &str = "#a67e43";

const CONSTRUCTOR_BG_COLOR: &str = "#ffdab9";
const CONSTRUCTOR_BORDER_COLOR: &str = "#a66e3c";

const METHOD_BG_COLOR: &str = "#fff8c5";
const METHOD_BORDER_COLOR: &str = "#d4a72c";

const FUNCTION_BG_COLOR: &str = "#e8f5e8";
const FUNCTION_BORDER_COLOR: &str = "#7cb342";

const STRUCT_BG_COLOR: &str = "#ddf4ff";
const STRUCT_BORDER_COLOR: &str = "#54aeff";

const TYPE_ICON_COLOR: &str = "#8969da";
const PROPERTY_ICON_COLOR: &str = "#5f9348";

pub(crate) struct Dot;

impl Dot {
    pub fn generate_dot_source<T, E>(
        tables: T,
        // nodes: &[Node],
        edges: E,
        subgraphs: &[Subgraph],
    ) -> String
    where
        T: Iterator<Item = TableNode>,
        E: Iterator<Item = Edge>,
    {
        let tables = tables
            .map(|table| {
                format!(
                    r#"
    "{id}" [id="{id}", label=<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="8" CELLPADDING="4">
        <TR><TD WIDTH="230" BORDER="0" CELLPADDING="6" HREF="{path}">{title}</TD></TR>
        {sections}
        <TR><TD CELLSPACING="0" HEIGHT="1" WIDTH="1" FIXEDSIZE="TRUE" STYLE="invis"></TD></TR>
        </TABLE>
    >];
                    "#,
                    id = table.id,
                    path = table.path.as_deref().unwrap_or("remove_me_url.title"),
                    title = table.title,
                    sections = table
                        .sections
                        .iter()
                        .map(|node| Dot::process_cell(table.id, node))
                        .collect::<Vec<_>>()
                        .join("\n"),
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            r#"
digraph {{
    graph [
        rankdir = "LR"
        ranksep = 2.0
        fontname = "Arial"
        bgcolor = "{}"
    ];
    node [
        fontsize = "16"
        fontname = "Arial"
        shape = "plaintext"
        style = "rounded, filled"
        fillcolor = "{}"
        color = "{}"
    ];
    edge [
        label = " "
        color = "{}"
    ];

    {}

    {}

    {}
}}
            "#,
            BG_COLOR,
            NODE_BG_COLOR,
            SYMBOL_DEFAULT_BORDER_COLOR,
            EDGE_COLOR,
            tables,
            Dot::clusters(subgraphs),
            Dot::process_edges(edges),
        )
    }

    fn process_cell(table_id: u32, cell: &Cell) -> String {
        let styles = [
            cell.style
                .border
                .map_or(String::new(), |b| format!(r#"BORDER="{}""#, b)),
            cell.style
                .rounded
                .then_some(r#"STYLE="ROUNDED""#.to_string())
                .unwrap_or(String::new()),
        ]
        .join(" ");

        let title = format!(
            "{}{}",
            cell.style
                .icon
                .map(|c| format!("<B>{}</B>  ", c))
                .unwrap_or(EMPTY_STRING),
            escape_html(&cell.title)
        );
        let port = format!("{}_{}", cell.range_start.0, cell.range_start.1);

        if cell.children.is_empty() {
            let href = if let Some(kind) = cell.symbol_kind {
                format!(r#"href="{}""#, kind as u8)
            } else {
                Dot::css_classes_href(cell.style.classes)
            };
            format!(
                r#"     <TR><TD PORT="{port}" ID="{table_id}:{port}" {styles} {href}>{title}</TD></TR>"#,
                port = port,
                table_id = table_id,
                styles = styles,
                href = href,
                title = title
            )
        } else {
            let (cell_styles, table_styles) = (r#"BORDER="0""#.to_string(), styles);

            let dot_cell = format!(
                r#"     <TR><TD PORT="{port}" {cell_styles}>{title}</TD></TR>"#,
                port = port,
                cell_styles = cell_styles,
                title = title
            );

            let href = if let Some(kind) = cell.symbol_kind {
                format!(r#"href="{}""#, kind as u8)
            } else {
                Dot::css_classes_href(cell.style.classes)
            };

            format!(
                r#"
            <TR><TD BORDER="0" CELLPADDING="0">
            <TABLE ID="{table_id}:{port}" CELLSPACING="8" CELLPADDING="4" CELLBORDER="1" {table_styles} BGCOLOR="{bg_color}" {href}>
            {content}
            </TABLE>
            </TD></TR>
            "#,
                table_id = table_id,
                port = port,
                table_styles = table_styles,
                bg_color = FUNCTION_BG_COLOR,
                href = href,
                content = iter::once(dot_cell)
                     .chain(
                         cell.children
                             .iter()
                             .map(|item| Dot::process_cell(table_id, item))
                     )
                     .collect::<Vec<_>>()
                     .join("\n"),
            )
        }
    }

    fn process_edges<E>(edges: E) -> String
    where
        E: Iterator<Item = Edge>,
    {
        edges
            .map(|edge| {
                let from = format!(r#"{}:"{}_{}""#, edge.from.0, edge.from.1, edge.from.2);
                let to = format!(r#"{}:"{}_{}""#, edge.to.0, edge.to.1, edge.to.2);

                let from_id = format!("{}:{}_{}", edge.from.0, edge.from.1, edge.from.2);
                let to_id = format!("{}:{}_{}", edge.to.0, edge.to.1, edge.to.2);
                
                let attrs = iter::once(format!(
                    r#"id="{} -> {}""#,
                    from_id, to_id
                ))
                .chain(iter::once(format!(
                    r#"datafrom="{}""#,
                    from_id
                )))
                .chain(iter::once(format!(
                    r#"datato="{}""#,
                    to_id
                )))
                .chain(iter::once(Dot::css_classes(edge.classes)))
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>();

                format!("{} -> {} [{}];", from, to, attrs.join(", "))
            })
            .collect::<Vec<_>>()
            .join("\n    ")
    }

    fn clusters(subgraphs: &[Subgraph]) -> String {
        subgraphs
            .iter()
            .map(|subgraph| {
                format!(
                    r#"
        subgraph "cluster_{}" {{
            label = "{}";
            style = "filled";
            fillcolor = "{}";
            color = "{}";

            {}

            {}
        }};
                    "#,
                    subgraph.title,
                    subgraph.title,
                    CLUSTER_LABEL_BG_COLOR,
                    SYMBOL_DEFAULT_BORDER_COLOR,
                    subgraph.nodes.join(" "),
                    Dot::clusters(&subgraph.subgraphs),
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn css_classes(classes: EnumSet<CssClass>) -> String {
        if classes.is_empty() {
            "".to_string()
        } else {
            format!(
                r#"class="{}""#,
                classes
                    .iter()
                    .map(|c| c.to_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            )
        }
    }

    fn css_classes_href(classes: EnumSet<CssClass>) -> String {
        if classes.is_empty() {
            "".to_string()
        } else {
            format!(
                r#"href="remove_me_url.{}""#,
                classes
                    .iter()
                    .map(|c| c.to_str())
                    .collect::<Vec<_>>()
                    .join(".")
            )
        }
    }
}
