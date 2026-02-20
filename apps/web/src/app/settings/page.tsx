"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ServiceStatus {
  name: string;
  status: "ok" | "error";
  message?: string;
  details?: Record<string, string>;
}

interface HealthResponse {
  services: ServiceStatus[];
  allOk: boolean;
}

const SERVICE_LABELS: Record<string, { title: string; description: string }> = {
  camera: {
    title: "Kamera",
    description: "Sony Alpha 58 via gPhoto2",
  },
  s3: {
    title: "AWS S3",
    description: "Bildspeicher",
  },
  numista: {
    title: "Numista API",
    description: "Münzdatenbank",
  },
  database: {
    title: "Datenbank",
    description: "PostgreSQL",
  },
};

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/health");
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <Button
          variant="outline"
          onClick={runHealthCheck}
          disabled={checking}
        >
          {checking ? "Prüfe..." : "Alle prüfen"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["camera", "s3", "numista", "database"].map((name) => {
          const service = health?.services.find((s) => s.name === name);
          const label = SERVICE_LABELS[name];

          return (
            <Card key={name}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <StatusDot status={service?.status} loading={checking && !health} />
                  {label.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  {label.description}
                </p>

                {checking && !health && (
                  <p className="text-sm text-muted-foreground">Prüfe...</p>
                )}

                {service?.status === "ok" && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-600">Verbunden</p>
                    {service.details &&
                      Object.entries(service.details).map(([key, val]) => (
                        <p key={key} className="text-xs text-muted-foreground">
                          {key}: {val}
                        </p>
                      ))}
                  </div>
                )}

                {service?.status === "error" && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-600">Fehler</p>
                    {service.message && (
                      <p className="text-xs text-red-500 break-all">
                        {service.message}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration reference */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Konfiguration (.env)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "DATABASE_URL", label: "Datenbank-URL" },
              { key: "CAMERA_SERVICE_URL", label: "Kamera-Service URL" },
              { key: "COINS_AWS_ACCESS_KEY_ID", label: "AWS Access Key" },
              { key: "COINS_AWS_SECRET_ACCESS_KEY", label: "AWS Secret Key" },
              { key: "COINS_AWS_REGION", label: "AWS Region" },
              { key: "S3_BUCKET_NAME", label: "S3 Bucket" },
              { key: "NUMISTA_API_KEY", label: "Numista API Key" },
            ].map((v) => (
              <div
                key={v.key}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span className="text-sm">{v.label}</span>
                <code className="text-xs text-muted-foreground">{v.key}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusDot({
  status,
  loading,
}: {
  status?: "ok" | "error";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    );
  }
  if (status === "ok") {
    return <div className="h-3 w-3 rounded-full bg-green-500" />;
  }
  if (status === "error") {
    return <div className="h-3 w-3 rounded-full bg-red-500" />;
  }
  return <div className="h-3 w-3 rounded-full bg-gray-300" />;
}
