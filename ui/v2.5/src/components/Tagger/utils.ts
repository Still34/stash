import * as GQL from "src/core/generated-graphql";
import { getCountryByISO } from "src/utils/country";

const toTitleCase = (phrase: string) => {
  return phrase
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const parsePath = (filePath: string) => {
  const path = filePath.toLowerCase();
  const isWin = /^([a-z]:|\\\\)/.test(path);
  const normalizedPath = isWin
    ? path.replace(/^[a-z]:/, "").replace(/\\/g, "/")
    : path;
  const pathComponents = normalizedPath
    .split("/")
    .filter((component) => component.trim().length > 0);
  const fileName = pathComponents[pathComponents.length - 1];

  const ext = fileName.match(/\.[a-z0-9]*$/)?.[0] ?? "";
  const file = fileName.slice(0, ext.length * -1);
  const paths =
    pathComponents.length > 2
      ? pathComponents.slice(0, pathComponents.length - 2)
      : [];

  return { paths, file, ext };
};

export interface IStashBoxFingerprint {
  hash: string;
  algorithm: string;
  duration: number;
}

export interface IStashBoxPerformer {
  id?: string;
  stash_id: string;
  name: string;
  gender?: GQL.GenderEnum;
  url?: string;
  twitter?: string;
  instagram?: string;
  birthdate?: string;
  ethnicity?: string;
  country?: string;
  eye_color?: string;
  height?: string;
  measurements?: string;
  fake_tits?: string;
  career_length?: string;
  tattoos?: string;
  piercings?: string;
  aliases?: string;
  images: string[];
  details?: string;
  death_date?: string;
  hair_color?: string;
  weight?: string;
}

export interface IStashBoxTag {
  id?: string;
  name: string;
}

export interface IStashBoxStudio {
  id?: string;
  stash_id: string;
  name: string;
  url?: string;
  image?: string;
}

export interface IStashBoxScene {
  stash_id: string;
  title: string;
  date: string;
  duration: number;
  details?: string;
  url?: string;

  studio: IStashBoxStudio;
  images: string[];
  tags: IStashBoxTag[];
  performers: IStashBoxPerformer[];
  fingerprints: IStashBoxFingerprint[];
}

const selectStudio = (studio: GQL.ScrapedSceneStudio): IStashBoxStudio => ({
  id: studio?.stored_id ?? undefined,
  stash_id: studio.remote_site_id!,
  name: studio.name,
  url: studio.url ?? undefined,
});

const selectFingerprints = (
  scene: GQL.ScrapedScene | null
): IStashBoxFingerprint[] => scene?.fingerprints ?? [];

const selectTags = (tags: GQL.ScrapedSceneTag[]): IStashBoxTag[] =>
  tags.map((t) => ({
    id: t.stored_id ?? undefined,
    name: t.name ?? "",
  }));

export const selectPerformers = (
  performers: GQL.ScrapedScenePerformer[]
): IStashBoxPerformer[] =>
  performers.map((p) => ({
    id: p.stored_id ?? undefined,
    stash_id: p.remote_site_id!,
    name: p.name ?? "",
    gender: (p.gender ?? GQL.GenderEnum.Female) as GQL.GenderEnum,
    url: p.url ?? undefined,
    twitter: p.twitter ?? undefined,
    instagram: p.instagram ?? undefined,
    birthdate: p.birthdate ?? undefined,
    ethnicity: p.ethnicity ? toTitleCase(p.ethnicity) : undefined,
    country: getCountryByISO(p.country) ?? undefined,
    eye_color: p.eye_color ? toTitleCase(p.eye_color) : undefined,
    height: p.height ?? undefined,
    measurements: p.measurements ?? undefined,
    fake_tits: p.fake_tits ? toTitleCase(p.fake_tits) : undefined,
    career_length: p.career_length ?? undefined,
    tattoos: p.tattoos ? toTitleCase(p.tattoos) : undefined,
    piercings: p.piercings ? toTitleCase(p.piercings) : undefined,
    aliases: p.aliases ?? undefined,
    images: p.images ?? [],
    details: p.details ?? undefined,
    death_date: p.death_date ?? undefined,
    hair_color: p.hair_color ?? undefined,
  }));

export const selectScenes = (
  scenes?: (GQL.ScrapedScene | null)[]
): IStashBoxScene[] => {
  const result = (scenes ?? [])
    .filter((s) => s !== null)
    .map(
      (s) =>
        ({
          stash_id: s?.remote_site_id!,
          title: s?.title ?? "",
          date: s?.date ?? "",
          duration: s?.duration ?? 0,
          details: s?.details,
          url: s?.url,
          images: s?.image ? [s.image] : [],
          studio: selectStudio(s?.studio!),
          fingerprints: selectFingerprints(s),
          performers: selectPerformers(s?.performers ?? []),
          tags: selectTags(s?.tags ?? []),
        } as IStashBoxScene)
    );

  return result;
};

export const sortScenesByDuration = (
  scenes: IStashBoxScene[],
  targetDuration?: number
) =>
  scenes.sort((a, b) => {
    if (!targetDuration) return 0;

    const aDur = [
      a.duration,
      ...a.fingerprints.map((f) => f.duration),
    ].map((d) => Math.abs(d - targetDuration));
    const bDur = [
      b.duration,
      ...b.fingerprints.map((f) => f.duration),
    ].map((d) => Math.abs(d - targetDuration));

    if (aDur.length > 0 && bDur.length === 0) return -1;
    if (aDur.length === 0 && bDur.length > 0) return 1;

    const aMatches = aDur.filter((match) => match <= 5);
    const bMatches = bDur.filter((match) => match <= 5);

    if (aMatches.length > 0 || bMatches.length > 0) {
      if (aMatches.length > bMatches.length) return -1;
      if (aMatches.length < bMatches.length) return 1;
      return 0;
    }

    const aDiff = Math.min(...aDur);
    const bDiff = Math.min(...bDur);

    if (aDiff < bDiff) return -1;
    if (aDiff > bDiff) return 1;
    return 0;
  });

export const filterPerformer = (
  performer: IStashBoxPerformer,
  excludedFields: string[]
) => {
  const {
    name,
    aliases,
    gender,
    birthdate,
    ethnicity,
    country,
    eye_color,
    height,
    measurements,
    fake_tits,
    career_length,
    tattoos,
    piercings,
  } = performer;
  return {
    name: !excludedFields.includes("name") && name ? name : undefined,
    aliases:
      !excludedFields.includes("aliases") && aliases ? aliases : undefined,
    gender: !excludedFields.includes("gender") && gender ? gender : undefined,
    birthdate:
      !excludedFields.includes("birthdate") && birthdate
        ? birthdate
        : undefined,
    ethnicity:
      !excludedFields.includes("ethnicity") && ethnicity
        ? ethnicity
        : undefined,
    country:
      !excludedFields.includes("country") && country ? country : undefined,
    eye_color:
      !excludedFields.includes("eye_color") && eye_color
        ? eye_color
        : undefined,
    height: !excludedFields.includes("height") && height ? height : undefined,
    measurements:
      !excludedFields.includes("measurements") && measurements
        ? measurements
        : undefined,
    fake_tits:
      !excludedFields.includes("fake_tits") && fake_tits
        ? fake_tits
        : undefined,
    career_length:
      !excludedFields.includes("career_length") && career_length
        ? career_length
        : undefined,
    tattoos:
      !excludedFields.includes("tattoos") && tattoos ? tattoos : undefined,
    piercings:
      !excludedFields.includes("piercings") && piercings
        ? piercings
        : undefined,
  };
};
