"use client";

import { XIcon } from "lucide-react";
import { Figure, nameOf } from "@/components/indicator-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Data } from "@/lib/data";
import { paragraphs, STEPS } from "@/lib/tour";
import type { Resolved } from "@/lib/view";

interface Props {
  data: Data;
  resolved: Resolved;
  step: number;
  territory: string | null;
  onStep: (index: number) => void;
  onExit: () => void;
  onCounterargument: () => void;
}

export function TourPanel({
  data,
  resolved,
  step,
  territory,
  onStep,
  onExit,
  onCounterargument,
}: Props) {
  const index = Math.min(step, STEPS.length - 1);
  const current = STEPS[index];
  if (!current) return null;
  const last = index === STEPS.length - 1;

  return (
    <section aria-label="Recorrido" className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Recorrido, paso {index + 1} de {STEPS.length}
          </p>
          <h2 className="text-2xl">{current.title}</h2>
          {current.draft && (
            <Badge variant="outline" className="w-fit">
              Texto provisional
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onExit}
          aria-label="Salir del recorrido"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        {paragraphs(current.text).map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>

      {/* The figures of a step come from the data, never from its text. */}
      {territory && (
        <>
          <Separator />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{nameOf(data, territory)}</p>
            <Figure
              data={data}
              indicator={resolved.indicator}
              territory={territory}
              year={resolved.year}
              sector={resolved.sector}
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => onStep(index - 1)}
        >
          Anterior
        </Button>
        {last ? (
          <>
            <Button onClick={onCounterargument}>
              Abrir el contraargumento
            </Button>
            <Button variant="outline" onClick={onExit}>
              Explorar por mi cuenta
            </Button>
          </>
        ) : (
          <Button onClick={() => onStep(index + 1)}>Siguiente</Button>
        )}
      </div>
    </section>
  );
}
