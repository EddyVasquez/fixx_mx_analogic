/** Which home fact is lighting a space on the model. */
export type FactId = "stories" | "built" | "bedrooms" | "bathrooms" | "minisplits" | "garage";

/** How a fact is drawn. Interior rooms stay a front view with no outline. */
export type FocusMode = "edges" | "bands" | "slab" | "frame";

export function focusMode(fact: FactId): FocusMode {
  if (fact === "stories") return "bands";
  if (fact === "built") return "slab";
  if (fact === "bedrooms" || fact === "bathrooms") return "frame";
  return "edges";
}

/** Interior rooms, floors, and the slab stay on the front 3/4 view. Turning toward them shows the back. */
export function keepsFrontView(fact: FactId): boolean {
  return focusMode(fact) !== "edges";
}

/** True when this GLB node belongs to the fact. Stories and Built are framed as whole volumes, not every child. */
export function matchesFact(name: string, fact: FactId): boolean {
  switch (fact) {
    case "garage":
      return name.startsWith("GarageDoor_") || name === "Site_Driveway" || name === "Ground_Wall_Interior_Garage";
    case "minisplits":
      return name.startsWith("Minisplit_Condenser") || name.startsWith("Minisplit_Indoor_");
    case "bedrooms":
      return name === "Upper" || name.startsWith("Upper_");
    case "bathrooms":
      return name === "Ground_Wall_Interior_Bath" || name === "Upper_Wall_Interior_Bath";
    case "stories":
      return name === "Ground" || name === "Upper" || name.startsWith("Ground_") || name.startsWith("Upper_");
    case "built":
      return name === "Ground_Slab" || name.startsWith("Ground_Slab");
    default:
      return false;
  }
}
