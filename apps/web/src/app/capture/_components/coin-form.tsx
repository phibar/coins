"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CoinFormData } from "@/types/capture";
import { EMPTY_COIN_FORM } from "@/types/capture";
import { NumistaSearchDialog } from "./numista-search-dialog";
import { NumistaImageSearchDialog } from "./numista-image-search-dialog";
import { ZoomablePreview } from "./zoomable-preview";

const CONDITION_OPTIONS = [
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
  { value: "F", label: "F - Fine" },
  { value: "VF", label: "VF - Very Fine" },
  { value: "XF", label: "XF - Extra Fine" },
  { value: "AU", label: "AU - About Uncirculated" },
  { value: "UNC", label: "UNC - Uncirculated" },
  { value: "PROOF", label: "PROOF - Polierte Platte" },
];

interface CoinFormProps {
  defaults?: Partial<CoinFormData>;
  frontImageUrl?: string;
  backImageUrl?: string;
  onSave: (data: CoinFormData) => void;
  onSkip?: () => void;
  coinIndex?: number;
  totalCoins?: number;
  saving?: boolean;
}

export function CoinForm({
  defaults,
  frontImageUrl,
  backImageUrl,
  onSave,
  onSkip,
  coinIndex,
  totalCoins,
  saving,
}: CoinFormProps) {
  const initialValues = { ...EMPTY_COIN_FORM, ...defaults };
  const { register, handleSubmit, setValue, watch, getValues } =
    useForm<CoinFormData>({
      defaultValues: initialValues,
    });

  const condition = watch("condition");
  const isProof = watch("isProof");
  const isFirstDay = watch("isFirstDay");
  const hasCase = watch("hasCase");
  const hasCertificate = watch("hasCertificate");
  const numistaTitle = watch("numistaTitle");

  const handleNumistaSelect = (data: Partial<CoinFormData>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== "") {
        setValue(key as keyof CoinFormData, value as never);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      {/* Header with coin counter */}
      {totalCoins && totalCoins > 1 && (
        <div className="text-sm text-muted-foreground">
          Münze {(coinIndex ?? 0) + 1} von {totalCoins}
        </div>
      )}

      {/* Image previews */}
      {(frontImageUrl || backImageUrl) && (
        <div className="flex gap-4">
          {frontImageUrl && (
            <ZoomablePreview
              src={frontImageUrl}
              alt="Vorderseite"
              label="Vorderseite"
            />
          )}
          {backImageUrl && (
            <ZoomablePreview
              src={backImageUrl}
              alt="Rückseite"
              label="Rückseite"
            />
          )}
        </div>
      )}

      {/* Required fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Pflichtfelder
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="country">Land *</Label>
            <Input
              id="country"
              {...register("country", { required: true })}
              placeholder="z.B. Deutschland"
            />
          </div>
          <div>
            <Label htmlFor="denomination">Nominal *</Label>
            <Input
              id="denomination"
              {...register("denomination", { required: true })}
              placeholder="z.B. 1 DM"
            />
          </div>
          <div>
            <Label htmlFor="year">Prägejahr *</Label>
            <Input
              id="year"
              type="number"
              {...register("year", { required: true, valueAsNumber: true })}
              placeholder="z.B. 1970"
            />
          </div>
        </div>
      </div>

      {/* Numista search */}
      <div className="flex items-center gap-3">
        <NumistaSearchDialog
          currentFormData={getValues()}
          onSelect={handleNumistaSelect}
        >
          <Button type="button" variant="outline" size="sm">
            Numista-Suche
          </Button>
        </NumistaSearchDialog>
        {frontImageUrl && (
          <NumistaImageSearchDialog
            frontImageUrl={frontImageUrl}
            backImageUrl={backImageUrl}
            onSelect={handleNumistaSelect}
          >
            <Button type="button" variant="outline" size="sm">
              Bilderkennung
            </Button>
          </NumistaImageSearchDialog>
        )}
        {numistaTitle && (
          <span className="text-sm text-muted-foreground truncate">
            {numistaTitle}
          </span>
        )}
      </div>

      {/* Coin details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Münzdetails
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="mintMark">Prägeanstalt</Label>
            <Input
              id="mintMark"
              {...register("mintMark")}
              placeholder="z.B. D, F, G, J"
            />
          </div>
          <div>
            <Label htmlFor="material">Material</Label>
            <Input
              id="material"
              {...register("material")}
              placeholder="z.B. Silber 625"
            />
          </div>
          <div>
            <Label htmlFor="fineness">Feingehalt</Label>
            <Input
              id="fineness"
              {...register("fineness")}
              placeholder="z.B. 0.625"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="weight">Gewicht (g)</Label>
            <Input
              id="weight"
              {...register("weight")}
              placeholder="z.B. 15.5"
            />
          </div>
          <div>
            <Label htmlFor="diameter">Durchmesser (mm)</Label>
            <Input
              id="diameter"
              {...register("diameter")}
              placeholder="z.B. 32.5"
            />
          </div>
          <div>
            <Label htmlFor="thickness">Dicke (mm)</Label>
            <Input
              id="thickness"
              {...register("thickness")}
              placeholder="z.B. 2.1"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="edgeType">Randart</Label>
            <Input
              id="edgeType"
              {...register("edgeType")}
              placeholder="z.B. geriffelt"
            />
          </div>
          <div>
            <Label htmlFor="mintage">Auflage</Label>
            <Input
              id="mintage"
              {...register("mintage")}
              placeholder="z.B. 5000000"
            />
          </div>
          <div>
            <Label htmlFor="estimatedValue">Schätzwert (EUR)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              {...register("estimatedValue", { valueAsNumber: true })}
              placeholder="z.B. 25.00"
            />
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Zustand
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Erhaltung</Label>
            <Select
              value={condition}
              onValueChange={(val) => setValue("condition", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Erhaltung wählen" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isProof"
              checked={isProof}
              onCheckedChange={(checked) =>
                setValue("isProof", checked === true)
              }
            />
            <Label htmlFor="isProof">Polierte Platte</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isFirstDay"
              checked={isFirstDay}
              onCheckedChange={(checked) =>
                setValue("isFirstDay", checked === true)
              }
            />
            <Label htmlFor="isFirstDay">Ersttag</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasCase"
              checked={hasCase}
              onCheckedChange={(checked) =>
                setValue("hasCase", checked === true)
              }
            />
            <Label htmlFor="hasCase">Etui</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasCertificate"
              checked={hasCertificate}
              onCheckedChange={(checked) =>
                setValue("hasCertificate", checked === true)
              }
            />
            <Label htmlFor="hasCertificate">Zertifikat</Label>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Organisation
        </h3>
        <div>
          <Label htmlFor="storageLocation">Lagerort</Label>
          <Input
            id="storageLocation"
            {...register("storageLocation")}
            placeholder="z.B. Ordner 3, Seite 7"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notizen</Label>
          <Textarea
            id="notes"
            {...register("notes")}
            placeholder="Anmerkungen zur Münze..."
            rows={3}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Speichere..." : "Speichern"}
        </Button>
        {onSkip && (
          <Button type="button" variant="outline" onClick={onSkip}>
            Überspringen
          </Button>
        )}
      </div>
    </form>
  );
}
