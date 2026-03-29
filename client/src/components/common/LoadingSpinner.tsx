// TODO: implement LoadingSpinner component
interface LoadingSpinnerProps { children?: React.ReactNode; [key: string]: any; }
export default function LoadingSpinner({ children, ...props }: LoadingSpinnerProps) {
  return <div {...props}>{children}</div>;
}
