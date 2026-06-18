import { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  className: string;
  iconBg: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  iconBg,
}: StatCardProps) {
  return (
    <div className={cn(" rounded-2xl p-6 overflow-hidden bg-white", className)}>
      <div className="flex space-x-2  items-center">
        <Icon className="w-5 h-5 " />
        <p className="text-md font-medium ">{title}</p>
      </div>
      {description && <p className="text-xs  pt-1">{description}</p>}
      <p className="text-4xl font-bold">{value}</p>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl p-6 overflow-hidden bg-white animate-pulse">
      <div className="flex items-center gap-2">
        <div className="size-5 rounded bg-gray-200" />
        <div className="h-4 w-28 rounded bg-gray-200" />
      </div>

      <div className="mt-2 h-3 w-36 rounded bg-gray-200" />

      <div className="mt-3 h-8 w-24 rounded bg-gray-200" />
    </div>
  );
}
