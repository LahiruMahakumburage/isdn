// TODO: implement Pagination component
interface PaginationProps { children?: React.ReactNode; [key: string]: any; }
export default function Pagination({ children, ...props }: PaginationProps) {
  return <div {...props}>{children}</div>;
}
