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

export const customers: Customer[] = Array.from({ length: 1_000 }, (_, index) => {
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

const statuses = ["Packed", "In transit", "Delivered", "Awaiting review"];

export const orders: Order[] = Array.from({ length: 1_500 }, (_, index) => {
  const customer = customers[(index * 7 + 13) % customers.length]!;
  return {
    id: `order-${index + 1}`,
    reference: `VS-${String(index + 1).padStart(5, "0")}`,
    customer: customer.name,
    status: statuses[index % statuses.length]!,
    total: new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(24 + ((index * 37) % 850)),
  };
});
