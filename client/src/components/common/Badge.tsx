// TODO: implement Badge component
interface BadgeProps { children?: React.ReactNode; [key: string]: any; }
export default function Badge({ children, ...props }: BadgeProps) {
  return <div {...props}>{children}</div>;
}
