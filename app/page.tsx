import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <Header />
      <HomeClient />
      <Footer />
    </div>
  );
}
