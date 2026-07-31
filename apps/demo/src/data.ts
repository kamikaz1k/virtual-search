export interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
}

export interface Order {
  id: string;
  reference: string;
  customer: string;
  status: string;
  total: string;
}

export interface DemoDataset {
  customers: readonly Customer[];
  orders: readonly Order[];
  total: number;
}

const firstNames = [
  "Mara", "Jonas", "Alice", "Sofía", "Kenji", "Nadia", "Theo", "Imani",
  "Luc", "Mei", "Owen", "Zara",
];

const lastNames = [
  "Bell", "Okafor", "Chen", "Dubois", "Singh", "Martínez", "Ito", "Klein",
];

const cities = [
  "Montréal", "Lagos", "Kyoto", "Lisbon", "Oslo", "Seoul", "Valparaíso",
];

const statuses = ["Packed", "In transit", "Delivered", "Awaiting review"];
const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});
const formattedTotals = Array.from({ length: 850 }, (_, index) =>
  currencyFormatter.format(24 + index)
);

function createCustomers(count: number): Customer[] {
  return Array.from({ length: count }, (_, index) => {
    const firstName = firstNames[index % firstNames.length]!;
    const lastName = lastNames[(index * 3) % lastNames.length]!;
    const slug = `${firstName}.${lastName}.${index + 1}`.toLowerCase();

    return {
      id: `customer-${index + 1}`,
      name: `${firstName} ${lastName}`,
      email: `${slug}@example.test`,
      city: cities[(index * 5) % cities.length]!,
    };
  });
}

function createOrders(count: number, customers: readonly Customer[]): Order[] {
  return Array.from({ length: count }, (_, index) => {
    const customer = customers[(index * 7 + 13) % customers.length]!;
    return {
      id: `order-${index + 1}`,
      reference: `VS-${String(index + 1).padStart(5, "0")}`,
      customer: customer.name,
      status: statuses[index % statuses.length]!,
      total: formattedTotals[(index * 37) % formattedTotals.length]!,
    };
  });
}

function createDataset(customerCount: number, orderCount: number): DemoDataset {
  const customers = createCustomers(customerCount);
  const orders = createOrders(orderCount, customers);
  return {
    customers,
    orders,
    total: customerCount + orderCount,
  };
}

export const standardDataset = createDataset(1_000, 1_500);

let stressDataset: DemoDataset | undefined;

export function getStressDataset(): DemoDataset {
  stressDataset ??= createDataset(40_000, 60_000);
  return stressDataset;
}
