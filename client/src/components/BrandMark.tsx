import { Droplets } from "lucide-react";
import { Link } from "wouter";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${light ? "text-white" : "text-slate-950"}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#0d4e7b,#2aa58d)] shadow-[0_8px_16px_rgba(13,78,123,0.18)]">
        <Droplets className="h-5 w-5 text-white" strokeWidth={2.4} />
      </span>
      <span className="text-[1.06rem]">Khalis Doodh</span>
    </Link>
  );
}
