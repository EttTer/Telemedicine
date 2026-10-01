"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { pragueLocal } from "@/lib/schedule";
export function DaySelector({
  day,
  path = "/dashboard",
  allowAll = false,
}: {
  day: string;
  path?: string;
  allowAll?: boolean;
}) {
  const router = useRouter();
  const go = (v: string) => router.push(v ? `${path}?day=${v}` : path);
  const shift = (n: number) =>
    go(
      new Date(Date.parse(day || pragueLocal().slice(0, 10)) + n * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => shift(-1)}
        aria-label="Předchozí den"
      >
        ←
      </Button>
      <label className="flex items-center gap-2">
        Den{" "}
        <input
          aria-label="Den konzultací"
          type="date"
          value={day}
          onChange={(e) => {
            if (e.target.value) go(e.target.value);
          }}
          className="border rounded p-2"
        />
      </label>
      <Button
        variant="secondary"
        onClick={() => shift(1)}
        aria-label="Další den"
      >
        →
      </Button>
      <Button variant="ghost" onClick={() => go(pragueLocal().slice(0, 10))}>
        Dnes
      </Button>
      {allowAll && (
        <Button variant="ghost" onClick={() => go("")}>
          Všechny dny
        </Button>
      )}
    </div>
  );
}
