import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { unitLabel } from "@/lib/format";
import type { Catalog, Indicator } from "@/lib/types";
// Read at build time: the page is static HTML generated from the catalog, nothing loads at runtime.
import catalogFile from "@/public/data/catalog.json";

const catalog = catalogFile as Catalog;
const REPOSITORY = "https://github.com/javyguz/geografia-de-la-dependencia";

export const metadata: Metadata = {
  title: "Metodología · Geografía de la dependencia",
  description:
    "Definición, fórmula, fuente, años, cobertura y limitaciones de cada indicador del mapa.",
};

function byId(id: string): Indicator | undefined {
  return catalog.indicators.find((i) => i.id === id);
}

function levels(indicator: Indicator): string {
  return indicator.levels.includes("municipality")
    ? "Entidad y municipio"
    : "Solo entidad";
}

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function IndicatorEntry({ indicator }: { indicator: Indicator }) {
  return (
    <article id={indicator.id} className="flex scroll-mt-16 flex-col gap-3">
      <h3 className="text-base font-semibold">
        <a href={`#${indicator.id}`}>{indicator.name}</a>
      </h3>
      <p>{indicator.definition}</p>
      <dl className="flex flex-col gap-2 text-sm">
        <Field term="Fórmula">{indicator.formula}</Field>
        <Field term="Unidad">{unitLabel(indicator.unit)}</Field>
        <Field term="Años">
          {indicator.year_note ?? indicator.years.join(" y ")}
        </Field>
        <Field term="Nivel">{levels(indicator)}</Field>
        <Field term="Por sector">{indicator.by_sector ? "Sí" : "No"}</Field>
        <Field term="Cobertura">{indicator.coverage}</Field>
        {indicator.warning && (
          <Field term="Advertencia">{indicator.warning}</Field>
        )}
        <Field term="Limitaciones">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {indicator.limitations.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Field>
        <Field term="Fuentes">
          {indicator.sources.map((id, i) => {
            const source = catalog.sources.find((s) => s.id === id);
            return (
              <span key={id}>
                {i > 0 && "; "}
                <a
                  href={`#fuente-${id}`}
                  className="text-link underline underline-offset-2"
                >
                  {source ? `${source.institution}, ${source.name}` : id}
                </a>
              </span>
            );
          })}
        </Field>
        <Field term="Identificador">
          <code>{indicator.id}</code>
        </Field>
      </dl>
    </article>
  );
}

interface GroupContent {
  title: string;
  description: string;
  /** Indicators described for the first time in this group. */
  fresh: Indicator[];
  /** Indicators an earlier group already describes; they get a link, not a second entry. */
  repeated: Indicator[];
}

/** Each indicator is described once, under the first layer that uses it. */
function groupsOf(
  groups: { title: string; description: string; ids: string[] }[],
): GroupContent[] {
  const seen = new Set<string>();
  return groups.map(({ title, description, ids }) => {
    const list = [...new Set(ids)]
      .map(byId)
      .filter((i): i is Indicator => i !== undefined);
    const fresh = list.filter((i) => !seen.has(i.id));
    const repeated = list.filter((i) => seen.has(i.id));
    for (const i of fresh) seen.add(i.id);
    return { title, description, fresh, repeated };
  });
}

function Group({ title, description, fresh, repeated }: GroupContent) {
  return (
    <section className="flex flex-col gap-6 border-t pt-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        {repeated.length > 0 && (
          <p className="text-sm text-muted-foreground">
            También usa, descritos más arriba:{" "}
            {repeated.map((indicator, i) => (
              <span key={indicator.id}>
                {i > 0 && "; "}
                <a
                  href={`#${indicator.id}`}
                  className="text-link underline underline-offset-2"
                >
                  {indicator.name}
                </a>
              </span>
            ))}
            .
          </p>
        )}
      </div>
      {fresh.map((indicator) => (
        <IndicatorEntry key={indicator.id} indicator={indicator} />
      ))}
    </section>
  );
}

export default function MethodologyPage() {
  const { counterargument } = catalog;
  const groups = groupsOf([
    ...catalog.layers.map((layer) => ({
      title: layer.question,
      description: layer.description,
      ids: [
        ...(layer.indicators ?? []),
        ...(layer.context ?? []),
        ...(layer.integration ?? []),
        ...(layer.conditions ?? []),
      ],
    })),
    {
      title: counterargument.title,
      description: counterargument.description,
      ids: [
        ...counterargument.pairs.flatMap((p) => [p.foreign, p.domestic]),
        ...counterargument.single,
      ],
    },
  ]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="methodology" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 text-base md:py-12">
        <section className="flex flex-col gap-4">
          <h2 className="text-5xl">Metodología</h2>
          <p>
            Todas las cifras del mapa salen de fuentes públicas oficiales,
            listadas al final de esta página. Un solo comando descarga los
            archivos originales, comprueba su huella digital, calcula cada
            indicador y valida el resultado antes de publicarlo. El código está
            en{" "}
            <a
              href={REPOSITORY}
              className="text-link underline underline-offset-2"
            >
              GitHub
            </a>
            , así que cualquiera puede reproducir cada número.
          </p>
          <p>
            Esta página se genera a partir del mismo catálogo que usan la
            leyenda y la ficha, así que las tres dicen siempre lo mismo.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t pt-8">
          <h2 className="text-3xl">Cómo se colorea el mapa</h2>
          <p>
            Cada mapa reparte los territorios con dato en cinco clases de igual
            tamaño (quintiles), calculadas sobre todos los territorios del nivel
            visible: las 32 entidades o los 2,478 municipios. Así un color
            significa lo mismo en todo el país. Cuando muchos territorios tienen
            el mismo valor, las clases repetidas se funden y el mapa usa menos
            colores en vez de dejar clases vacías.
          </p>
          <p>
            El mapa de «¿Derrama o enclave?» divide cada eje en tres grupos
            (terciles). En el eje de condiciones de trabajo, «alto» significa
            siempre mejores condiciones: los indicadores en los que un valor
            mayor es peor, como la informalidad, se invierten al clasificar,
            pero la leyenda y la ficha muestran su valor original.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t pt-8">
          <h2 className="text-3xl">Valores que faltan</h2>
          <p>
            Ningún valor se estima, se rellena con cero ni se interpola. Cuando
            falta, el mapa lo marca con una trama y dice por qué:
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            {catalog.missing_reasons.map((reason) => (
              <Field key={reason.id} term={reason.label}>
                {reason.description}
              </Field>
            ))}
          </dl>
        </section>

        {groups.map((group) => (
          <Group key={group.title} {...group} />
        ))}

        <section className="flex flex-col gap-6 border-t pt-8">
          <h2 className="text-3xl">Fuentes</h2>
          {catalog.sources.map((source) => (
            <article
              key={source.id}
              id={`fuente-${source.id}`}
              className="flex scroll-mt-16 flex-col gap-1 text-sm"
            >
              <h3 className="text-base font-semibold">
                <a
                  href={source.url}
                  className="text-link underline underline-offset-2"
                >
                  {source.institution}, {source.name}
                </a>
              </h3>
              <p className="text-muted-foreground">
                Licencia:{" "}
                <a
                  href={source.license_url}
                  className="underline underline-offset-2"
                >
                  {source.license}
                </a>
                . Descargado el {source.retrieved_at}.
                {source.years && ` Describe ${source.years.join(" y ")}.`}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
