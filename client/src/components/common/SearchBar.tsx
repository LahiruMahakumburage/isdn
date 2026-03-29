// TODO: implement SearchBar component
interface SearchBarProps { children?: React.ReactNode; [key: string]: any; }
export default function SearchBar({ children, ...props }: SearchBarProps) {
  return <div {...props}>{children}</div>;
}
