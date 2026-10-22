import AppShell from "@/components/app/AppShell";
import MotionProvider from "@/components/providers/MotionProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider><AppShell>{children}</AppShell></MotionProvider>;
}
