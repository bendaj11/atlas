export interface ProductCountProps {
  count: number;
  label?: string;
}

export default function ProductCount({ count, label = "Products" }: ProductCountProps) {
  return <span>{label}: {count}</span>;
}
