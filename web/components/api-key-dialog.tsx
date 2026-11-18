"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: string) => void;
}

/** Asks for the visitor's own OpenRouter key and says plainly where it goes. */
export function ApiKeyDialog({ open, onOpenChange, onSave }: Props) {
  const [key, setKey] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!key.trim()) return;
            onSave(key.trim());
            setKey("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Tu clave de OpenRouter</DialogTitle>
            <DialogDescription>
              El asistente usa modelos de lenguaje gratuitos a través de
              OpenRouter, con tu propia clave. No se cobra nada, pero OpenRouter
              limita cuántas peticiones gratuitas puedes hacer al día, y cada
              pregunta usa varias.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
            <li>La clave se guarda solo en este navegador.</li>
            <li>
              Tus preguntas van directamente de tu navegador a OpenRouter; no
              pasan por ningún servidor de este sitio.
            </li>
            <li>Puedes borrarla con un clic desde el asistente.</li>
            <li>
              Los proveedores de modelos gratuitos pueden guardar las preguntas.
              No escribas datos personales.
            </li>
          </ul>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="openrouter-key">Clave</FieldLabel>
              <Input
                id="openrouter-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-or-…"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
              <FieldDescription>
                Si no tienes una, créala en{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline underline-offset-2"
                >
                  openrouter.ai/keys
                </a>
                .
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!key.trim()}>
              Guardar clave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
