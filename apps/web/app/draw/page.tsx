"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { ArrowLeft } from "lucide-react";
import { Canvas } from "../../components/canvas";

export default function DrawFreePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-50 via-teal-50 to-green-50 flex flex-col">
      <div className="p-4 flex items-center gap-3">
        <Button
          variant="fam"
          className="h-11"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-sm text-gray-600">Free draw (local only)</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Canvas roomId="free" socket={null} />
      </div>
    </div>
  );
}

