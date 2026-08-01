# Virtual Search v1 contract

Virtual Search replaces the page-level Cmd/Ctrl+F experience with a
data-backed, native-like search controller. It searches ordinary DOM content
and records that are not currently mounted by virtualized lists.

## Observable behavior

- Matching is literal, case-insensitive, NFC-normalized, and occurrence-based.
- Match offsets use UTF-16 code units.
- A new query selects the first match in document order.
- Opening, reopening, or refocusing search preserves the active occurrence
  without navigating or scrolling.
- Next and previous navigation wrap at the document boundaries.
- Registered virtual regions occupy the position of their anchor element.
- Units inside a virtual region use the application's current item order.
- Static DOM inside a registered virtual region is not searched a second time.
- The complete occurrence count includes unmounted records.
- Selecting an unmounted occurrence reveals its record before locating,
  highlighting, and scrolling to the rendered range.
- The active match and all mounted inactive matches are highlighted when the
  CSS Custom Highlight API is available.
- Custom regions may locate explicit ranges inside shadow roots. Visibility
  validation follows the composed tree through each shadow host.
- Virtual Search never inserts highlight styles into application-owned
  documents or shadow roots. A best-effort diagnostic warns once when an
  explicit shadow range does not appear visibly styled.
- Empty queries produce no matches.

## Initial searchable content policy

- Visible ordinary DOM and registered virtual-region data participate.
- `script`, `style`, `template`, `noscript`, hidden, inert, and explicitly
  non-rendered subtrees do not participate.
- Form-control values, iframes, and implicit traversal of shadow roots are
  outside the initial scope. Custom regions can index and locate shadow content
  explicitly.
- A match can span rendered text nodes in one logical text part.
- A match does not span named parts, records, or search regions.
- DOM order, not CSS visual order, controls navigation order.

## Data updates

Virtual records have stable keys and transient order positions. When content or
ordering changes, the active query runs again. The controller preserves the
active occurrence when its stable identity still exists; otherwise it selects
the nearest following occurrence.

Search and navigation operations are abortable. Results from stale operations
never change selection, highlights, focus, or scroll position.

## Explicit non-goals

- Reusing or reading the browser's native Find UI.
- Fuzzy, ranked, regular-expression, or remote search.
- Cross-iframe, nested-region, or implicit shadow-root search.
- Exact replication of every browser's whitespace and hidden-content rules.
- Forcing every virtualized record to mount for passive highlighting.
