import AppShell from "@/components/app/AppShell";
import MotionProvider from "@/components/providers/MotionProvider";
import { UnsavedChangesProvider } from "@/components/app/UnsavedChanges";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider><UnsavedChangesProvider><AppShell>{children}</AppShell></UnsavedChangesProvider></MotionProvider>;
}
