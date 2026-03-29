// TODO: implement Modal component
interface ModalProps { children?: React.ReactNode; [key: string]: any; }
export default function Modal({ children, ...props }: ModalProps) {
  return <div {...props}>{children}</div>;
}
