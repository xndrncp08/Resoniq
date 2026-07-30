import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import ExampleTones from "@/components/landing/ExampleTones";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <ExampleTones />
      <Pricing />
      <Testimonials />
      <Footer />
    </main>
  );
}
