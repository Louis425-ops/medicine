export type Sex = "male" | "female";
export type DiabetesType = "type1" | "type2" | "unknown";
export type HeartFailureType = "hfrEF" | "hfpEF" | "unknown";
export type RuleAction =
  | "strong_confirm"
  | "confirm"
  | "caution"
  | "exclude"
  | "monitor";
export type RelationshipType = "confirm" | "exclude" | "caution" | "monitor";

export interface BaseInfo {
  patientName: string;
  age: number | "";
  sex: Sex;
  weight: number | "";
  height: number | "";
  smoking: boolean;
  drinking: boolean;
  primaryHypertension: boolean;
}

export interface HypertensionProfile {
  sbp: number | "";
  dbp: number | "";
  diagnosed: boolean;
  uncontrolled: boolean;
  onMedication: boolean;
  medicationCount: number | "";
  resistantSuspected: boolean;
}

export interface DiabetesProfile {
  hasDiabetes: boolean;
  diabetesType: DiabetesType;
  hba1c: number | "";
  proteinuria: boolean;
  diabeticNephropathy: boolean;
}

export interface CkdProfile {
  hasCkd: boolean;
  egfr: number | "";
  creatinine: number | "";
  potassium: number | "";
  proteinuria: boolean;
  recentWorsening: boolean;
  edema: boolean;
}

export interface CadProfile {
  hasCad: boolean;
  angina: boolean;
  previousMi: boolean;
  heartRate: number | "";
  onBetaBlocker: boolean;
}

export interface HeartFailureProfile {
  hasHeartFailure: boolean;
  type: HeartFailureType;
  lvef: number | "";
  legEdema: boolean;
  dyspnea: boolean;
  onBetaBlocker: boolean;
  onMra: boolean;
  onLoopDiuretic: boolean;
}

export interface AsthmaProfile {
  hasAsthma: boolean;
  recentAttack: boolean;
  inhaledMedication: boolean;
  frequentBeta2Agonist: boolean;
}

export interface GoutProfile {
  hasGout: boolean;
  hyperuricemia: boolean;
  uricAcid: number | "";
  previousAttack: boolean;
  onThiazide: boolean;
}

export interface PregnancyProfile {
  pregnant: boolean;
  planning: boolean;
  gestationalWeeks: number | "";
}

export interface CurrentMedicationProfile {
  acei: boolean;
  arb: boolean;
  ccb: boolean;
  thiazide: boolean;
  loop: boolean;
  betaBlocker: boolean;
  mra: boolean;
  nsaids: boolean;
  glucoseLowering: boolean;
  inhaledMedication: boolean;
}

export interface RiskProfile {
  aceiCough: boolean;
  allergies: string;
  hyperkalemiaHistory: boolean;
  renalDeteriorationHistory: boolean;
  hypotensionHistory: boolean;
}

export interface PatientCase {
  id: string;
  createdAt: string;
  base: BaseInfo;
  hypertension: HypertensionProfile;
  diabetes: DiabetesProfile;
  ckd: CkdProfile;
  cad: CadProfile;
  heartFailure: HeartFailureProfile;
  asthma: AsthmaProfile;
  gout: GoutProfile;
  pregnancy: PregnancyProfile;
  currentMedication: CurrentMedicationProfile;
  risk: RiskProfile;
}

export interface DrugDefinition {
  id: string;
  name: string;
  classId: string;
  classLabel: string;
  tags: string[];
  monitoring: string[];
  pregnancyAvailability: "preferred" | "caution" | "avoid";
}

export interface RuleHit {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
  targetLabels: string[];
  weight: number;
  source: string;
  rationale: string;
  evidence: string[];
}

export interface DrugDecision {
  id: string;
  name: string;
  classId: string;
  classLabel: string;
  score: number;
  status: "recommended" | "caution" | "excluded" | "neutral";
  reasons: string[];
}

export interface ClassDecision {
  classId: string;
  classLabel: string;
  score: number;
  drugs: string[];
  reasons: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: "feature" | "rule" | "drug";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationshipType;
  weight: number;
}

export interface RecommendationResult {
  inputSummary: string[];
  topClasses: ClassDecision[];
  topDrugs: DrugDecision[];
  excludedDrugs: DrugDecision[];
  cautionDrugs: DrugDecision[];
  monitorSuggestions: string[];
  ruleHits: RuleHit[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}
