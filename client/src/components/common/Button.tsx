// TODO: implement Button component
interface ButtonProps { children?: React.ReactNode; [key: string]: any; }
export default function Button({ children, ...props }: ButtonProps) {
  return <div {...props}>{children}</div>;
}
