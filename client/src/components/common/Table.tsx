// TODO: implement Table component
interface TableProps { children?: React.ReactNode; [key: string]: any; }
export default function Table({ children, ...props }: TableProps) {
  return <div {...props}>{children}</div>;
}
