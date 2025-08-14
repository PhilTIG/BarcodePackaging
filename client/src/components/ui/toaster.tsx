import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className={props.variant === "destructive" ? "bg-[#ffffff] border-red-200" : ""}>
            <div className="grid gap-1">
              {title && <ToastTitle className={props.variant === "destructive" ? "text-red-800" : ""}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={props.variant === "destructive" ? "text-red-700" : ""}>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
