import { Appbar } from "../components/appbar";
import { Hero } from "../components/hero";

export default function Home() {
  return (
    <div className="flex items-center justify-center h-screen w-screen ">
      <Appbar />
      <Hero />
    </div>
  );
}
