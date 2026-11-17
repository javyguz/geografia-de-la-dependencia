"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StateData } from "@/lib/data";
import { sectorsWithData } from "@/lib/data";
import type { ViewState } from "@/lib/url-state";
import { indicatorById, isBivariate, type Resolved } from "@/lib/view";

interface Option {
  value: string;
  label: string;
}

function Pick({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

interface Props {
  data: StateData;
  resolved: Resolved;
  onChange: (patch: Partial<ViewState>) => void;
}

export function Controls({ data, resolved, onChange }: Props) {
  const { layer, indicator, indicator2, sector, year } = resolved;
  const bivariate = isBivariate(layer);
  const names = (ids: string[] | undefined): Option[] =>
    (ids ?? []).map((id) => ({
      value: id,
      label: indicatorById(data, id)?.name ?? id,
    }));

  const layers = data.catalog.layers.map((l) => ({
    value: l.id,
    label: l.question,
  }));
  const sectors = sectorsWithData(
    data.catalog,
    data.values,
    indicator.id,
    year,
  ).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const years = indicator.years.map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <div className="flex flex-col gap-2">
      <Pick
        label="Capa"
        value={layer.id}
        options={layers}
        // A new layer starts from its own defaults.
        onChange={(id) =>
          onChange({
            layer: id,
            indicator: null,
            indicator2: null,
            sector: "total",
            year: null,
          })
        }
        className="w-full font-medium"
      />
      {bivariate ? (
        <div className="flex flex-col gap-2">
          <Pick
            label="Integración externa"
            value={indicator.id}
            options={names(layer.integration)}
            onChange={(id) => onChange({ indicator: id })}
            className="w-full"
          />
          <Pick
            label="Condiciones de trabajo"
            value={indicator2?.id ?? ""}
            options={names(layer.conditions)}
            onChange={(id) => onChange({ indicator2: id })}
            className="w-full"
          />
        </div>
      ) : (
        <>
          <Pick
            label="Indicador"
            value={indicator.id}
            options={names(layer.indicators)}
            onChange={(id) => onChange({ indicator: id, year: null })}
            className="w-full"
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Pick
              label="Sector"
              value={sector}
              options={sectors}
              onChange={(id) => onChange({ sector: id })}
              disabled={!indicator.by_sector}
              className="w-full"
            />
            <Pick
              label="Año"
              value={String(year)}
              options={years}
              onChange={(y) => onChange({ year: Number(y) })}
              disabled={years.length < 2}
            />
          </div>
        </>
      )}
    </div>
  );
}
