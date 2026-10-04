import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import ExampleTones from "@/components/landing/ExampleTones";
import FreeAccess from "@/components/landing/FreeAccess";
import RouteStage from "@/components/motion/RouteStage";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <RouteStage>
      <main className="relative">
        <Hero />
        <Features />
        <HowItWorks />
        <ExampleTones />
        <FreeAccess />
        <Footer />
      </main>
    </RouteStage>
  );
}