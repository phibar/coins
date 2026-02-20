"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DeleteCoinButton({ coinId }: { coinId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coins/${coinId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Münze gelöscht");
      router.push("/collection");
    } catch {
      toast.error("Fehler beim Löschen");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Lösche..." : "Ja, löschen"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={deleting}
        >
          Abbrechen
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-red-600 hover:text-red-700"
      onClick={() => setConfirming(true)}
    >
      Löschen
    </Button>
  );
}
