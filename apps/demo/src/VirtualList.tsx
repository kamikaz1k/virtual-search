import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useVirtualSearchController,
  useVirtualSearchRegion,
  type VirtualSearchRegionBinding,
} from "virtual-search/react";
import { tanstackVirtualAdapter } from "virtual-search/tanstack";
import type { Customer, Order } from "./data";

function useMediaQuery(query: string, fallback: boolean) {
  const [matches, setMatches] = useState(() =>
    typeof globalThis.matchMedia === "function"
      ? globalThis.matchMedia(query).matches
      : fallback
  );

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return;
    const mediaQuery = globalThis.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function useDesktopSearchParts(regionId: string) {
  const searchController = useVirtualSearchController();
  const enabled = useMediaQuery("(min-width: 761px)", true);

  useEffect(() => {
    void searchController.invalidate(regionId);
  }, [enabled, regionId, searchController]);

  return enabled;
}

interface ListShellProps {
  eyebrow: string;
  title: string;
  count: number;
  children: React.ReactNode;
}

function ListShell({ eyebrow, title, count, children }: ListShellProps) {
  return (
    <section className="list-section">
      <header className="list-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="record-count">{count.toLocaleString()} records</span>
      </header>
      {children}
    </section>
  );
}

function VirtualSurface<Item>({
  id,
  items,
  estimateSize,
  getKey,
  getSearchParts,
  renderRow,
}: {
  id: string;
  items: readonly Item[];
  estimateSize: number;
  getKey(item: Item): string;
  getSearchParts(item: Item): readonly { id: string; text: string }[];
  renderRow(item: Item, search: VirtualSearchRegionBinding): React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
  });
  const search = useVirtualSearchRegion({
    id,
    anchorRef: scrollRef,
    items,
    getKey,
    getSearchParts,
    virtualizer: tanstackVirtualAdapter(virtualizer),
  });

  return (
    <div
      ref={scrollRef}
      {...search.regionProps}
      className="virtual-surface"
      data-testid={`${id}-region`}
    >
      <div
        className="virtual-track"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={getKey(item)}
              {...search.itemProps(getKey(item))}
              ref={virtualizer.measureElement}
              className="virtual-row"
              data-index={virtualRow.index}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderRow(item, search)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomerList({ items }: { items: readonly Customer[] }) {
  const showEmail = useDesktopSearchParts("customers");

  return (
    <ListShell eyebrow="Registry A" title="Customer directory" count={items.length}>
      <VirtualSurface
        id="customers"
        items={items}
        estimateSize={68}
        getKey={customer => customer.id}
        getSearchParts={customer => [
          { id: "name", text: customer.name },
          ...(showEmail
            ? [{ id: "email", text: customer.email }]
            : []),
          { id: "city", text: customer.city },
        ]}
        renderRow={(customer, search) => (
          <>
            <span className="row-index">
              {customer.id.replace("customer-", "").padStart(4, "0")}
            </span>
            <strong {...search.partProps(customer.id, "name")}>
              {customer.name}
            </strong>
            <span {...search.partProps(customer.id, "email")}>
              {customer.email}
            </span>
            <span
              {...search.partProps(customer.id, "city")}
              className="row-meta"
            >
              {customer.city}
            </span>
          </>
        )}
      />
    </ListShell>
  );
}

export function OrderList({ items }: { items: readonly Order[] }) {
  const showStatus = useDesktopSearchParts("orders");

  return (
    <ListShell eyebrow="Registry B" title="Order ledger" count={items.length}>
      <VirtualSurface
        id="orders"
        items={items}
        estimateSize={68}
        getKey={order => order.id}
        getSearchParts={order => [
          { id: "reference", text: order.reference },
          { id: "customer", text: order.customer },
          ...(showStatus
            ? [{ id: "status", text: order.status }]
            : []),
          { id: "total", text: order.total },
        ]}
        renderRow={(order, search) => (
          <>
            <span
              {...search.partProps(order.id, "reference")}
              className="order-reference"
            >
              {order.reference}
            </span>
            <strong {...search.partProps(order.id, "customer")}>
              {order.customer}
            </strong>
            <span
              {...search.partProps(order.id, "status")}
              className="status"
            >
              {order.status}
            </span>
            <span
              {...search.partProps(order.id, "total")}
              className="row-meta"
            >
              {order.total}
            </span>
          </>
        )}
      />
    </ListShell>
  );
}
