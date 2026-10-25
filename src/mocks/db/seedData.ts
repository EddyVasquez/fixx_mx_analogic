import { z } from "zod";
import { ZoneSchema, CategorySchema, UserSchema, ProfessionalSchema, HomeSchema } from "../../core/types/seed";
import zones from "../../seed/zones.json";
import categories from "../../seed/categories.json";
import users from "../../seed/users.json";
import professionals from "../../seed/professionals.json";
import homes from "../../seed/homes.json";

/** Validates every seed file; throws with a readable Zod error if one is malformed. No database involved. */
export function loadSeed() {
  return {
    zones: z.array(ZoneSchema).parse(zones),
    categories: z.array(CategorySchema).parse(categories),
    users: z.array(UserSchema).parse(users),
    professionals: z.array(ProfessionalSchema).parse(professionals),
    homes: z.array(HomeSchema).parse(homes)
  };
}
