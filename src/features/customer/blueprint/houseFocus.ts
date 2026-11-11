/** Which home fact is lighting a space on the model. */
export type FactId = "stories" | "built" | "bedrooms" | "bathrooms" | "minisplits" | "garage";

/** Bedrooms and bathrooms are inside the shell, so the roof and front wall step aside. */
export function usesCutaway(fact: FactId): boolean {
  return fact === "bedrooms" || fact === "bathrooms";
}

export function hidesForCutaway(name: string): boolean {
  return name === "Roof" || name.startsWith("Roof_") || name === "Upper_Wall_Front";
}

/** True when this GLB node belongs to the fact. Stories and Built outline whole groups. */
export function matchesFact(name: string, fact: FactId): boolean {
  switch (fact) {
    case "garage":
      return name.startsWith("GarageDoor_") || name === "Site_Driveway" || name === "Ground_Wall_Interior_Garage";
    case "minisplits":
      return name.startsWith("Minisplit_Condenser") || name.startsWith("Minisplit_Indoor_");
    case "bedrooms":
      return name.startsWith("Upper_MainBed_") || name.startsWith("Upper_Bed2") || name.startsWith("Upper_Bed3_") || name === "Upper_Wall_Interior_Bed23";
    case "bathrooms":
      return name === "Ground_Wall_Interior_Bath" || name === "Upper_Wall_Interior_Bath";
    case "stories":
      return name === "Ground" || name === "Upper" || name.startsWith("Ground_") || name.startsWith("Upper_");
    case "built":
      return name === "Ground_Slab" || name.startsWith("Ground_Slab") || name === "Upper_Slab" || name.startsWith("Upper_Slab");
    default:
      return false;
  }
}
