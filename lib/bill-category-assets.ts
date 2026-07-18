import { assets } from "./asset-manifest";

export function getBillCategoryAsset(input?: string | string[]) {
  const text = Array.isArray(input) ? input.join(" ") : (input ?? "");
  const normalized = text.toLowerCase();

  if (/(nutrition|school|meal|lunch|child|student)/.test(normalized)) return assets.billTypes.schoolMeals;
  if (/(budget|appropriation|spending|finance|tax|revenue|treasury)/.test(normalized)) {
    return assets.billTypes.spending || assets.billTypes.taxation;
  }
  if (/(armed|military|defense|national security|veteran)/.test(normalized)) return assets.billTypes.defense;
  if (/(education|college|student loan|teacher)/.test(normalized)) return assets.billTypes.education;
  if (/(health|medicare|medicaid|care|drug|hospital)/.test(normalized)) return assets.billTypes.healthcare;
  if (/(energy|environment|climate|water|wildfire|public lands)/.test(normalized)) {
    return assets.billTypes.environment || assets.billTypes.energy;
  }
  if (/(transport|infrastructure|highway|rail|aviation|public works)/.test(normalized)) {
    return assets.billTypes.infrastructure || assets.billTypes.transportation;
  }
  if (/(housing|home|rent|mortgage)/.test(normalized)) return assets.billTypes.housing;
  if (/(crime|police|public safety|law enforcement|justice)/.test(normalized)) {
    return assets.billTypes.publicSafety;
  }
  if (/(technology|cyber|privacy|broadband|ai|telecom)/.test(normalized)) return assets.billTypes.technology;
  if (/(immigration|border|visa|refugee|citizenship)/.test(normalized)) return assets.billTypes.immigration;

  return assets.billTypes.other;
}
